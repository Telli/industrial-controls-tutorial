using System.Text;
using System.Text.Json;

namespace IndustrialLab;

public sealed record BusinessEvent(string EventId, string EventType, string BatchId, int Quantity, DateTimeOffset OccurredAt);

public interface IMesReceiver
{
    Task ReceiveAsync(BusinessEvent e, CancellationToken ct);
}

// A teaching outbox: an append-only JSON-lines log that survives a process restart.
// A production outbox writes the event in the SAME database transaction as the business change
// (see labs/historian/schema.sql). A separate file cannot give that atomicity; this class
// teaches the delivery half: durable pending state, retry, and acknowledgement records.
public sealed class FileOutbox
{
    private sealed record Line(string Kind, BusinessEvent? Event, string? EventId, DateTimeOffset At);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly string path;
    private readonly object gate = new();
    private readonly Dictionary<string, BusinessEvent> events = new(StringComparer.Ordinal);
    private readonly HashSet<string> delivered = new(StringComparer.Ordinal);
    private readonly List<string> order = new();
    public int RecoveredTornLines { get; }

    public FileOutbox(string directory)
    {
        Directory.CreateDirectory(directory);
        path = Path.Combine(directory, "outbox.jsonl");
        if (!File.Exists(path)) return;
        string[] lines = File.ReadAllLines(path, Encoding.UTF8);
        for (int i = 0; i < lines.Length; i++)
        {
            Line? line;
            try { line = JsonSerializer.Deserialize<Line>(lines[i], Json); }
            catch (JsonException) when (i == lines.Length - 1)
            {
                RecoveredTornLines = 1;   // a crash during the final append; that write never committed
                break;
            }
            catch (JsonException ex) { throw new InvalidDataException($"Outbox line {i + 1} is corrupt; refusing to guess.", ex); }
            if (line?.Kind == "event" && line.Event is not null) Add(line.Event);
            else if (line?.Kind == "delivered" && line.EventId is not null) delivered.Add(line.EventId);
            else throw new InvalidDataException($"Outbox line {i + 1} has an unknown shape.");
        }
        if (RecoveredTornLines > 0)
            // Rewrite without the torn tail so the next append does not glue onto half a line.
            File.WriteAllLines(path, lines[..^1], new UTF8Encoding(false));
    }

    private void Add(BusinessEvent e)
    {
        if (events.TryGetValue(e.EventId, out var existing))
        {
            if (existing != e) throw new InvalidOperationException("Event ID reused with different content.");
            return;
        }
        events.Add(e.EventId, e); order.Add(e.EventId);
    }

    public void Enqueue(BusinessEvent e)
    {
        if (string.IsNullOrWhiteSpace(e.EventId) || e.EventId.Length > 80) throw new ArgumentException("Event ID must contain 1 to 80 characters.");
        lock (gate)
        {
            if (events.TryGetValue(e.EventId, out var existing))
            {
                if (existing != e) throw new InvalidOperationException("Event ID reused with different content.");
                return; // idempotent: the same event is already durable
            }
            Append(new Line("event", e, null, DateTimeOffset.UtcNow));
            Add(e);
        }
    }

    public IReadOnlyList<BusinessEvent> Pending()
    {
        lock (gate) return order.Where(id => !delivered.Contains(id)).Select(id => events[id]).ToArray();
    }

    public async Task<int> DeliverPendingAsync(IMesReceiver receiver, TimeSpan timeout, CancellationToken ct)
    {
        int count = 0;
        foreach (var e in Pending())
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
            deadline.CancelAfter(timeout);
            try { await receiver.ReceiveAsync(e, deadline.Token); }
            catch (Exception ex) when (!ct.IsCancellationRequested && ex is TimeoutException or OperationCanceledException or IOException or HttpRequestException)
            {
                // Outcome unknown: the receiver may or may not have saved it. Keep it pending and retry later.
                break; // preserve order; later events wait behind the failed one
            }
            lock (gate)
            {
                Append(new Line("delivered", null, e.EventId, DateTimeOffset.UtcNow));
                delivered.Add(e.EventId);
            }
            count++;
        }
        return count;
    }

    private void Append(Line line)
    {
        using var file = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read);
        byte[] bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(line, Json) + "\n");
        file.Write(bytes);
        file.Flush(flushToDisk: true); // durable before we report success
    }
}

// The receiving side must deduplicate by event ID; transport retries make duplicates normal.
public sealed class IdempotentMesReceiver(bool deduplicate = true) : IMesReceiver
{
    private readonly Dictionary<string, BusinessEvent> processed = new(StringComparer.Ordinal);
    public int TotalQuantity { get; private set; }
    public int Calls { get; private set; }
    public int DuplicatesIgnored { get; private set; }
    public int LoseNextAcknowledgements { get; set; }   // save, then "time out" before replying
    public int FailNextBeforeSave { get; set; }          // fail before saving anything

    public Task ReceiveAsync(BusinessEvent e, CancellationToken ct)
    {
        Calls++;
        ct.ThrowIfCancellationRequested();
        if (FailNextBeforeSave > 0) { FailNextBeforeSave--; throw new IOException("MES unavailable."); }
        if (deduplicate && processed.TryGetValue(e.EventId, out var previous))
        {
            if (previous != e) throw new InvalidOperationException("Conflicting content for an existing event ID.");
            DuplicatesIgnored++;
        }
        else
        {
            processed[e.EventId] = e;
            TotalQuantity += e.Quantity;
        }
        if (LoseNextAcknowledgements > 0)
        {
            LoseNextAcknowledgements--;
            throw new TimeoutException("MES saved the event but the reply was lost.");
        }
        return Task.CompletedTask;
    }
}
