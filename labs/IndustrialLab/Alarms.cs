using System.Text.Json.Serialization;

namespace IndustrialLab;

// Simplified supervisory alarm states, after the ISA-18.2 lifecycle vocabulary.
// Shelving, suppression and out-of-service are deliberately left as extension exercises.
[JsonConverter(typeof(JsonStringEnumConverter<AlarmState>))]
public enum AlarmState { Normal, UnackActive, AckedActive, UnackReturned }

public sealed record AlarmEvent(DateTimeOffset Time, string AlarmId, string Transition,
    AlarmState State, double? Value, string Quality, string? Actor = null);

public sealed record AlarmView(string AlarmId, AlarmState State, bool ConditionActive, bool QualityBad,
    double SetC, double ClearC, AlarmEvent[] RecentEvents);

// Not thread-safe by design: the owner serializes calls (Machine holds its lock).
public sealed class HighAlarm
{
    private readonly List<AlarmEvent> events = new();
    private DateTimeOffset? pendingSince;

    public HighAlarm(string alarmId, double setC, double clearC, TimeSpan onDelay = default)
    {
        if (!double.IsFinite(setC) || !double.IsFinite(clearC) || clearC >= setC)
            throw new ArgumentException("Clear limit must be finite and below the set limit (hysteresis).");
        if (onDelay < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(onDelay));
        AlarmId = alarmId; SetC = setC; ClearC = clearC; OnDelay = onDelay;
    }

    public string AlarmId { get; }
    public double SetC { get; }
    public double ClearC { get; }
    public TimeSpan OnDelay { get; }
    public AlarmState State { get; private set; } = AlarmState.Normal;
    public bool ConditionActive { get; private set; }
    public bool QualityBad { get; private set; }
    public IReadOnlyList<AlarmEvent> Events => events;

    public void Evaluate(double value, string quality, DateTimeOffset time)
    {
        if (quality != "Good" || !double.IsFinite(value))
        {
            // Missing evidence is not a return to normal. Keep the state; report the evidence problem once.
            pendingSince = null;
            if (!QualityBad)
            {
                QualityBad = true;
                Record(time, "QualityBad", double.IsFinite(value) ? value : null, quality);
            }
            return;
        }
        if (QualityBad) { QualityBad = false; Record(time, "QualityRestored", value, quality); }

        if (!ConditionActive)
        {
            if (value < SetC) { pendingSince = null; return; }
            pendingSince ??= time;
            if (time - pendingSince.Value < OnDelay) return;  // must stay above the limit for the whole delay
            pendingSince = null;
            ConditionActive = true;
            State = AlarmState.UnackActive;                    // from Normal, or re-activating an UnackReturned
            Record(time, "Activated", value, quality);
        }
        else if (value <= ClearC)
        {
            ConditionActive = false;
            State = State == AlarmState.AckedActive ? AlarmState.Normal : AlarmState.UnackReturned;
            Record(time, "ReturnedToNormal", value, quality);
        }
    }

    // Acknowledging records that a person saw the alarm. It never clears an active condition.
    public bool Acknowledge(string actor, DateTimeOffset time)
    {
        if (string.IsNullOrWhiteSpace(actor) || actor.Length > 80) throw new ArgumentException("Actor must contain 1 to 80 characters.");
        AlarmState? next = State switch
        {
            AlarmState.UnackActive => AlarmState.AckedActive,
            AlarmState.UnackReturned => AlarmState.Normal,
            _ => null
        };
        if (next is null) return false;
        State = next.Value;
        Record(time, "Acknowledged", null, "n/a", actor);
        return true;
    }

    public AlarmView View(int recent = 20) =>
        new(AlarmId, State, ConditionActive, QualityBad, SetC, ClearC, events.TakeLast(Math.Clamp(recent, 1, 100)).ToArray());

    private void Record(DateTimeOffset time, string transition, double? value, string quality, string? actor = null)
    {
        events.Add(new(time, AlarmId, transition, State, value, quality, actor));
        if (events.Count > 500) events.RemoveAt(0);
    }
}
