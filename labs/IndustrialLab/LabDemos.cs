namespace IndustrialLab;

// Narrated console walkthroughs for Labs 8 and 10. Read the source alongside the output.
public static class LabDemos
{
    public static void Alarm()
    {
        var t = new DateTimeOffset(2026, 9, 29, 8, 0, 0, TimeSpan.Zero);
        var alarm = new HighAlarm("tank-01.temperature.high", setC: 65, clearC: 63);
        (double Value, string Quality, string? Ack)[] script =
        [
            (64.0, "Good", null), (65.0, "Good", null), (64.0, "Good", null), (64.9, "Good", null),
            (65.2, "Good", null), (0, "", "operator-a"), (66.0, "BadCommunication", null),
            (50.0, "BadCommunication", null), (64.0, "Good", null), (63.0, "Good", null),
            (65.5, "Good", null), (62.0, "Good", null), (0, "", "operator-b")
        ];
        Console.WriteLine("Supervisory high alarm: set 65.0 degC, clear 63.0 degC (2 degC hysteresis).");
        Console.WriteLine("step  input                         state          condition  events");
        int step = 0, seen = 0;
        foreach (var (value, quality, ack) in script)
        {
            t = t.AddSeconds(1); step++;
            string input;
            if (ack is not null) { bool ok = alarm.Acknowledge(ack, t); input = $"ACK by {ack}{(ok ? "" : " (nothing to ack)")}"; }
            else { alarm.Evaluate(value, quality, t); input = $"{value,5:F1} degC {quality}"; }
            string newEvents = string.Join(", ", alarm.Events.Skip(seen).Select(e => e.Transition));
            seen = alarm.Events.Count;
            Console.WriteLine($"{step,4}  {input,-29} {alarm.State,-14} {(alarm.ConditionActive ? "ACTIVE" : "clear"),-9}  {newEvents}");
        }
        Console.WriteLine();
        Console.WriteLine("Notice: 64.0 and 64.9 did not clear the alarm; only 63.0 does (hysteresis). The ACK at step 6 did not clear the condition;");
        Console.WriteLine("the 50.0 reading with bad quality did NOT return the alarm to normal; step 11 re-activated it.");
    }

    public static async Task OutboxAsync()
    {
        string dir = Path.Combine(Path.GetTempPath(), "industrial-lab-outbox-" + Guid.NewGuid().ToString("N")[..8]);
        var evt = new BusinessEvent("batch-2026-0929-017:completed", "BatchCompleted", "2026-0929-017", 100,
            new DateTimeOffset(2026, 9, 29, 10, 15, 0, TimeSpan.Zero));
        try
        {
            foreach (bool dedupe in new[] { false, true })
            {
                string runDir = Path.Combine(dir, dedupe ? "idempotent" : "naive");
                var mes = new IdempotentMesReceiver(deduplicate: dedupe) { LoseNextAcknowledgements = 1 };
                Console.WriteLine(dedupe ? "\n=== Receiver deduplicates by event ID ===" : "=== Receiver WITHOUT deduplication (the bug) ===");
                var outbox = new FileOutbox(runDir);
                outbox.Enqueue(evt);
                Console.WriteLine($"1. Batch completed; event written durably to the outbox. Pending: {outbox.Pending().Count}");
                int delivered = await outbox.DeliverPendingAsync(mes, TimeSpan.FromSeconds(2), default);
                Console.WriteLine($"2. Delivery attempt: MES saved it, but the reply was lost. Delivered: {delivered}. MES total: {mes.TotalQuantity}");
                Console.WriteLine("3. The sender process restarts. A new outbox instance reads the file...");
                outbox = new FileOutbox(runDir);
                Console.WriteLine($"   Pending after restart: {outbox.Pending().Count} (the outcome was unknown, so it is retried)");
                delivered = await outbox.DeliverPendingAsync(mes, TimeSpan.FromSeconds(2), default);
                Console.WriteLine($"4. Retry delivered: {delivered}. MES calls: {mes.Calls}. MES production total: {mes.TotalQuantity} (true value: 100)");
                Console.WriteLine($"   Duplicates ignored by MES: {mes.DuplicatesIgnored}. Pending now: {outbox.Pending().Count}");
            }
            Console.WriteLine("\nConclusion: retries are necessary and duplicates are therefore normal. The receiver's event-ID check,");
            Console.WriteLine("not the sender's hope, is what keeps production counted once.");
        }
        finally { try { Directory.Delete(dir, recursive: true); } catch (IOException) { } }
    }
}
