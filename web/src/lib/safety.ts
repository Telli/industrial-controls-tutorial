// Teaching models for lab 14: layers of protection against a tank overfill, trip-circuit
// failure modes, and simplified SIS reliability arithmetic. Not for safety-system design.

// ---------------------------------------------------------------- layers of protection

export type Voting = '1oo1' | '1oo2' | '2oo3'
export type Outcome = 'running' | 'bpcs' | 'operator' | 'sis' | 'overflow'

export interface OverfillFaults {
  transmitterStuck: boolean // LT-1 freezes at its current reading
  valveStuckOpen: boolean // the BPCS inlet valve does not close
  operatorAbsent: boolean // nobody responds to the high-level alarm
  sisSharesTransmitter: boolean // design flaw: SIS trips on LT-1 instead of its own switches
  sisBypassed: boolean // maintenance override left in place
  failedSwitches: number // SIS level switches failed dangerously (will not detect high level)
}

export const LIMITS = { bpcsStop: 85, alarm: 90, sisTrip: 95, overflow: 100 }

export class OverfillModel {
  level = 60 // % of tank height, the true level
  reading = 60 // what LT-1 reports
  fillRate = 1 // % per second while flow is admitted
  t = 0
  transferring = false
  inletOpen = true // BPCS control valve
  manualClosed = false // closed by the operator
  sdvClosed = false // SIS shutoff valve
  alarmSince: number | null = null
  operatorDelay = 3 // s from alarm to manual closure
  voting: Voting = '2oo3'
  faults: OverfillFaults = { transmitterStuck: false, valveStuckOpen: false, operatorAbsent: false, sisSharesTransmitter: false, sisBypassed: false, failedSwitches: 0 }
  outcome: Outcome = 'running'
  stoppedAt: number | null = null
  log: { t: number; text: string }[] = []

  get flowing() { return this.transferring && this.inletOpen && !this.manualClosed && !this.sdvClosed }
  get switchCount() { return this.voting === '1oo1' ? 1 : this.voting === '1oo2' ? 2 : 3 }
  get switchesRequired() { return this.voting === '2oo3' ? 2 : 1 }
  get workingSwitches() { return Math.max(0, this.switchCount - this.faults.failedSwitches) }
  /** Switch states as the SIS logic sees them. */
  get switchStates(): boolean[] {
    return Array.from({ length: this.switchCount }, (_, i) => i >= this.faults.failedSwitches && this.level >= LIMITS.sisTrip)
  }
  get alarmActive() { return this.reading >= LIMITS.alarm }

  start() {
    if (this.outcome !== 'running') return
    this.transferring = true
    this.note('Transfer started: inlet open, filling at 1 % per second.')
  }

  step(dt: number) {
    if (!this.transferring || this.outcome !== 'running') return
    this.t += dt
    if (this.flowing) this.level = Math.min(LIMITS.overflow, this.level + this.fillRate * dt)
    if (!this.faults.transmitterStuck) this.reading = this.level

    // Layer 1: basic process control closes the inlet at the end-of-transfer level.
    if (this.inletOpen && this.reading >= LIMITS.bpcsStop) {
      if (this.faults.valveStuckOpen) {
        if (!this.log.some(l => l.text.startsWith('BPCS'))) this.note('BPCS commands the inlet valve closed, but the valve is stuck open.')
      } else {
        this.inletOpen = false
        this.finish('bpcs', 'BPCS closed the inlet valve at the end-of-transfer level.')
        return
      }
    }
    // Layer 2: high-level alarm on the same transmitter, then an operator action.
    if (this.alarmActive && this.alarmSince === null) {
      this.alarmSince = this.t
      this.note(`High-level alarm (${LIMITS.alarm} %) raised on LT-1.`)
    }
    if (this.alarmSince !== null && !this.faults.operatorAbsent && this.t - this.alarmSince >= this.operatorDelay && !this.manualClosed) {
      this.manualClosed = true
      this.finish('operator', 'Operator responded to the alarm and closed the manual isolation valve.')
      return
    }
    // Layer 3: the safety instrumented function closes an independent shutoff valve.
    if (!this.faults.sisBypassed) {
      const trip = this.faults.sisSharesTransmitter
        ? this.reading >= LIMITS.sisTrip
        : this.switchStates.filter(Boolean).length >= this.switchesRequired
      if (trip) {
        this.sdvClosed = true
        this.finish('sis', `SIS tripped (${this.faults.sisSharesTransmitter ? 'on LT-1' : this.voting}) and closed the shutoff valve.`)
        return
      }
    }
    if (this.level >= LIMITS.overflow) this.finish('overflow', 'Tank overflowed. Only the bund (secondary containment) is left.')
  }

  private finish(outcome: Outcome, text: string) {
    this.outcome = outcome
    this.stoppedAt = this.level
    this.note(text)
  }

  private note(text: string) {
    this.log.push({ t: this.t, text })
  }
}

// ---------------------------------------------------------------- trip circuits

export type TripDesign = 'de-energize' | 'energize'
export type CircuitFault = 'none' | 'power-lost' | 'wire-broken' | 'demand'

/** Whether the final element ends up in its safe (tripped) state, and whether that was wanted. */
export function tripCircuit(design: TripDesign, fault: CircuitFault) {
  const demand = fault === 'demand'
  const energyAvailable = fault === 'none' || fault === 'demand'
  // De-energize-to-trip: the logic holds the valve open with energy; removing energy trips it.
  // Energize-to-trip: the logic must apply energy to close the valve.
  const tripped = design === 'de-energize' ? !energyAvailable || demand : demand && energyAvailable
  const result = tripped === demand ? 'correct' : tripped ? 'spurious trip (safe failure)' : 'cannot trip (dangerous failure)'
  return { tripped, demand, result }
}

// ---------------------------------------------------------------- reliability

export type Architecture = '1oo1' | '1oo2' | '2oo2' | '2oo3'
export const ARCHITECTURES: Architecture[] = ['1oo1', '1oo2', '2oo2', '2oo3']

export interface ReliabilityInputs {
  lambdaDU: number // dangerous undetected failures per channel per year
  lambdaS: number // spurious (safe) failures per channel per year
  proofTestYears: number // proof-test interval
  beta: number // common-cause fraction, 0..1
  repairHours: number // time to restore a failed channel
}

/**
 * Simplified average probability of failure on demand and spurious trip rate, after the
 * approximations in IEC 61508-6 Annex B, ignoring diagnostics and repair during the test interval.
 */
export function reliability(arch: Architecture, p: ReliabilityInputs) {
  const lt = p.lambdaDU * p.proofTestYears
  const ind = (1 - p.beta) * lt
  const ccf = p.beta * lt / 2
  const mttr = p.repairHours / 8760
  const ls = p.lambdaS
  let pfd: number
  let str: number
  switch (arch) {
    case '1oo1': pfd = lt / 2; str = ls; break
    case '1oo2': pfd = ind * ind / 3 + ccf; str = 2 * ls; break
    case '2oo2': pfd = ind + ccf; str = 2 * ls * ls * mttr + p.beta * ls; break
    case '2oo3': pfd = ind * ind + ccf; str = 6 * ls * ls * mttr + p.beta * ls; break
  }
  return { pfd, str, sil: silFor(pfd), raw: lt / 2 }
}

/** Low-demand SIL band for an average probability of failure on demand. */
export function silFor(pfd: number): number {
  if (pfd < 1e-4) return 4 // values below the SIL 4 band are still reported as 4
  if (pfd < 1e-3) return 3
  if (pfd < 1e-2) return 2
  if (pfd < 1e-1) return 1
  return 0
}
