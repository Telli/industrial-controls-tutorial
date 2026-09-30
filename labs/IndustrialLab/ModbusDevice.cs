using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;

namespace IndustrialLab;

// The published device contract for Labs 13-14. Offsets are zero-based protocol offsets.
// Human "4xxxx" references (40001 = offset 0) are a documentation convention, not wire data.
public static class TankRegisterMap
{
    public const byte UnitId = 1;
    public const int Count = 10;
    public const ushort MappingVersion = 1;
    public const int TemperatureFloat = 0;   // 0-1  float32, ABCD, degC
    public const int SetpointFloat = 2;      // 2-3  float32, CDAB (low word first), degC
    public const int StatusWord = 4;         // 4    packed bits, see below
    public const int SequenceUInt32 = 5;     // 5-6  uint32, ABCD, low 32 bits of sample sequence
    public const int TemperatureTenths = 7;  // 7    int16, degC x 10, signed
    public const int Heartbeat = 8;          // 8    uint16, advances with every acquisition, wraps
    public const int Mapping = 9;            // 9    uint16, this map's version
    public const int BitHeating = 0, BitHolding = 1, BitFault = 2, BitAlarm = 3, BitSimulated = 15;

    public static ushort[] Build(Sample s)
    {
        var r = new ushort[Count];
        Span<byte> b = stackalloc byte[4];
        BinaryPrimitives.WriteSingleBigEndian(b, (float)s.TemperatureC);          // A B C D
        r[0] = BinaryPrimitives.ReadUInt16BigEndian(b); r[1] = BinaryPrimitives.ReadUInt16BigEndian(b[2..]);
        BinaryPrimitives.WriteSingleBigEndian(b, (float)s.SetpointC);             // stored C D A B
        r[2] = BinaryPrimitives.ReadUInt16BigEndian(b[2..]); r[3] = BinaryPrimitives.ReadUInt16BigEndian(b);
        int status = 1 << BitSimulated;
        if (s.State == "Heating") status |= 1 << BitHeating;
        if (s.State == "Holding") status |= 1 << BitHolding;
        if (s.State == "Fault") status |= 1 << BitFault;
        if (s.AlarmActive) status |= 1 << BitAlarm;
        r[4] = (ushort)status;
        uint seq = unchecked((uint)s.Sequence);
        r[5] = (ushort)(seq >> 16); r[6] = (ushort)seq;
        double tenths = Math.Round(s.TemperatureC * 10, MidpointRounding.AwayFromZero);
        r[7] = unchecked((ushort)(short)Math.Clamp(tenths, short.MinValue, short.MaxValue));
        r[8] = unchecked((ushort)s.Sequence);
        r[9] = MappingVersion;
        return r;
    }
}

// A deliberately small Modbus TCP server for one simulated tank. It supports only
// function 03 on unit 1 and exists to exercise a real socket, framing and failures.
public sealed class ModbusTankDevice(Machine machine)
{
    private readonly object gate = new();
    private ushort[]? frozenImage;
    private int chunkBytes;
    private readonly SemaphoreSlim clientSlots = new(4, 4);

    // Lab faults. Frozen: the device keeps answering but its values stop changing.
    // ChunkBytes > 0: each response is written in small pieces to fragment it on the wire.
    public bool Frozen
    {
        get { lock (gate) return frozenImage is not null; }
        set { lock (gate) frozenImage = value ? TankRegisterMap.Build(machine.Snapshot().Sample) : null; }
    }
    public int ChunkBytes
    {
        get { lock (gate) return chunkBytes; }
        set { if (value is < 0 or > 260) throw new ArgumentOutOfRangeException(nameof(value)); lock (gate) chunkBytes = value; }
    }

    private ushort[] Image()
    {
        lock (gate) return frozenImage ?? TankRegisterMap.Build(machine.Snapshot().Sample); // one consistent snapshot
    }

