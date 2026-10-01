// Modbus register decoding and framing helpers (mirrors labs/IndustrialLab/Wire.cs).

export type ByteOrder = 'ABCD' | 'BADC' | 'CDAB' | 'DCBA'
export const BYTE_ORDERS: ByteOrder[] = ['ABCD', 'BADC', 'CDAB', 'DCBA']

/** Reconstruct the 4 wire bytes (big-endian per register), then permute into canonical ABCD order. */
export function canonicalBytes(reg0: number, reg1: number, order: ByteOrder): number[] {
  const raw = [(reg0 >> 8) & 0xff, reg0 & 0xff, (reg1 >> 8) & 0xff, reg1 & 0xff]
  switch (order) {
    case 'ABCD': return raw
    case 'BADC': return [raw[1], raw[0], raw[3], raw[2]]
    case 'CDAB': return [raw[2], raw[3], raw[0], raw[1]]
    case 'DCBA': return [raw[3], raw[2], raw[1], raw[0]]
  }
}

const view = (b: number[]) => new DataView(new Uint8Array(b).buffer)

export const decodeFloat = (r0: number, r1: number, o: ByteOrder) => view(canonicalBytes(r0, r1, o)).getFloat32(0, false)
export const decodeUInt32 = (r0: number, r1: number, o: ByteOrder) => view(canonicalBytes(r0, r1, o)).getUint32(0, false)
export const decodeInt16 = (reg: number) => (reg << 16) >> 16

export function encodeFloatAbcd(value: number): [number, number] {
  const dv = new DataView(new ArrayBuffer(4))
  dv.setFloat32(0, value, false)
  return [dv.getUint16(0, false), dv.getUint16(2, false)]
}

export const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0')

export interface FrameField { name: string; from: number; to: number; note: string }
export interface Fc03Frame { bytes: number[]; fields: FrameField[] }

const w16 = (v: number) => [(v >> 8) & 0xff, v & 0xff]

export function buildFc03Request(transactionId: number, unitId: number, start: number, count: number): Fc03Frame {
  const bytes = [...w16(transactionId), 0, 0, ...w16(6), unitId, 0x03, ...w16(start), ...w16(count)]
  return {
    bytes,
    fields: [
      { name: 'Transaction ID', from: 0, to: 2, note: 'Echoed by the server so replies can be matched to requests.' },
      { name: 'Protocol ID', from: 2, to: 4, note: 'Always 0 for Modbus.' },
      { name: 'Length', from: 4, to: 6, note: 'Bytes that follow: unit + function + data (6 here).' },
      { name: 'Unit ID', from: 6, to: 7, note: 'Slave address behind a gateway; often 1 or 255 on direct TCP.' },
      { name: 'Function', from: 7, to: 8, note: '0x03 = Read Holding Registers.' },
      { name: 'Start offset', from: 8, to: 10, note: 'Zero-based register offset (40001 is offset 0).' },
      { name: 'Quantity', from: 10, to: 12, note: 'Registers to read, 1 to 125.' },
    ],
  }
}

export function buildFc03Response(transactionId: number, unitId: number, registers: number[]): number[] {
  const n = registers.length * 2
  return [...w16(transactionId), 0, 0, ...w16(3 + n), unitId, 0x03, n, ...registers.flatMap(w16)]
}

/**
 * Stream reassembler: feed arbitrary TCP chunks, get complete Modbus frames.
 * A frame is 6 header bytes plus `length` bytes; TCP itself preserves no message boundaries.
 */
export class FrameAssembler {
  private buf: number[] = []
  push(chunk: number[]): number[][] {
    this.buf.push(...chunk)
    const frames: number[][] = []
    while (this.buf.length >= 6) {
      const total = 6 + ((this.buf[4] << 8) | this.buf[5])
      if (this.buf.length < total) break
      frames.push(this.buf.splice(0, total))
    }
    return frames
  }
  get pending(): number { return this.buf.length }
}
