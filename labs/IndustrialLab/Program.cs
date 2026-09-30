using IndustrialLab;
using ModelContextProtocol.AspNetCore;
using ModelContextProtocol.Server;

// Console-only lab modes. None of them touches a real device.
if (args.Contains("--self-test"))
{
    await SelfTests.RunAsync();
    return;
}
if (args.Contains("--scan-demo"))
{
    // Lab 2: dotnet run --project .\labs\IndustrialLab -- --scan-demo --scan-ms 10 --poll-ms 100 --pulse-ms 15
    ScanSimulator.Print(ScanSimulator.Run(new ScanOptions(
        Cli.Int(args, "--scan-ms", 10), Cli.Int(args, "--poll-ms", 100), Cli.Int(args, "--pulse-ms", 15),
        Cli.Int(args, "--pulses", 50), Cli.Int(args, "--seed", 7), Cli.Int(args, "--phase-ms", 3))));
    return;
}
if (args.Contains("--outbox-demo"))
{
    await LabDemos.OutboxAsync();
    return;
}
if (args.Contains("--alarm-demo"))
{
    LabDemos.Alarm();
    return;
}
if (args.Contains("--poll"))
{
    // Labs 13-14: run the service with --modbus in another terminal first.
    using var stop = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
    await ModbusTankPoller.RunConsoleAsync(new PollerOptions(
        Port: Cli.Int(args, "--port", ModbusDeviceService.Port), PollMs: Cli.Int(args, "--poll-ms", 500),
        TimeoutMs: Cli.Int(args, "--timeout-ms", 1000), ExpectedMapping: (ushort)Cli.Int(args, "--expect-mapping", 1),
        StaleAfterPolls: Cli.Int(args, "--stale-after", 3)), Cli.Int(args, "--count", 0), stop.Token);
    return;
}

bool modbus = args.Contains("--modbus");
var builder = WebApplication.CreateBuilder(args.Where(a => a != "--modbus").ToArray());
// This is a simulation for one local learner, not a remotely accessible plant gateway.
builder.Configuration["AllowedHosts"] = "localhost;127.0.0.1;[::1]";
builder.WebHost.ConfigureKestrel(options => options.ListenLocalhost(5088));
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton<Machine>();
builder.Services.AddSingleton<ModbusTankDevice>();
builder.Services.AddHostedService<SimulationWorker>();
if (modbus) builder.Services.AddHostedService<ModbusDeviceService>(); // loopback 127.0.0.1:5502 only
builder.Services.AddMcpServer()
    .WithHttpTransport(options => options.SessionMode = HttpServerSessionMode.Stateless)
    .WithTools<IndustrialTools>();

var app = builder.Build();
app.Use(async (context, next) =>
{
    // No browser cross-origin access is needed by this teaching service.
    if (context.Request.Headers.ContainsKey("Origin"))
    {
        context.Response.StatusCode = 403;
        return;
    }
    try { await next(context); }
    catch (ArgumentException ex)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        context.Response.StatusCode = 409;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});
app.MapGet("/", () => new { name = "Industrial Controls Study Lab", mode = "SIMULATION ONLY", tools = "/mcp", snapshot = "/api/snapshot",
    alarms = "/api/alarms", modbus = modbus ? $"127.0.0.1:{ModbusDeviceService.Port} unit {TankRegisterMap.UnitId}" : "off (start with --modbus)" });
app.MapGet("/api/snapshot", (Machine machine) => machine.Snapshot());
app.MapGet("/api/history", (Machine machine) => machine.History(20));
app.MapPost("/api/proposals", (ProposalRequest request, Machine machine) => machine.Propose(request));
// Supervisory alarm (Lab 8/9). Acknowledging records attention; it never clears the condition.
app.MapGet("/api/alarms", (Machine machine) => machine.Alarms());
app.MapPost("/api/alarms/ack", (AckRequest request, Machine machine) => new { acknowledged = machine.AcknowledgeAlarm(request.Actor) });
// Fault injection affects only this in-memory simulation. These are not MCP tools.
app.MapPost("/lab/link/{online:bool}", (bool online, Machine machine) => { machine.SetLink(online); return Results.Ok(); });
app.MapPost("/lab/fault/{active:bool}", (bool active, Machine machine) => { machine.SetFault(active); return Results.Ok(); });
app.MapPost("/lab/disturbance/{deltaC:double}", (double deltaC, Machine machine) => { machine.SetDisturbance(deltaC); return Results.Ok(); });
app.MapPost("/lab/modbus/freeze/{frozen:bool}", (bool frozen, ModbusTankDevice device) => { device.Frozen = frozen; return Results.Ok(); });
app.MapPost("/lab/modbus/chunk/{bytes:int}", (int bytes, ModbusTankDevice device) =>
{
    if (bytes is < 0 or > 260) throw new ArgumentException("Chunk size must be from 0 (off) through 260 bytes.");
    device.ChunkBytes = bytes; return Results.Ok();
});
app.MapMcp("/mcp");
await app.RunAsync();

public sealed record AckRequest(string Actor);

static class Cli
{
    public static int Int(string[] args, string name, int fallback)
    {
        int i = Array.IndexOf(args, name);
        if (i < 0) return fallback;
        if (i + 1 >= args.Length || !int.TryParse(args[i + 1], out int value))
            throw new ArgumentException($"{name} needs an integer value.");
        return value;
    }
}
