namespace IndustrialLab;

public sealed record Sample(string AssetId, double TemperatureC, double SetpointC,
    string State, bool AlarmActive, DateTimeOffset SourceTimestamp,
    DateTimeOffset ReceivedTimestamp, long Sequence, string BootId,
    string MappingVersion, string Unit = "degC", bool Simulated = true);
public sealed record SnapshotView(Sample Sample, string Quality, double AgeMs,
    bool CommunicationHealthy, string TimestampOrigin = "Simulator");
public sealed record ProposalRequest(string AssetId, double TargetC, long EvidenceSequence,
    string RequestId, string Reason);
public sealed record Proposal(string ProposalId, ProposalRequest Request, Sample Evidence,
    DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt,
    string Status = "ProposedOnly", bool Executed = false);

public sealed class Machine
{
    private readonly object gate = new();
    private readonly TimeProvider clock;
    private readonly Queue<Sample> samples = new();
    private readonly Dictionary<string, Proposal> proposals = new(StringComparer.Ordinal);
    private readonly string bootId = Guid.NewGuid().ToString("N");
    private long sequence;
    private long receivedTick;
    private double temperature = 25;
    private bool online = true;
    private bool awaitingFresh;
    private bool fault;
    private bool alarm;          // controller-side alarm bit: evaluated on the true temperature
    private double disturbance;  // lab control: shifts the process equilibrium, e.g. a fouled cooling loop
    private Sample latest;
    // Supervisory alarm: evaluated only on received samples, so it must cope with missing evidence.
    private readonly HighAlarm supervisory = new("tank-01.temperature.high", setC: 65, clearC: 63);

    public Machine(TimeProvider clock)
    {
        this.clock = clock;
        latest = NewSample();
        receivedTick = clock.GetTimestamp();
        samples.Enqueue(latest);
    }

    private Sample NewSample() => new("tank-01", temperature, 60,
        fault ? "Fault" : temperature >= 59.5 ? "Holding" : "Heating",
        alarm, clock.GetUtcNow(), clock.GetUtcNow(), ++sequence, bootId, "tank-sim-v1");

    public void Advance(double seconds)
    {
        if (!double.IsFinite(seconds) || seconds <= 0 || seconds > 5)
            throw new ArgumentOutOfRangeException(nameof(seconds));
        lock (gate)
        {
            // Toy thermal model; the equipment evolves even while communications are offline.
            double equilibrium = fault ? 25 : 60 + disturbance;
            temperature = equilibrium + (temperature - equilibrium) * Math.Exp(-seconds / 15);
            if (temperature >= 65) alarm = true;
            else if (temperature <= 63) alarm = false;
            if (!online)
            {
                supervisory.Evaluate(latest.TemperatureC, "BadCommunication", clock.GetUtcNow());
                return;
            }
            latest = NewSample();
            awaitingFresh = false;
            receivedTick = clock.GetTimestamp();
            samples.Enqueue(latest);
            while (samples.Count > 240) samples.Dequeue();
            supervisory.Evaluate(latest.TemperatureC, "Good", latest.ReceivedTimestamp);
        }
    }

    private SnapshotView SnapshotLocked()
    {
        double age = clock.GetElapsedTime(receivedTick).TotalMilliseconds;
        string quality = !online || awaitingFresh ? "BadCommunication" : age > 2000 ? "Stale" : "Good";
        return new(latest, quality, age, online);
    }
    public SnapshotView Snapshot() { lock (gate) return SnapshotLocked(); }
    public Sample[] History(int count)
    {
        if (count is < 1 or > 60) throw new ArgumentOutOfRangeException(nameof(count));
        lock (gate) return samples.TakeLast(count).ToArray();
    }
    public void SetLink(bool value)
    {
        lock (gate)
        {
            if (value != online) awaitingFresh = true;
            online = value;
        }
    }
    public void SetFault(bool value) { lock (gate) fault = value; }
    public void SetDisturbance(double deltaC)
    {
        if (!double.IsFinite(deltaC) || deltaC is < -20 or > 20)
            throw new ArgumentException("Disturbance must be finite and from -20 through 20 degC.");
        lock (gate) disturbance = deltaC;
    }
    public AlarmView Alarms(int recent = 20) { lock (gate) return supervisory.View(recent); }
    public bool AcknowledgeAlarm(string actor) { lock (gate) return supervisory.Acknowledge(actor, clock.GetUtcNow()); }

    public Proposal Propose(ProposalRequest request)
    {
        if (request.AssetId != "tank-01") throw new ArgumentException("Unknown asset.");
        if (!double.IsFinite(request.TargetC) || request.TargetC is < 30 or > 70)
            throw new ArgumentException("Study setpoint must be finite and from 30 through 70 degC.");
        if (string.IsNullOrWhiteSpace(request.RequestId) || request.RequestId.Length > 80)
            throw new ArgumentException("Request ID must contain 1 to 80 characters.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 500)
            throw new ArgumentException("Reason must contain 1 to 500 characters.");
        lock (gate)
        {
            if (proposals.TryGetValue(request.RequestId, out var previous))
            {
                if (previous.Request != request) throw new InvalidOperationException("Request ID reused with different content.");
                return previous; // A replay returns the original expiry; never silently renews it.
            }
            if (proposals.Count >= 1000) throw new InvalidOperationException("Study proposal capacity reached. Restart lab to clear it.");
            var current = SnapshotLocked();
            if (current.Quality != "Good") throw new InvalidOperationException("Fresh good evidence required.");
            if (fault || latest.State == "Fault") throw new InvalidOperationException("Cannot propose during a fault.");
            // Find the exact evidence the agent saw; don't require equality with the latest sample.
            // A 250 ms poll would otherwise invalidate every ordinary multi-second agent turn.
            var evidence = samples.FirstOrDefault(x => x.Sequence == request.EvidenceSequence);
            if (evidence is null || evidence.State == "Fault" || evidence.MappingVersion != latest.MappingVersion)
                throw new InvalidOperationException("Evidence not found or incompatible.");
            // This lab clock is local; production must explicitly handle controller clock uncertainty.
            var evidenceAge = clock.GetUtcNow() - evidence.ReceivedTimestamp;
            if (evidenceAge < TimeSpan.Zero || evidenceAge > TimeSpan.FromSeconds(30))
                throw new InvalidOperationException("Evidence is older than the 30 second study window.");
            var now = clock.GetUtcNow();
            var proposal = new Proposal(Guid.NewGuid().ToString("N"), request, evidence, now, now.AddSeconds(60));
            proposals.Add(request.RequestId, proposal);
            return proposal;
        }
    }
}

public sealed class SimulationWorker(Machine machine, TimeProvider clock) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        long lastTick = clock.GetTimestamp();
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            long now = clock.GetTimestamp();
            double elapsed = clock.GetElapsedTime(lastTick, now).TotalSeconds;
            lastTick = now;
            // A suspended laptop is not a physical simulation; cap one step to five seconds.
            machine.Advance(Math.Clamp(elapsed, 0.0001, 5));
        }
    }
}
