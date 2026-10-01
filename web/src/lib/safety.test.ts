import { describe, expect, it } from 'vitest'
import { HmiModel, TAGS } from './hmi'
import { LIMITS, OverfillModel, reliability, silFor, tripCircuit } from './safety'

const run = (m: OverfillModel) => { m.start(); for (let i = 0; i < 2000 && m.outcome === 'running'; i++) m.step(.1); return m }

describe('overfill layers of protection', () => {
  it('stops at the BPCS level when nothing has failed', () => {
    const m = run(new OverfillModel())
    expect(m.outcome).toBe('bpcs')
    expect(m.stoppedAt).toBeCloseTo(LIMITS.bpcsStop, 0)
  })
  it('falls through to the operator, then the SIS', () => {
    const op = new OverfillModel(); op.faults.valveStuckOpen = true
    expect(run(op).outcome).toBe('operator')
    const sis = new OverfillModel(); sis.faults.valveStuckOpen = true; sis.faults.operatorAbsent = true
    expect(run(sis).outcome).toBe('sis')
    expect(sis.stoppedAt).toBeLessThan(LIMITS.overflow)
  })
  it('an operator slower than the process safety time is not a protection layer', () => {
    const slow = new OverfillModel(); slow.faults.valveStuckOpen = true; slow.operatorDelay = 20
    expect(run(slow).outcome).toBe('sis')
  })
  it('a stuck transmitter defeats every layer that shares it', () => {
    const m = new OverfillModel(); m.reading = m.level; m.faults.transmitterStuck = true; m.faults.sisSharesTransmitter = true
    expect(run(m).outcome).toBe('overflow')
    const independent = new OverfillModel(); independent.faults.transmitterStuck = true
    expect(run(independent).outcome).toBe('sis')
  })
  it('2oo3 tolerates one failed switch but not two', () => {
    const one = new OverfillModel(); Object.assign(one.faults, { transmitterStuck: true, failedSwitches: 1 })
    expect(run(one).outcome).toBe('sis')
    const two = new OverfillModel(); Object.assign(two.faults, { transmitterStuck: true, failedSwitches: 2 })
    expect(run(two).outcome).toBe('overflow')
    const oneOoTwo = new OverfillModel(); oneOoTwo.voting = '1oo2'; Object.assign(oneOoTwo.faults, { transmitterStuck: true, failedSwitches: 1 })
    expect(run(oneOoTwo).outcome).toBe('sis')
  })
  it('a bypassed SIS does nothing', () => {
    const m = new OverfillModel(); Object.assign(m.faults, { transmitterStuck: true, sisBypassed: true })
    expect(run(m).outcome).toBe('overflow')
  })
})

describe('trip circuits', () => {
  it('de-energize-to-trip fails safe on power loss', () => {
    expect(tripCircuit('de-energize', 'power-lost').result).toBe('spurious trip (safe failure)')
    expect(tripCircuit('energize', 'power-lost').result).toBe('correct')
    expect(tripCircuit('energize', 'wire-broken').tripped).toBe(false)
    expect(tripCircuit('de-energize', 'demand').result).toBe('correct')
  })
})

describe('reliability arithmetic', () => {
  const p = { lambdaDU: .02, lambdaS: .1, proofTestYears: 1, beta: .1, repairHours: 8 }
  it('matches the simplified formulas', () => {
    expect(reliability('1oo1', p).pfd).toBeCloseTo(.01, 6)
    expect(reliability('1oo2', p).pfd).toBeCloseTo(.018 ** 2 / 3 + .001, 6)
    expect(reliability('2oo3', p).pfd).toBeCloseTo(.018 ** 2 + .001, 6)
    expect(reliability('2oo2', p).pfd).toBeCloseTo(.018 + .001, 6)
  })
  it('redundancy trades spurious trips against failure on demand', () => {
    expect(reliability('1oo2', p).str).toBeGreaterThan(reliability('1oo1', p).str)
    expect(reliability('2oo3', p).str).toBeLessThan(reliability('1oo1', p).str)
    expect(reliability('2oo2', p).pfd).toBeGreaterThan(reliability('1oo1', p).pfd)
  })
  it('common cause dominates redundant architectures', () => {
    const r = reliability('1oo2', p)
    expect(.001 / r.pfd).toBeGreaterThan(.8)
  })
  it('maps PFD to SIL bands', () => {
    expect(silFor(.05)).toBe(1)
    expect(silFor(.005)).toBe(2)
    expect(silFor(5e-4)).toBe(3)
    expect(silFor(5e-5)).toBe(4)
    expect(silFor(.2)).toBe(0)
  })
})

describe('HMI rounds', () => {
  it('a drifting tag leaves its normal band before it alarms', () => {
    const m = new HmiModel(3)
    m.startRound('drift')
    const tag = TAGS.find(t => t.id === m.round!.tag)!
    for (let i = 0; i < 100; i++) m.step(.1)
    expect(m.status(tag)).toBe('abnormal')
    for (const other of TAGS.filter(t => t !== tag)) expect(m.status(other)).toBe('normal')
  })
  it('every drift eventually alarms, so a number-only display can still find it', () => {
    for (const id of TAGS.map(t => t.id)) {
      const m = new HmiModel(1)
      m.startRound('drift'); m.round!.tag = id
      for (let i = 0; i < 400; i++) m.step(.1)
      expect(m.status(TAGS.find(t => t.id === id)!)).toBe('alarm')
    }
  })
  it('stale data freezes and ages', () => {
    const m = new HmiModel(5)
    m.startRound('stale')
    const r = m.readings[m.round!.tag]
    const before = r.value
    for (let i = 0; i < 50; i++) m.step(.1)
    expect(r.value).toBe(before)
    expect(r.age).toBeCloseTo(5, 5)
  })
  it('scores answers per display mode', () => {
    const m = new HmiModel(7)
    m.startRound('alarm')
    m.step(2)
    const right = m.round!.tag
    expect(m.answer(right, 'legacy')!.correct).toBe(true)
    m.startRound('alarm')
    expect(m.answer('nope', 'legacy')!.correct).toBe(false)
    expect(m.summary('legacy')).toEqual({ rounds: 2, correct: 1, meanSeconds: 2 })
  })
})
