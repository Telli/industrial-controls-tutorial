// Lab 9 starter: a text dashboard for the simulated tank. It is deliberately plain so that the
// render rules (Chapter 10 deep dive) are the focus. Start the lab service first, then:
//   dotnet run --project .\labs\DashboardStarter
// Keys: A = acknowledge alarm, Q = quit. Uses only the local lab API.
using System.Net.Http.Json;
using System.Text.Json;

Console.OutputEncoding = System.Text.Encoding.UTF8;   // trend glyphs on Windows consoles
using var http = new HttpClient { BaseAddress = new Uri("http://localhost:5088"), Timeout = TimeSpan.FromSeconds(2) };
DateTimeOffset? lastContact = null;
bool interactive = !Console.IsInputRedirected;
int frames = args.Length > 0 && int.TryParse(args[0], out int n) ? n : int.MaxValue; // optional frame count for testing

for (int frame = 0; frame < frames; frame++)
{
    var lines = new List<string> { "TANK-01  ·  SIMULATION  ·  Level 2 unit display (text starter)", new string('─', 64) };
    try
    {
        JsonElement snap = await http.GetFromJsonAsync<JsonElement>("/api/snapshot");
        JsonElement alarms = await http.GetFromJsonAsync<JsonElement>("/api/alarms");
        JsonElement history = await http.GetFromJsonAsync<JsonElement>("/api/history");
        lastContact = DateTimeOffset.Now;
        JsonElement s = snap.GetProperty("sample");
        string quality = snap.GetProperty("quality").GetString()!;
        double ageS = snap.GetProperty("ageMs").GetDouble() / 1000;
        bool good = quality == "Good";
        // Rule: keep the last value visible, but mark it; never replace it with 0.
        lines.Add($"Temperature   {s.GetProperty("temperatureC").GetDouble(),6:F1} {s.GetProperty("unit").GetString()}" +
                  (good ? "" : $"   [{quality.ToUpperInvariant()} — last value, not current]"));
        lines.Add($"Target        {s.GetProperty("setpointC").GetDouble(),6:F1} degC   (requested, not measured)");
        lines.Add($"State         {s.GetProperty("state").GetString()}");
        lines.Add(good ? $"Updated       {ageS:F1} s ago" : $"NO FRESH DATA for {ageS:F1} s (sequence {s.GetProperty("sequence").GetInt64()})");
        lines.Add(new string('─', 64));
        string alarmState = alarms.GetProperty("state").GetString()!;
        lines.Add(alarmState switch
        {
            "UnackActive" => $"!! ALARM  High temperature ≥ {alarms.GetProperty("setC").GetDouble()} degC — press A to acknowledge",
            "AckedActive" => "!  Alarm acknowledged, condition still active",
            "UnackReturned" => "!  Alarm returned to normal while unacknowledged — press A",
            _ => "   No active alarms"
        });
        if (alarms.GetProperty("qualityBad").GetBoolean()) lines.Add("?  Alarm evidence lost: communication quality is bad");
        lines.Add(new string('─', 64));
        lines.Add("Trend (last 20 samples, ▁ low … █ high; ' ' marks a gap over 1 s):");
        lines.Add(Sparkline(history));
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
    {
        lines.Add("SERVICE UNREACHABLE" + (lastContact is null ? "" : $" since {lastContact:HH:mm:ss}") + " — nothing shown is current.");
    }
    if (interactive) Console.Clear();
    lines.ForEach(Console.WriteLine);

    var until = DateTime.UtcNow.AddMilliseconds(500);
    while (DateTime.UtcNow < until)
    {
        if (interactive && Console.KeyAvailable)
        {
            var key = Console.ReadKey(intercept: true).Key;
            if (key == ConsoleKey.Q) return;
            if (key == ConsoleKey.A)
                await http.PostAsJsonAsync("/api/alarms/ack", new { actor = Environment.UserName });
        }
        await Task.Delay(50);
    }
}

static string Sparkline(JsonElement history)
{
    const string blocks = "▁▂▃▄▅▆▇█";
    var rows = history.EnumerateArray()
        .Select(x => (At: x.GetProperty("receivedTimestamp").GetDateTimeOffset(), T: x.GetProperty("temperatureC").GetDouble()))
        .ToList();
    if (rows.Count == 0) return "(no samples)";
    double min = rows.Min(r => r.T), max = rows.Max(r => r.T), span = Math.Max(max - min, 0.1);
    var chars = new List<char>();
    for (int i = 0; i < rows.Count; i++)
    {
        // Samples normally arrive every 250 ms. A longer interval is missing evidence: do not draw across it.
        if (i > 0 && rows[i].At - rows[i - 1].At > TimeSpan.FromSeconds(1)) chars.Add(' ');
        chars.Add(blocks[(int)Math.Round((rows[i].T - min) / span * (blocks.Length - 1))]);
    }
    return $"{new string(chars.ToArray())}   {min:F1}–{max:F1} degC";
}
