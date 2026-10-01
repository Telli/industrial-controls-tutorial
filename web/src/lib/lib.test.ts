import { describe, expect, it } from 'vitest'
import { runScan } from './scan'
import { FrameAssembler, buildFc03Request, buildFc03Response, decodeFloat, decodeInt16, decodeUInt32, encodeFloatAbcd } from './wire'
import { HighAlarm } from './alarm'

describe('wire', () => {
  it('decodes 25.5 under each byte order', () => {
    const [a, b] = encodeFloatAbcd(25.5)
    expect(decodeFloat(a, b, 'ABCD')).toBe(25.5)
    expect(decodeFloat(b, a, 'CDAB')).toBe(25.5) // word-swapped device
    expect(decodeFloat(0x0000, 0x0000, 'ABCD')).toBe(0)
  })
  it('reads the same bytes as uint32 and int16 sign', () => {
    expect(decodeUInt32(0x0001, 0x0000, 'ABCD')).toBe(65536)
    expect(decodeUInt32(0x0001, 0x0000, 'CDAB')).toBe(1)
    expect(decodeInt16(0xffff)).toBe(-1)
  })
  it('builds the canonical FC03 request', () => {
    expect(buildFc03Request(1, 1, 0, 2).bytes).toEqual([0, 1, 0, 0, 0, 6, 1, 3, 0, 0, 0, 2])
  })
  it('reassembles frames split across TCP chunks', () => {
    const f = buildFc03Response(7, 1, [0x1234, 0x5678])
    const asm = new FrameAssembler()
    expect(asm.push(f.slice(0, 4))).toEqual([])
    expect(asm.push(f.slice(4, 9))).toEqual([])
    expect(asm.push(f.slice(9))).toEqual([f])
    // two frames glued into one chunk
    expect(new FrameAssembler().push([...f, ...f])).toEqual([f, f])
  })
})

describe('scan', () => {
  const base = { scanMs: 10, pollMs: 100, pulseMs: 15, pulses: 50, seed: 7, pollPhaseMs: 3 }
  it('never detects more than physical pulses', () => {
    const r = runScan(base)
    expect(r.plcDetected).toBeLessThanOrEqual(50)
    expect(r.pollerCounterDelta).toBeLessThanOrEqual(r.plcDetected)
  })
  it('a pulse shorter than the scan can be missed entirely', () => {
    const r = runScan({ ...base, scanMs: 50, pulseMs: 5 })
    expect(r.plcDetected).toBeLessThan(r.physicalPulses)
  })
  it('a slow poller misses the live bit but the counter keeps up', () => {
    const r = runScan({ ...base, pollMs: 500 })
    expect(r.pollerSawBit).toBeLessThan(r.plcDetected)
    expect(r.pollerCounterDelta).toBeGreaterThanOrEqual(r.plcDetected - 1)
  })
})

describe('alarm', () => {
  it('uses hysteresis and acknowledgement', () => {
    const a = new HighAlarm(65, 63)
    a.evaluate(64, 'Good', 0)
    expect(a.state).toBe('Normal')
    a.evaluate(66, 'Good', 1)
    expect(a.state).toBe('UnackActive')
    a.evaluate(64, 'Good', 2) // inside the deadband: still active
    expect(a.conditionActive).toBe(true)
    a.evaluate(62, 'Good', 3)
    expect(a.state).toBe('UnackReturned')
    expect(a.acknowledge(4)).toBe(true)
    expect(a.state).toBe('Normal')
  })
  it('bad quality does not clear an active alarm', () => {
    const a = new HighAlarm(65, 63)
    a.evaluate(70, 'Good', 0)
    a.evaluate(20, 'Bad', 1)
    expect(a.conditionActive).toBe(true)
    expect(a.qualityBad).toBe(true)
  })
  it('on-delay filters short spikes', () => {
    const a = new HighAlarm(65, 63, 3)
    a.evaluate(70, 'Good', 0)
    a.evaluate(60, 'Good', 1)
    a.evaluate(70, 'Good', 2)
    a.evaluate(70, 'Good', 4)
    expect(a.conditionActive).toBe(false)
    a.evaluate(70, 'Good', 5)
    expect(a.conditionActive).toBe(true)
  })
})
