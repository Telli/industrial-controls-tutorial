using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;

namespace IndustrialLab;

[McpServerToolType]
public sealed class IndustrialTools(Machine machine)
{
    private static string Json(object value) => JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    [McpServerTool(Name = "get_machine_snapshot", ReadOnly = true),
     Description("Read simulated tank-01. Includes units, sample age, quality and sequence. A fresh read does not prove safety.")]
    public string GetSnapshot() => Json(machine.Snapshot());

    [McpServerTool(Name = "get_recent_samples", ReadOnly = true),
     Description("Read up to 60 recent simulated samples. Missing intervals are not interpolated; timestamps and sequence identify gaps.")]
    public string GetRecentSamples([Description("Number of samples, from 1 to 60.")] int count = 20)
        => Json(machine.History(count));

    [McpServerTool(Name = "propose_setpoint"),
     Description("Create an in-memory study proposal only. NEVER executes or approves a command. tank-01 only, 30 to 70 degC, fresh non-faulted evidence required.")]
    public string ProposeSetpoint(string assetId, double targetC, long evidenceSequence,
        string requestId, string reason)
        => Json(machine.Propose(new(assetId, targetC, evidenceSequence, requestId, reason)));
}
