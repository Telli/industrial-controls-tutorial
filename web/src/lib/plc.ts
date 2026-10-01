/** Small, deterministic teaching models. Times are seconds, not vendor time-base ticks. */
export class MotorModel {
  start = false
  stop = false
  wireHealthy = true
  overloadHealthy = true
  contactorHealthy = true
  stopInstruction: 'XIC' | 'XIO' = 'XIC'
  holdSource: 'Feedback' | 'Command' = 'Feedback'
  command = false
  feedback = false
  pending = false
  scans = 0
  phase: 0 | 1 | 2 = 0
  image = { start: false, stopHealthy: true, overload: true, hold: false }
  get stopTest() { return this.stopInstruction === 'XIC' ? this.image.stopHealthy : !this.image.stopHealthy }
  get branchTest() { return this.image.start || this.image.hold }
  stepPhase() {
    if (this.phase === 0) {
      this.image = { start: this.start, stopHealthy: !this.stop && this.wireHealthy, overload: this.overloadHealthy, hold: this.holdSource === 'Feedback' ? this.feedback : this.command }
      this.phase = 1
    } else if (this.phase === 1) {
      this.pending = this.stopTest && this.image.overload && this.branchTest
      this.phase = 2
    } else {
      this.command = this.pending
      this.feedback = this.command && this.contactorHealthy
      this.scans++
      this.phase = 0
    }
  }
  scan() { do { this.stepPhase() } while (this.phase !== 0) }
}

export type TimerKind = 'TON' | 'TOF' | 'RTO'
export class TimerModel {
  acc = 0
  en = false
  tt = false
  dn = false
  private armed = false
  constructor(public kind: TimerKind) {}
  step(input: boolean, dt: number, preset: number, reset = false) {
    if (!Number.isFinite(dt) || dt < 0 || preset <= 0) return
    this.en = input
    if (this.kind === 'TOF') {
      if (input) { this.armed = true; this.acc = 0; this.dn = true }
      else if (this.armed) { this.acc = Math.min(preset, this.acc + dt); this.dn = this.acc < preset }
      else { this.acc = 0; this.dn = false }
      this.tt = !input && this.dn
    } else {
      if (reset && this.kind === 'RTO') this.acc = 0
      else if (input) this.acc = Math.min(preset, this.acc + dt)
      else if (this.kind === 'TON') this.acc = 0
      this.dn = this.acc >= preset
      this.tt = input && !this.dn && !reset
    }
  }
}
export class TimingModel {
  input = false
  preset = 3
  counterPreset = 3
  count = 0
  scans = 0
  time = 0
  oneShot = false
  private previous = false
  timers = [new TimerModel('TON'), new TimerModel('TOF'), new TimerModel('RTO')]
  history: { t: number; input: boolean; ton: boolean; tof: boolean; rto: boolean; count: number }[] = []
  step(dt: number, reset = false) {
    this.oneShot = this.input && !this.previous
    if (reset) this.count = 0
    else if (this.oneShot) this.count++
    this.previous = this.input
    this.timers.forEach(t => t.step(this.input, dt, this.preset, reset))
    this.time += dt
    this.scans++
    this.history.push({ t: this.time, input: this.input, ton: this.timers[0].dn, tof: this.timers[1].dn, rto: this.timers[2].dn, count: this.count })
    if (this.history.length > 160) this.history.shift()
  }
}

export interface AnalogConfig { actual: number; sensorMin: number; sensorMax: number; configuredMin: number; configuredMax: number; bits: number; noise: number; fault: 'Healthy' | 'Open wire' | 'High signal'; sample: number }
export function scaleAnalog(c: AnalogConfig) {
  if (c.sensorMax <= c.sensorMin || c.configuredMax <= c.configuredMin) throw new Error('Maximum must exceed minimum.')
  const noise = Math.sin(c.sample * 2.39996) * c.noise
  const idealCurrent = 4 + 16 * (c.actual - c.sensorMin) / (c.sensorMax - c.sensorMin)
  const current = c.fault === 'Open wire' ? 0 : c.fault === 'High signal' ? 22 : idealCurrent + noise
  // Explicit module model: 0–24 mA ADC so out-of-range current is observable.
  const maxCount = 2 ** c.bits - 1
  const raw = Math.round(Math.max(0, Math.min(24, current)) / 24 * maxCount)
  const measured = raw / maxCount * 24
  const quality = current < 4 ? 'Below range' : current > 20 ? 'Above range' : 'Good'
  const unguarded = c.configuredMin + (measured - 4) / 16 * (c.configuredMax - c.configuredMin)
  return { current, raw, maxCount, measured, quality, unguarded, value: quality === 'Good' ? unguarded : null, resolution: 24 / maxCount / 16 * (c.configuredMax - c.configuredMin) }
}

export type BatchState = 'Idle' | 'Fill' | 'Mix' | 'Drain' | 'Complete' | 'Fault'
export class BatchModel {
  state: BatchState = 'Idle'
  level = 0
  elapsed = 0
  time = 0
  mixSeconds = 4
  inletBlocked = false
  fault = ''
  log: string[] = []
  get outputs() { return { inlet: this.state === 'Fill', mixer: this.state === 'Mix', drain: this.state === 'Drain' } }
  private transition(state: BatchState) { this.state = state; this.elapsed = 0; this.log = [`${this.time.toFixed(1)} s → ${state}`, ...this.log].slice(0, 10) }
  start() { if (this.state === 'Idle' || this.state === 'Complete') this.transition('Fill') }
  abort() { this.fault = 'Operator stopped the batch. Outputs are off; reset drains the virtual vessel.'; this.transition('Fault') }
  reset() { this.level = 0; this.time = 0; this.fault = ''; this.log = []; this.transition('Idle') }
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return
    let left = dt
    while (left > .000001) {
      const h = Math.min(.05, left); left -= h; this.time += h; this.elapsed += h
      if (this.state === 'Fill') {
        if (!this.inletBlocked) this.level = Math.min(80, this.level + 12 * h)
        if (this.level >= 80) this.transition('Mix')
        else if (this.elapsed >= 12) { this.fault = 'Fill timeout: high level was not reached within 12 seconds.'; this.transition('Fault') }
      } else if (this.state === 'Mix' && this.elapsed >= this.mixSeconds) this.transition('Drain')
      else if (this.state === 'Drain') { this.level = Math.max(0, this.level - 16 * h); if (this.level <= 0) this.transition('Complete') }
    }
  }
}
export interface TrackedPart { id: number; reject: boolean }
export class ShiftModel {
  slots: (TrackedPart | null)[] = Array(6).fill(null)
  bits: boolean[] = Array(6).fill(false)
  nextId = 1
  rejected = 0
  accepted = 0
  mistakes = 0
  last = 'No part has reached the exit.'
  advance(load: 'Good part' | 'Reject part' | 'Empty', missClock = false) {
    const exiting = this.slots[5]
    const decision = this.bits[5]
    if (exiting) {
      if (decision) this.rejected++; else this.accepted++
      const correct = decision === exiting.reject
      if (!correct) this.mistakes++
      this.last = `Part ${exiting.id}: ${decision ? 'rejected' : 'passed'}${correct ? ' correctly' : ' — tracking mismatch'}.`
    }
    const part = load === 'Empty' ? null : { id: this.nextId++, reject: load === 'Reject part' }
    this.slots = [part, ...this.slots.slice(0, 5)]
    if (!missClock) this.bits = [load === 'Reject part', ...this.bits.slice(0, 5)]
  }
}
