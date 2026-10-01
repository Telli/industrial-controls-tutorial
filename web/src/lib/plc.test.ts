import { describe, expect, it } from 'vitest'
import { BatchModel, MotorModel, scaleAnalog, ShiftModel, TimingModel } from './plc'
import { TankSim } from './tank'
import { assessFault, FAULT_CASES } from './troubleshoot'

describe('PLC scan and physical feedback', () => {
  it('samples inputs before execution and writes outputs afterwards', () => {
    const m = new MotorModel()
    m.start = true; m.stepPhase(); m.start = false
    expect(m.image.start).toBe(true); expect(m.command).toBe(false)
    m.stepPhase(); expect(m.pending).toBe(true); expect(m.feedback).toBe(false)
    m.stepPhase(); expect(m.feedback).toBe(true)
    m.scan(); expect(m.feedback).toBe(true)
    m.wireHealthy = false; m.scan(); expect(m.feedback).toBe(false)
  })
  it('a command cannot prove that the contactor operated', () => {
    const m = new MotorModel(); m.contactorHealthy = false; m.start = true; m.scan()
    expect(m.command).toBe(true); expect(m.feedback).toBe(false)
    m.start = false; m.scan(); expect(m.command).toBe(false)
    m.holdSource = 'Command'; m.start = true; m.scan(); m.start = false; m.scan()
    expect(m.command).toBe(true); expect(m.feedback).toBe(false)
  })
  it('inverting the stop test produces different behavior', () => {
    const m = new MotorModel(); m.stopInstruction = 'XIO'; m.start = true; m.scan()
    expect(m.command).toBe(false)
    m.stop = true; m.scan(); expect(m.command).toBe(true)
  })
})

describe('timer and edge behavior', () => {
  it('separates TON reset, TOF off-delay and RTO retention', () => {
    const s = new TimingModel(); s.input = true; s.step(2)
    expect(s.timers.map(t => t.dn)).toEqual([false, true, false])
    s.input = false; s.step(1)
    expect(s.timers.map(t => t.acc)).toEqual([0, 1, 2])
    expect(s.timers[1].tt).toBe(true)
    s.step(2); expect(s.timers[1].dn).toBe(false)
    s.input = true; s.step(1)
    expect(s.timers.map(t => t.dn)).toEqual([false, true, true])
    s.step(0, true); expect(s.timers[2].acc).toBe(0); expect(s.count).toBe(0)
  })
  it('counts edges once and does not invent a new edge after RES', () => {
    const s = new TimingModel(); s.input = true
    for (let i = 0; i < 40; i++) s.step(.1)
    expect(s.count).toBe(1); expect(s.oneShot).toBe(false)
    s.step(0, true); s.step(.1); expect(s.count).toBe(0)
    s.input = false; s.step(.1); s.input = true; s.step(.1)
    expect(s.count).toBe(1); expect(s.oneShot).toBe(true)
  })
  it('does not create an off-delay pulse before the input has been true', () => {
    const s = new TimingModel(); s.step(1)
    expect(s.timers[1].dn).toBe(false); expect(s.timers[1].tt).toBe(false)
  })
})

const analog = { actual: 50, sensorMin: 0, sensorMax: 100, configuredMin: 0, configuredMax: 100, bits: 16, noise: 0, fault: 'Healthy' as const, sample: 1 }
describe('analog measurement contract', () => {
  it('maps the current midpoint into the configured range', () => {
    const a = scaleAnalog(analog); expect(a.current).toBe(12); expect(a.value).toBeCloseTo(50, 1)
    expect(scaleAnalog({ ...analog, configuredMax: 200 }).value).toBeCloseTo(100, 1)
  })
  it('rejects electrical faults instead of displaying plausible math', () => {
    const a = scaleAnalog({ ...analog, fault: 'Open wire' })
    expect(a.raw).toBe(0); expect(a.value).toBeNull(); expect(a.unguarded).toBe(-25)
    expect(scaleAnalog({ ...analog, fault: 'High signal' }).quality).toBe('Above range')
  })
  it('bounds rounding error and rejects degenerate scaling', () => {
    const a = scaleAnalog({ ...analog, bits: 8 })
    expect(Math.abs(a.value! - 50)).toBeLessThanOrEqual(a.resolution / 2 + 1e-9)
    expect(() => scaleAnalog({ ...analog, configuredMax: 0 })).toThrow()
  })
})