    public async Task RunAsync(TcpListener listener, CancellationToken ct)
    {
        listener.Start();
        try
        {
            while (!ct.IsCancellationRequested)
            {
                TcpClient client = await listener.AcceptTcpClientAsync(ct);
                if (!await clientSlots.WaitAsync(0, ct)) { client.Dispose(); continue; } // bounded clients
                _ = Task.Run(async () =>
                {
                    try { await ServeAsync(client, ct); }
                    catch (Exception ex) when (ex is IOException or SocketException or OperationCanceledException or ObjectDisposedException or EndOfStreamException) { }
                    finally { client.Dispose(); clientSlots.Release(); }
                }, CancellationToken.None);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        finally { listener.Stop(); }
    }

    private async Task ServeAsync(TcpClient client, CancellationToken ct)
    {
        client.NoDelay = true;
        using NetworkStream stream = client.GetStream();
        byte[] header = new byte[6];
        while (!ct.IsCancellationRequested)
        {
            await stream.ReadExactlyAsync(header, ct);                 // EOF ends the session
            ushort tid = BinaryPrimitives.ReadUInt16BigEndian(header);
            ushort pid = BinaryPrimitives.ReadUInt16BigEndian(header.AsSpan(2));
            ushort len = BinaryPrimitives.ReadUInt16BigEndian(header.AsSpan(4));
            if (pid != 0 || len is < 2 or > 254) return;               // not Modbus framing: drop connection
            byte[] body = new byte[len];
            await stream.ReadExactlyAsync(body, ct);
            // Simulated cable pull: the request is swallowed and no response is sent.
            if (!machine.Snapshot().CommunicationHealthy) continue;
            byte[] response = Handle(tid, body);
            await WriteAsync(stream, response, ct);
        }
    }

    internal byte[] Handle(ushort tid, ReadOnlySpan<byte> body)
    {
        byte unit = body[0], function = body[1];
        if (unit != TankRegisterMap.UnitId) return Exception(tid, unit, function, 0x0B);
        if (function != 0x03) return Exception(tid, unit, function, 0x01);        // illegal function
        if (body.Length != 6) return Exception(tid, unit, function, 0x03);        // illegal data value
        ushort start = BinaryPrimitives.ReadUInt16BigEndian(body[2..]);
        ushort count = BinaryPrimitives.ReadUInt16BigEndian(body[4..]);
        if (count is < 1 or > 125) return Exception(tid, unit, function, 0x03);
        if (start + count > TankRegisterMap.Count) return Exception(tid, unit, function, 0x02); // illegal address
        ushort[] image = Image();
        byte[] frame = new byte[9 + 2 * count];
        BinaryPrimitives.WriteUInt16BigEndian(frame, tid);
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(4), (ushort)(3 + 2 * count));
        frame[6] = unit; frame[7] = 0x03; frame[8] = (byte)(2 * count);
        for (int i = 0; i < count; i++)
            BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(9 + 2 * i), image[start + i]);
        return frame;
    }

    private static byte[] Exception(ushort tid, byte unit, byte function, byte code)
    {
        byte[] frame = new byte[9];
        BinaryPrimitives.WriteUInt16BigEndian(frame, tid);
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(4), 3);
        frame[6] = unit; frame[7] = (byte)(function | 0x80); frame[8] = code;
        return frame;
    }

    private async Task WriteAsync(NetworkStream stream, byte[] response, CancellationToken ct)
    {
        int chunk = ChunkBytes;
        if (chunk == 0) { await stream.WriteAsync(response, ct); return; }
        for (int offset = 0; offset < response.Length; offset += chunk)
        {
            await stream.WriteAsync(response.AsMemory(offset, Math.Min(chunk, response.Length - offset)), ct);
            await stream.FlushAsync(ct);
            await Task.Delay(3, ct); // gives the receiver a chance to observe a partial frame
        }
    }
}

public sealed class ModbusDeviceService(ModbusTankDevice device) : BackgroundService
{
    public const int Port = 5502; // 502 is the registered port; a high port avoids needing elevation.
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => device.RunAsync(new TcpListener(IPAddress.Loopback, Port), stoppingToken);
}
