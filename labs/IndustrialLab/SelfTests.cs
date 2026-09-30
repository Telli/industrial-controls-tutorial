using System.Buffers.Binary;

namespace IndustrialLab;

public static partial class SelfTests
{
    public static async Task RunAsync()
    {
        int passed = 0;
        void Check(bool condition, string name)
        {
            if (!condition) throw new Exception("FAILED: " + name);
            Console.WriteLine("PASS " + name); passed++;
        }
        void Reject(Action action, string name)
        {
            try { action(); } catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            { Check(true, name); return; }
            throw new Exception("FAILED to reject: " + name);
        }
        async Task RejectFrame(byte[] frame, string name)
        {
            try { await Wire.ReadFc03Async(new ChunkStream(frame, 2), 7, 1, 2, default); }
            catch (Exception ex) when (ex is InvalidDataException or EndOfStreamException)
            { Check(true, name); return; }
            throw new Exception("FAILED to reject: " + name);
        }
        var vectors = new (ByteOrder Order, ushort R0, ushort R1)[]
        {
            (ByteOrder.ABCD, 0x42F6, 0xE979), (ByteOrder.BADC, 0xF642, 0x79E9),
            (ByteOrder.CDAB, 0xE979, 0x42F6), (ByteOrder.DCBA, 0x79E9, 0xF642)
        };
        foreach (var v in vectors)
            Check(BitConverter.SingleToInt32Bits(Wire.DecodeFloat(v.R0, v.R1, v.Order)) == 0x42F6E979,
                "Independent float vector " + v.Order);
        Check(Wire.DecodeFloat(0x41CC, 0, ByteOrder.ABCD) == 25.5f, "25.5 degC known value");
        Check(Wire.DecodeFloat(0xC120, 0, ByteOrder.ABCD) == -10f, "Negative float");
        Check(float.IsNaN(Wire.DecodeFloat(0x7FC0, 0, ByteOrder.ABCD)), "NaN preserved for quality validation");
        Check(Wire.Bit(5, 0) && !Wire.Bit(5, 1) && Wire.Bit(5, 2), "Packed bits 0x05");
        Reject(() => Wire.Bit(5, 8), "Out of range bit");
        byte[] frame = [0,7, 0,0, 0,7, 1,3,4, 0x41,0xCC,0,0];
        var split = await Wire.ReadFc03Async(new ChunkStream(frame, 1), 7, 1, 2, default);
        Check(split.SequenceEqual(new ushort[] {0x41CC,0}), "Every byte arrives separately");
        using var joined = new ChunkStream([..frame, ..frame], 100);
        await Wire.ReadFc03Async(joined, 7, 1, 2, default);
        await Wire.ReadFc03Async(joined, 7, 1, 2, default);
        Check(joined.Position == 26, "Two coalesced frames remain separate");
        await RejectFrame(frame[..^1], "Truncated frame");
        byte[] badLength = [..frame]; badLength[4] = 1;
        await RejectFrame(badLength, "Oversized frame");
        byte[] badTransaction = [..frame]; badTransaction[1] = 8;
        await RejectFrame(badTransaction, "Wrong transaction");
        byte[] badCount = [..frame]; badCount[8] = 2;
        await RejectFrame(badCount, "Wrong byte count");
        await RejectFrame([0,7,0,0,0,3,1,0x83,2], "Device exception");
        using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
        bool wasCancelled = false;
        try { await Wire.ReadFc03Async(new ChunkStream(frame, 1),7,1,2,cancelled.Token); }
        catch (OperationCanceledException) { wasCancelled = true; }
        Check(wasCancelled, "Frame read cancellation");
        var clock = new StudyClock();
        var machine = new Machine(clock);
        var initial = machine.Snapshot();
        Check(initial.Quality == "Good" && initial.Sample.TemperatureC == 25, "Initial snapshot");
        var request = new ProposalRequest("tank-01", 55, initial.Sample.Sequence, "study-1", "Exercise");
        var proposal = machine.Propose(request);
        Check(!proposal.Executed && machine.Snapshot().Sample.SetpointC == 60, "Proposal never changes control");
        Check(machine.Propose(request) == proposal, "Identical retry is idempotent");
        Reject(() => machine.Propose(request with { TargetC = 56 }), "Conflicting request ID");
        Reject(() => machine.Propose(request with { RequestId = "bad-number", TargetC = double.NaN }), "NaN command");
        Reject(() => machine.Propose(request with { RequestId = "bad-range", TargetC = 80 }), "Out of range command");
        Reject(() => machine.Propose(request with { RequestId = "bad-asset", AssetId = "tank-02" }), "Unknown asset");
        Reject(() => machine.Propose(request with { RequestId = "bad-evidence", EvidenceSequence = 999 }), "Invented evidence");
        clock.Advance(TimeSpan.FromSeconds(3));
        Check(machine.Snapshot().Quality == "Stale", "Reads do not refresh sample age");
        Reject(() => machine.Propose(request with { RequestId = "stale" }), "Stale current state");
        machine.SetLink(false); machine.Advance(1);
        Check(machine.Snapshot().Quality == "BadCommunication" && machine.Snapshot().Sample.Sequence == initial.Sample.Sequence,
            "Disconnected reads keep last sample and mark bad");
        machine.SetLink(true);
        Check(machine.Snapshot().Quality == "BadCommunication", "Reconnect waits for fresh acquisition");
        machine.Advance(1);
        Check(machine.Snapshot().Quality == "Good", "Link recovers after acquisition");
        machine.SetFault(true);
        Reject(() => machine.Propose(request with { RequestId = "fault" }), "Immediate fault gate");
        machine.Advance(1);
        Check(machine.Snapshot().Sample.State == "Fault", "Observed fault state");
        machine.SetFault(false); machine.Advance(1);
        clock.Advance(TimeSpan.FromSeconds(31)); machine.Advance(1);
        Reject(() => machine.Propose(request with { RequestId = "old" }), "Old evidence");
        Reject(() => machine.History(61), "Bounded history query");
        Check(machine.Snapshot().Sample.Sequence > initial.Sample.Sequence, "Monotonic sequence");
        await RunLabChecksAsync(Check, Reject);
        Console.WriteLine($"All {passed} checks passed.");
    }

    private sealed class StudyClock : TimeProvider
    {
        private DateTimeOffset now = new(2026,9,29,0,0,0,TimeSpan.Zero);
        private long tick;
        public override DateTimeOffset GetUtcNow() => now;
        public override long GetTimestamp() => tick;
        public override long TimestampFrequency => TimeSpan.TicksPerSecond;
        public void Advance(TimeSpan span) { now += span; tick += span.Ticks; }
    }
    private sealed class ChunkStream(byte[] data, int maxChunk) : MemoryStream(data)
    {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => base.ReadAsync(buffer[..Math.Min(buffer.Length, maxChunk)], cancellationToken);
    }
}
