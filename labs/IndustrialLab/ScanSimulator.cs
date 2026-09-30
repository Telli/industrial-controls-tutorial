namespace IndustrialLab;

public sealed record ScanOptions(int ScanMs = 10, int PollMs = 100, int PulseMs = 15,
    int Pulses = 50, int Seed = 7, int PollPhaseMs = 3);

public sealed record ScanResult(ScanOptions Options, int PhysicalPulses, int PlcDetected,
    int PollerSawBit, int PollerCounterDelta, int MaxLatencyMs, double MeanLatencyMs);

// A deterministic 1 ms model of: field input -> PLC scan (read inputs, run logic, publish image)
// -> an external client polling that published image. It is a teaching model, not a PLC emulator.
public static class ScanSimulator
{
    public static ScanResult Run(ScanOptions o)
    {
        if (o.ScanMs is < 1 or > 1000 || o.PollMs is < 1 or > 10000 || o.PulseMs is < 1 or > 1000 ||
            o.Pulses is < 1 or > 10000 || o.PollPhaseMs < 0 || o.PollPhaseMs >= o.PollMs)
            throw new ArgumentOutOfRangeException(nameof(o), "Option outside the supported study range.");
        var random = new Random(o.Seed);
        var starts = new int[o.Pulses];
        int t0 = 50;
        for (int i = 0; i < o.Pulses; i++)
        {
            starts[i] = t0;
            // Gaps are long enough that the PLC always sees the input low between pulses.
            t0 += o.PulseMs + 2 * o.ScanMs + 50 + random.Next(0, 300);
        }
        int end = starts[^1] + o.PulseMs + 3 * o.ScanMs + 2 * o.PollMs;
        var input = new bool[end + 1];
        foreach (int s in starts)
            for (int t = s; t < s + o.PulseMs && t <= end; t++) input[t] = true;

        // PLC: inputs are sampled at the start of each scan; the image is published at its end.
        var publishedBit = new bool[end + 1];
        var publishedCounter = new int[end + 1];
        var detectionPulseStart = new List<int>();
        bool previousInput = false, imageBit = false;
        int counter = 0, imageCounter = 0;
        for (int t = 0; t <= end; t++)
        {
            if (t % o.ScanMs == 0)
            {
                if (t > 0) { imageBit = previousInput; imageCounter = counter; } // publish the scan that just ended
                bool sampled = input[t];
                if (sampled && !previousInput)
                {
                    counter++;
                    detectionPulseStart.Add(starts.Last(s => s <= t)); // which physical pulse caused it
                }
                previousInput = sampled;
            }
            publishedBit[t] = imageBit;
            publishedCounter[t] = imageCounter;
        }

        // External poller: reads the published image at a fixed period and phase.
        int sawBit = 0, firstCounter = -1, lastCounter = 0, assigned = 0;
        bool lastBit = false;
        var latencies = new List<int>();
        for (int t = o.PollPhaseMs; t <= end; t += o.PollMs)
        {
            bool bit = publishedBit[t];
            int c = publishedCounter[t];
            if (bit && !lastBit) sawBit++;
            lastBit = bit;
            if (firstCounter < 0) firstCounter = c;
            lastCounter = c;
            while (assigned < c) latencies.Add(t - detectionPulseStart[assigned++]);
        }
        return new(o, o.Pulses, counter, sawBit, lastCounter - firstCounter,
            latencies.Count == 0 ? 0 : latencies.Max(), latencies.Count == 0 ? 0 : latencies.Average());
    }

    public static void Print(ScanResult r)
    {
        var o = r.Options;
        Console.WriteLine($"Scan {o.ScanMs} ms | poll {o.PollMs} ms (phase {o.PollPhaseMs} ms) | pulse {o.PulseMs} ms | {o.Pulses} pulses | seed {o.Seed}");
        Console.WriteLine($"  Physical pulses at the input terminal : {r.PhysicalPulses}");
        Console.WriteLine($"  Rising edges the PLC program detected : {r.PlcDetected}{(r.PlcDetected < r.PhysicalPulses ? "   <- pulse shorter than the scan can fall between input samples" : "")}");
        Console.WriteLine($"  Pulses the poller saw via the live bit : {r.PollerSawBit}{(r.PollerSawBit < r.PlcDetected ? "   <- the poll period missed them" : "")}");
        Console.WriteLine($"  Pulses the poller saw via the counter  : {r.PollerCounterDelta}");
        Console.WriteLine($"  Pulse-to-observation latency (counter): max {r.MaxLatencyMs} ms, mean {r.MeanLatencyMs:F1} ms");
    }
}
