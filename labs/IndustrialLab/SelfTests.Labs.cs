using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;

namespace IndustrialLab;

// Checks for the guided labs added in the second edition (Labs 2, 8, 10, 13 and 14).
public static partial class SelfTests
{
    private static async Task RunLabChecksAsync(Action<bool, string> check, Action<Action, string> reject)
    {
        // ---- Wire additions -------------------------------------------------------------
        check(Wire.DecodeUInt32(0x0001, 0x86A0, ByteOrder.ABCD) == 100_000, "uint32 ABCD 100000");
        check(Wire.DecodeUInt32(0x86A0, 0x0001, ByteOrder.CDAB) == 100_000, "uint32 CDAB (low word first) 100000");
        check(Wire.DecodeInt16(0xFF9C) == -100 && Wire.DecodeInt16(0x00FA) == 250, "Signed int16 scaling source");
        check(Wire.Bit((ushort)0x8001, 15) && Wire.Bit((ushort)0x8001, 0) && !Wire.Bit((ushort)0x8001, 1), "16-bit status word bits");
        reject(() => Wire.Bit((ushort)1, 16), "Out of range word bit");
        check(Wire.BuildFc03Request(7, 1, 0, 2).SequenceEqual(new byte[] { 0, 7, 0, 0, 0, 6, 1, 3, 0, 0, 0, 2 }), "FC03 request bytes");

        // ---- Lab 2: scan and poll timing -----------------------------------------------
        var scan = ScanSimulator.Run(new ScanOptions(ScanMs: 10, PollMs: 100, PulseMs: 15));
        check(scan.PlcDetected == scan.PhysicalPulses, "Scan: 15 ms pulse always seen by a 10 ms scan");
        check(scan.PollerSawBit < scan.PlcDetected, "Scan: 100 ms poll misses live-bit pulses");
        check(scan.PollerCounterDelta == scan.PlcDetected, "Scan: counter preserves every detected pulse");
        var shortPulse = ScanSimulator.Run(new ScanOptions(ScanMs: 10, PollMs: 100, PulseMs: 4));
        check(shortPulse.PlcDetected < shortPulse.PhysicalPulses, "Scan: 4 ms pulse can fall between PLC input samples");
        var fastPoll = ScanSimulator.Run(new ScanOptions(ScanMs: 10, PollMs: 5, PulseMs: 15));
        check(fastPoll.PollerSawBit == fastPoll.PlcDetected, "Scan: poll faster than the scan sees every published edge");
        check(ScanSimulator.Run(new ScanOptions()) == ScanSimulator.Run(new ScanOptions()), "Scan: deterministic for a seed");
        reject(() => ScanSimulator.Run(new ScanOptions(PollMs: 0)), "Scan: invalid option");

        // ---- Lab 8: alarm lifecycle ----------------------------------------------------
        var t = new DateTimeOffset(2026, 9, 29, 8, 0, 0, TimeSpan.Zero);
        var a = new HighAlarm("t", 65, 63);
        foreach (double v in new[] { 64.0, 65, 64, 63 }) a.Evaluate(v, "Good", t = t.AddSeconds(1));
        check(a.Events.Select(e => e.Transition).SequenceEqual(new[] { "Activated", "ReturnedToNormal" }), "Alarm: 64,65,64,63 activates once and returns");
        check(a.State == AlarmState.UnackReturned, "Alarm: unacknowledged return is still visible");
        check(a.Acknowledge("op", t) && a.State == AlarmState.Normal, "Alarm: ack after return clears the entry");
        var chatter = new HighAlarm("t", 65, 63);
        foreach (double v in new[] { 65.0, 64, 65, 64, 65 }) chatter.Evaluate(v, "Good", t = t.AddSeconds(1));
        check(chatter.Events.Count(e => e.Transition == "Activated") == 1, "Alarm: hysteresis prevents chatter");
        check(chatter.Acknowledge("op", t) && chatter.ConditionActive && chatter.State == AlarmState.AckedActive, "Alarm: ack does not clear an active condition");
        chatter.Evaluate(40, "BadCommunication", t = t.AddSeconds(1));
        check(chatter.ConditionActive && chatter.QualityBad && chatter.State == AlarmState.AckedActive, "Alarm: bad quality never returns to normal");
        chatter.Evaluate(62, "Good", t = t.AddSeconds(1));
        check(chatter.State == AlarmState.Normal && chatter.Events[^2].Transition == "QualityRestored", "Alarm: fresh good value returns to normal");
        var delayed = new HighAlarm("t", 65, 63, TimeSpan.FromSeconds(2));
        delayed.Evaluate(66, "Good", t); delayed.Evaluate(62, "Good", t.AddSeconds(1));
        delayed.Evaluate(66, "Good", t.AddSeconds(2));
        check(!delayed.ConditionActive, "Alarm: on-delay ignores a brief excursion");
        delayed.Evaluate(66, "Good", t.AddSeconds(4));
        check(delayed.ConditionActive, "Alarm: on-delay activates after sustained excursion");
        reject(() => new HighAlarm("t", 63, 65), "Alarm: clear limit must be below set limit");

        // ---- Service alarm wiring ------------------------------------------------------
        var clock = new StudyClock();
        var m = new Machine(clock);
        m.SetDisturbance(10);                                          // equilibrium 70 degC
        for (int i = 0; i < 120; i++) { clock.Advance(TimeSpan.FromSeconds(1)); m.Advance(1); }
        check(m.Alarms().State == AlarmState.UnackActive, "Service: disturbance raises supervisory alarm");
        check(m.AcknowledgeAlarm("op") && m.Alarms().ConditionActive, "Service: ack keeps condition active");
        reject(() => m.SetDisturbance(50), "Service: disturbance range enforced");

        // ---- Lab 10: outbox and idempotent receiver -----------------------------------
        string dir = Path.Combine(Path.GetTempPath(), "industrial-lab-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var evt = new BusinessEvent("b1:completed", "BatchCompleted", "b1", 100, t);
            var mes = new IdempotentMesReceiver { LoseNextAcknowledgements = 1 };
            var outbox = new FileOutbox(dir);
            outbox.Enqueue(evt); outbox.Enqueue(evt);
            check(outbox.Pending().Count == 1, "Outbox: identical enqueue is idempotent");
            reject(() => outbox.Enqueue(evt with { Quantity = 99 }), "Outbox: conflicting event ID");
            check(await outbox.DeliverPendingAsync(mes, TimeSpan.FromSeconds(1), default) == 0 && mes.TotalQuantity == 100,
                "Outbox: lost acknowledgement leaves event pending");
            outbox = new FileOutbox(dir);                               // restart
            check(outbox.Pending().Count == 1, "Outbox: pending state survives restart");
            check(await outbox.DeliverPendingAsync(mes, TimeSpan.FromSeconds(1), default) == 1 && mes.TotalQuantity == 100 && mes.DuplicatesIgnored == 1,
                "Outbox: retry is deduplicated by receiver");
            check(new FileOutbox(dir).Pending().Count == 0, "Outbox: delivery record survives restart");
            File.AppendAllText(Path.Combine(dir, "outbox.jsonl"), "{\"kind\":\"event\",\"ev");   // crash mid-append
            var recovered = new FileOutbox(dir);
            check(recovered.RecoveredTornLines == 1 && recovered.Pending().Count == 0, "Outbox: torn final line ignored");
            recovered.Enqueue(evt with { EventId = "b2:completed" });
            check(new FileOutbox(dir).Pending().Count == 1, "Outbox: append after torn-line recovery");
            var naive = new IdempotentMesReceiver(deduplicate: false) { LoseNextAcknowledgements = 1 };
            var naiveBox = new FileOutbox(Path.Combine(dir, "naive"));
            naiveBox.Enqueue(evt);
            await naiveBox.DeliverPendingAsync(naive, TimeSpan.FromSeconds(1), default);
            await naiveBox.DeliverPendingAsync(naive, TimeSpan.FromSeconds(1), default);
            check(naive.TotalQuantity == 200, "Outbox: non-idempotent receiver double counts (the bug)");
        }
        finally { try { Directory.Delete(dir, true); } catch (IOException) { } }

        // ---- Labs 13-14: Modbus TCP over a real loopback socket ------------------------
        var devClock = new StudyClock();
        var machine = new Machine(devClock);
        var device = new ModbusTankDevice(machine);
        var listener = new TcpListener(IPAddress.Loopback, 0);
        using var stop = new CancellationTokenSource();
        var serverTask = device.RunAsync(listener, stop.Token);
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        try
        {
            var image = TankRegisterMap.Build(machine.Snapshot().Sample);
            var decoded = TankContract.Decode(image);
            check(decoded.TemperatureC == 25f && decoded.SetpointC == 60f && decoded.TemperatureFromTenthsC == 25.0 &&
                  decoded.Heating && decoded.Simulated && decoded.MappingVersion == 1, "Contract: encode/decode tank image");
            check(image[2] == 0x0000 && image[3] == 0x4270, "Contract: setpoint 60.0 is stored low word first (CDAB)");
            check(image.SequenceEqual(new ushort[] { 0x41C8, 0, 0, 0x4270, 0x8001, 0, 1, 0x00FA, 1, 1 }),
                "Contract: Appendix D initial test vector");

            // Fragmentation deliberately delays each byte. Coarse Windows timer ticks can
            // make the 29-byte reply exceed 400 ms; test framing without a timing race.
            var options = new PollerOptions(Port: port, TimeoutMs: 2000, StaleAfterPolls: 2);
            using var poller = new ModbusTankPoller(options, devClock);
            var first = await poller.PollOnceAsync(default);
            check(first.Quality == "Good" && first.Reading!.TemperatureC == 25f, "Modbus: poll decodes over TCP");
            machine.Advance(1);
            var second = await poller.PollOnceAsync(default);
            check(second.Quality == "Good" && second.TransactionId == (ushort)(first.TransactionId + 1), "Modbus: transaction IDs advance");

            device.ChunkBytes = 1;
            machine.Advance(1);
            check((await poller.PollOnceAsync(default)).Quality == "Good", "Modbus: one-byte TCP fragments reassemble");
            device.ChunkBytes = 0;

            device.Frozen = true;
            machine.Advance(1); await poller.PollOnceAsync(default);
            machine.Advance(1); await poller.PollOnceAsync(default);
            machine.Advance(1);
            check((await poller.PollOnceAsync(default)).Quality == "Stale", "Modbus: frozen heartbeat detected as Stale");
            device.Frozen = false;
            machine.Advance(1);
            check((await poller.PollOnceAsync(default)).Quality == "Good", "Modbus: live heartbeat restores Good");

            machine.SetLink(false);
            var lost = await poller.PollOnceAsync(default);
            check(lost.Quality == "BadCommunication" && lost.Reading is not null && poller.ConsecutiveFailures == 1,
                "Modbus: silent device times out; last reading kept with bad quality");
            check(poller.NextDelayMs(new Random(1)) is >= 125 and <= 250, "Modbus: first backoff 125-250 ms");
            machine.SetLink(true); machine.Advance(1);
            var back = await poller.PollOnceAsync(default);
            check(back.Quality == "Good" && poller.Reconnects == 2, "Modbus: reconnect after timeout");

            using var wrongMap = new ModbusTankPoller(options with { ExpectedMapping = 2 }, devClock);
            var cfg = await wrongMap.PollOnceAsync(default);
            check(cfg.Quality == "BadConfiguration" && cfg.Reading is null, "Modbus: mapping mismatch refuses to decode");

            check(await RawExceptionAsync(port, Wire.BuildFc03Request(9, 1, 8, 5)) == 0x02, "Modbus: exception 02 illegal address");
            check(await RawExceptionAsync(port, Wire.BuildFc03Request(9, 2, 0, 1)) == 0x0B, "Modbus: exception 0B unknown unit");
            byte[] write = [0, 9, 0, 0, 0, 6, 1, 0x06, 0, 2, 0, 50];    // FC06 write single register
            check(await RawExceptionAsync(port, write) == 0x01, "Modbus: writes refused with exception 01");
        }
        finally
        {
            stop.Cancel();
            try { await serverTask; } catch (OperationCanceledException) { }
        }
    }

    // Sends one raw request and returns the exception code from the reply.
    private static async Task<byte> RawExceptionAsync(int port, byte[] request)
    {
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, port);
        using var stream = client.GetStream();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        await stream.WriteAsync(request, deadline.Token);
        byte[] reply = new byte[9];
        await stream.ReadExactlyAsync(reply, deadline.Token);
        if (BinaryPrimitives.ReadUInt16BigEndian(reply.AsSpan(4)) != 3 || (reply[7] & 0x80) == 0)
            throw new Exception("Expected an exception response.");
        return reply[8];
    }
}
