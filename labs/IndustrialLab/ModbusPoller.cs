using System.Diagnostics;
using System.Net.Sockets;

namespace IndustrialLab;

public sealed record TankReading(float TemperatureC, float SetpointC, double TemperatureFromTenthsC,
    bool Heating, bool Holding, bool Fault, bool Alarm, bool Simulated,
    uint Sequence, ushort Heartbeat, ushort MappingVersion);

public static class TankContract
{
    // Decoding is a pure function of ten registers and the published map. Test it without a socket.
    public static TankReading Decode(ushort[] r)
    {
        if (r.Length != TankRegisterMap.Count) throw new ArgumentException("Expected the complete 10-register image.");
        ushort status = r[TankRegisterMap.StatusWord];
        return new(
            Wire.DecodeFloat(r[0], r[1], ByteOrder.ABCD),
            Wire.DecodeFloat(r[2], r[3], ByteOrder.CDAB),
            Wire.DecodeInt16(r[TankRegisterMap.TemperatureTenths]) / 10.0,
            Wire.Bit(status, TankRegisterMap.BitHeating), Wire.Bit(status, TankRegisterMap.BitHolding),
            Wire.Bit(status, TankRegisterMap.BitFault), Wire.Bit(status, TankRegisterMap.BitAlarm),
            Wire.Bit(status, TankRegisterMap.BitSimulated),
            Wire.DecodeUInt32(r[5], r[6], ByteOrder.ABCD),
            r[TankRegisterMap.Heartbeat], r[TankRegisterMap.Mapping]);
    }
}

public sealed record PollerOptions(string Host = "127.0.0.1", int Port = ModbusDeviceService.Port,
    int PollMs = 500, int TimeoutMs = 1000, ushort ExpectedMapping = TankRegisterMap.MappingVersion,
    int StaleAfterPolls = 3, int MaxBackoffMs = 8000);

// Quality: Good | Stale (answers, but heartbeat frozen) | BadConfiguration (wrong map)
//          | BadSensor (non-finite value) | BadCommunication (timeout, EOF, malformed frame)
public sealed record PollResult(DateTimeOffset Time, string Quality, TankReading? Reading,
    DateTimeOffset? LastGoodTime, string Detail, int ConsecutiveFailures, double RoundTripMs, ushort TransactionId);

public sealed class ModbusTankPoller(PollerOptions options, TimeProvider clock) : IDisposable
{
    private TcpClient? client;
    private NetworkStream? stream;
    private ushort transactionId;
    private ushort? lastHeartbeat;
    private int unchangedPolls;
    private TankReading? lastReading;
    private DateTimeOffset? lastGoodTime;
    public int ConsecutiveFailures { get; private set; }
    public int Reconnects { get; private set; }

    public async Task<PollResult> PollOnceAsync(CancellationToken ct)
    {
        ushort tid = unchecked(++transactionId);
        long started = Stopwatch.GetTimestamp();
        // One deadline covers connect, write, header and body. No Sleep decides where a frame ends.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
        deadline.CancelAfter(options.TimeoutMs);
        try
        {
            if (stream is null)
            {
                client = new TcpClient { NoDelay = true };
                await client.ConnectAsync(options.Host, options.Port, deadline.Token);
                stream = client.GetStream();
                Reconnects++;
            }
            await stream.WriteAsync(Wire.BuildFc03Request(tid, TankRegisterMap.UnitId, 0, TankRegisterMap.Count), deadline.Token);
            ushort[] registers = await Wire.ReadFc03Async(stream, tid, TankRegisterMap.UnitId, TankRegisterMap.Count, deadline.Token);
            double rtt = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            ConsecutiveFailures = 0;
            return Classify(TankContract.Decode(registers), tid, rtt);
        }
        catch (Exception ex) when (ex is OperationCanceledException or IOException or SocketException
                                       or InvalidDataException or EndOfStreamException)
        {
            if (ct.IsCancellationRequested) throw;
            // After a timeout a late reply may still arrive. Closing avoids reading it as the next answer.
            Disconnect();
            ConsecutiveFailures++;
            lastHeartbeat = null; unchangedPolls = 0;   // a reconnect must prove liveness again
            string why = ex is OperationCanceledException ? $"No complete response within {options.TimeoutMs} ms" : ex.Message;
            return new(clock.GetUtcNow(), "BadCommunication", lastReading, lastGoodTime, why,
                ConsecutiveFailures, Stopwatch.GetElapsedTime(started).TotalMilliseconds, tid);
        }
    }