describe('closed-loop heat balance', () => {
  it('holds the setpoint with PI, while P has steady-state offset', () => {
    const pi = new TankSim(); pi.mode = 'PI'; pi.step(600)
    expect(pi.temp).toBeCloseTo(60, 1); expect(pi.power).toBeCloseTo(7 / 12, 2)
    const p = new TankSim(); p.mode = 'P'; p.step(600)
    expect(p.temp).toBeLessThan(56); expect(p.temp).toBeGreaterThan(50)
  })
  it('on/off cycles around its deadband', () => {
    const s = new TankSim(); s.step(300)
    const values = []
    for (let i = 0; i < 200; i++) { s.step(.1); values.push(s.temp) }
    expect(Math.min(...values)).toBeGreaterThan(59.3); expect(Math.max(...values)).toBeLessThan(60.7)
  })
  it('a heater trip removes power and actually cools the process', () => {
    const s = new TankSim(); s.mode = 'PI'; s.step(300); const before = s.temp
    s.fault = true; s.step(30)
    expect(s.power).toBe(0); expect(s.temp).toBeLessThan(before - 5)
  })
  it('keeps physical control working while the supervisory value freezes', () => {
    const s = new TankSim(); s.step(10); const seen = s.seen
    s.link = false; s.step(30)
    expect(s.seen).toBe(seen); expect(s.temp).toBeGreaterThan(seen); expect(s.quality).toBe('BadCommunication')
    s.link = true; s.step(.5); expect(s.seen).toBeCloseTo(s.temp, 1); expect(s.quality).toBe('Good')
  })
  it('does not wind up against an unattainable setpoint', () => {
    const s = new TankSim(); s.mode = 'PI'; s.setpoint = 120; s.step(600)
    expect(s.power).toBe(1); expect(Math.abs(s.integral)).toBeLessThan(1)
    s.setpoint = 50; s.step(.5); expect(s.power).toBe(0)
  })
  it('responds to an external load and is independent of caller step size', () => {
    const a = new TankSim(); a.mode = 'PI'; a.disturbance = -3; a.step(600)
    expect(a.temp).toBeCloseTo(60, 1); expect(a.power).toBeCloseTo(10 / 12, 2)
    const b = new TankSim(); const c = new TankSim(); b.step(10)
    for (let i = 0; i < 100; i++) c.step(.1)
    expect(b.temp).toBeCloseTo(c.temp, 8)
  })
})

describe('sequencing and positional tracking', () => {
  it('requires high level before mixing and closes conflicting outputs', () => {
    const s = new BatchModel(); s.start()
    for (let i = 0; i < 200; i++) { s.step(.1); expect(s.outputs.inlet && s.outputs.drain).toBe(false); if (s.state === 'Mix') expect(s.level).toBe(80) }
    expect(s.state).toBe('Complete'); expect(s.level).toBe(0)
  })
  it('blocked flow times out with all outputs off and requires reset', () => {
    const s = new BatchModel(); s.inletBlocked = true; s.start(); s.step(13)
    expect(s.state).toBe('Fault'); expect(s.outputs).toEqual({ inlet: false, mixer: false, drain: false })
    s.start(); expect(s.state).toBe('Fault'); s.reset(); expect(s.state).toBe('Idle')
  })
  it('rejects the correct part only if the shift clock follows movement', () => {
    const s = new ShiftModel(); s.advance('Reject part')
    for (let i = 0; i < 6; i++) s.advance('Empty')
    expect(s.rejected).toBe(1); expect(s.mistakes).toBe(0)
    const faulty = new ShiftModel(); faulty.advance('Reject part')
    faulty.advance('Empty', true)
    for (let i = 0; i < 5; i++) faulty.advance('Empty')
    expect(faulty.accepted).toBe(1); expect(faulty.mistakes).toBe(1)
  })
})

describe('evidence-based fault diagnosis', () => {
  it.each(FAULT_CASES)('requires supporting evidence for $answer', c => {
    expect(assessFault(c, [], c.answer).correct).toBe(false)
    expect(assessFault(c, c.required, 'Unrelated fault').correct).toBe(false)
    expect(assessFault(c, c.required, c.answer).correct).toBe(true)
  })
})
