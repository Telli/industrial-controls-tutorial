using System.Buffers.Binary;

namespace IndustrialLab;

public enum ByteOrder { ABCD, BADC, CDAB, DCBA }

public static class Wire
{
    // Inputs are numeric ushort values already decoded by a Modbus library.
    // Reconstruct wire bytes explicitly; do not call GetBytes(ushort) first.
    private static void ToCanonical(ushort reg0, ushort reg1, ByteOrder order, Span<byte> canonical)
    {
        Span<byte> raw = stackalloc byte[4];
        BinaryPrimitives.WriteUInt16BigEndian(raw[..2], reg0);
        BinaryPrimitives.WriteUInt16BigEndian(raw[2..], reg1);
        switch (order)
        {
            case ByteOrder.ABCD: raw.CopyTo(canonical); break;
            case ByteOrder.BADC:
                canonical[0] = raw[1]; canonical[1] = raw[0];
                canonical[2] = raw[3]; canonical[3] = raw[2]; break;
            case ByteOrder.CDAB:
                canonical[0] = raw[2]; canonical[1] = raw[3];
                canonical[2] = raw[0]; canonical[3] = raw[1]; break;
            case ByteOrder.DCBA:
                canonical[0] = raw[3]; canonical[1] = raw[2];
                canonical[2] = raw[1]; canonical[3] = raw[0]; break;
            default: throw new ArgumentOutOfRangeException(nameof(order));
        }
    }

    public static float DecodeFloat(ushort reg0, ushort reg1, ByteOrder order)
    {
        Span<byte> canonical = stackalloc byte[4];
        ToCanonical(reg0, reg1, order, canonical);
        return BitConverter.Int32BitsToSingle(BinaryPrimitives.ReadInt32BigEndian(canonical));
    }

    // Same permutation, different interpretation: the layout name describes bytes, not the type.
    public static uint DecodeUInt32(ushort reg0, ushort reg1, ByteOrder order)
    {
        Span<byte> canonical = stackalloc byte[4];
        ToCanonical(reg0, reg1, order, canonical);
        return BinaryPrimitives.ReadUInt32BigEndian(canonical);
    }

    // A register is 16 raw bits. Whether it is signed is part of the device contract.
    public static short DecodeInt16(ushort register) => unchecked((short)register);

    public static bool Bit(byte packed, int bit)
    {
        if (bit is < 0 or > 7) throw new ArgumentOutOfRangeException(nameof(bit));
        return (packed & (1 << bit)) != 0;
    }

    public static bool Bit(ushort word, int bit)
    {
        if (bit is < 0 or > 15) throw new ArgumentOutOfRangeException(nameof(bit));
        return (word & (1 << bit)) != 0;
    }

    // Builds a Modbus TCP request: MBAP header (7 bytes including unit) + FC03 PDU (5 bytes).
    public static byte[] BuildFc03Request(ushort transactionId, byte unitId, ushort startOffset, ushort registerCount)
    {
        if (registerCount is < 1 or > 125) throw new ArgumentOutOfRangeException(nameof(registerCount));
        byte[] frame = new byte[12];
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(0), transactionId);
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(2), 0);       // protocol ID: Modbus
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(4), 6);       // unit + function + 4 data bytes
        frame[6] = unitId;
        frame[7] = 0x03;
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(8), startOffset);
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(10), registerCount);
        return frame;
    }

    // Demonstrates framing on a single outstanding FC03 transaction, not a complete driver.
    public static async Task<ushort[]> ReadFc03Async(Stream stream, ushort transactionId,
        byte unitId, int registerCount, CancellationToken cancellationToken)
    {
        if (registerCount is < 1 or > 125) throw new ArgumentOutOfRangeException(nameof(registerCount));
        byte[] prefix = new byte[6];
        await stream.ReadExactlyAsync(prefix, cancellationToken);
        ushort length = BinaryPrimitives.ReadUInt16BigEndian(prefix.AsSpan(4));
        if (length is < 2 or > 254) throw new InvalidDataException("Invalid MBAP length.");
        if (BinaryPrimitives.ReadUInt16BigEndian(prefix) != transactionId ||
            BinaryPrimitives.ReadUInt16BigEndian(prefix.AsSpan(2)) != 0)
            throw new InvalidDataException("Unexpected transaction or protocol ID.");
        byte[] payload = new byte[length]; // length includes unit ID and PDU
        await stream.ReadExactlyAsync(payload, cancellationToken);
        if (payload[0] != unitId) throw new InvalidDataException("Unexpected unit ID.");
        if (payload[1] == 0x83)
        {
            if (length != 3) throw new InvalidDataException("Malformed exception response.");
            throw new InvalidDataException($"Modbus exception 0x{payload[2]:X2}.");
        }
        if (payload[1] != 3 || length != 3 + 2 * registerCount || payload[2] != 2 * registerCount)
            throw new InvalidDataException("Unexpected function or byte count.");
        ushort[] registers = new ushort[registerCount];
        for (int i = 0; i < registerCount; i++)
            registers[i] = BinaryPrimitives.ReadUInt16BigEndian(payload.AsSpan(3 + i * 2));
        return registers;
    }
}