    private PollResult Classify(TankReading reading, ushort tid, double rtt)
    {
        var now = clock.GetUtcNow();
        if (reading.MappingVersion != options.ExpectedMapping)
            // Never decode values with a map the device says it is not using.
            return new(now, "BadConfiguration", null, lastGoodTime,
                $"Device reports mapping {reading.MappingVersion}; client expects {options.ExpectedMapping}", 0, rtt, tid);
        bool changed = lastHeartbeat is null || reading.Heartbeat != lastHeartbeat;   // any change counts, so wrap is fine
        unchangedPolls = changed ? 0 : unchangedPolls + 1;
        lastHeartbeat = reading.Heartbeat;
        lastReading = reading;
        if (!float.IsFinite(reading.TemperatureC))
            return new(now, "BadSensor", reading, lastGoodTime, "Temperature is not a finite number", 0, rtt, tid);
        if (unchangedPolls >= options.StaleAfterPolls)
            return new(now, "Stale", reading, lastGoodTime,
                $"Heartbeat {reading.Heartbeat} unchanged for {unchangedPolls} polls", 0, rtt, tid);
        lastGoodTime = now;
        return new(now, "Good", reading, now, "OK", 0, rtt, tid);
    }

    // Capped exponential backoff with jitter: 250, 500, 1000 ... up to MaxBackoffMs, each scaled 50-100%.
    public int NextDelayMs(Random random)
    {
        if (ConsecutiveFailures == 0) return options.PollMs;
        double backoff = Math.Min(options.MaxBackoffMs, 250 * Math.Pow(2, Math.Min(ConsecutiveFailures - 1, 16)));
        return (int)(backoff * (0.5 + random.NextDouble() / 2));
    }

    private void Disconnect()
    {
        stream?.Dispose(); client?.Dispose();
        stream = null; client = null;
    }

    public void Dispose() => Disconnect();

    public static async Task RunConsoleAsync(PollerOptions options, int count, CancellationToken ct)
    {
        using var poller = new ModbusTankPoller(options, TimeProvider.System);
        var random = new Random();
        Console.WriteLine($"Polling {options.Host}:{options.Port} unit {TankRegisterMap.UnitId}, 10 registers every {options.PollMs} ms. Ctrl+C stops.");
        Console.WriteLine("time         tid   quality           temp(f32)  temp(x10)  setpoint  state    hb     seq      rtt  detail");
        for (int i = 0; count <= 0 || i < count; i++)
        {
            PollResult r;
            try { r = await poller.PollOnceAsync(ct); }
            catch (OperationCanceledException) { break; }
            TankReading? x = r.Reading;
            string state = x is null ? "-" : x.Fault ? "Fault" : x.Holding ? "Holding" : x.Heating ? "Heating" : "Idle";
            Console.WriteLine($"{r.Time.ToLocalTime():HH:mm:ss.fff} {r.TransactionId,5} {r.Quality,-17} " +
                (x is null ? $"{"-",9}  {"-",9}  {"-",8}  {"-",-7} {"-",6} {"-",8}" :
                 $"{x.TemperatureC,9:F3}  {x.TemperatureFromTenthsC,9:F1}  {x.SetpointC,8:F1}  {state,-7} {x.Heartbeat,6} {x.Sequence,8}") +
                $" {r.RoundTripMs,5:F0}ms {r.Detail}");
            try { await Task.Delay(poller.NextDelayMs(random), ct); }
            catch (OperationCanceledException) { break; }
        }
    }
}
