// Simplified ISA-18.2-style high alarm (mirrors labs/IndustrialLab/Alarms.cs).

export type AlarmState = 'Normal' | 'UnackActive' | 'AckedActive' | 'UnackReturned'
export type Quality = 'Good' | 'Bad' | 'Stale'
export interface AlarmEvent { t: number; transition: string; state: AlarmState; value: number | null; quality: string }

export class HighAlarm {
  state: AlarmState = 'Normal'
  conditionActive = false
  qualityBad = false
  events: AlarmEvent[] = []
  private pendingSince: number | null = null

  constructor(public setPoint: number, public clearPoint: number, public onDelayS = 0) {}

  evaluate(value: number, quality: Quality, t: number) {
    if (quality !== 'Good') {
      // Missing evidence is not a return to normal: hold the state, flag the evidence problem once.
      this.pendingSince = null
      if (!this.qualityBad) { this.qualityBad = true; this.record(t, 'QualityBad', value, quality) }
      return
    }
    if (this.qualityBad) { this.qualityBad = false; this.record(t, 'QualityRestored', value, quality) }
    if (!this.conditionActive) {
      if (value < this.setPoint) { this.pendingSince = null; return }
      this.pendingSince ??= t
      if (t - this.pendingSince < this.onDelayS) return
      this.pendingSince = null
      this.conditionActive = true
      this.state = 'UnackActive'
      this.record(t, 'Activated', value, quality)
    } else if (value <= this.clearPoint) {
      this.conditionActive = false
      this.state = this.state === 'AckedActive' ? 'Normal' : 'UnackReturned'
      this.record(t, 'ReturnedToNormal', value, quality)
    }
  }

  /** Acknowledging records that a person saw the alarm; it never clears an active condition. */
  acknowledge(t: number): boolean {
    let next: AlarmState | null = null
    if (this.state === 'UnackActive') next = 'AckedActive'
    else if (this.state === 'UnackReturned') next = 'Normal'
    if (!next) return false
    this.state = next
    this.record(t, 'Acknowledged', null, 'Good')
    return true
  }

  private record(t: number, transition: string, value: number | null, quality: string) {
    this.events.push({ t, transition, state: this.state, value, quality })
    if (this.events.length > 40) this.events.shift()
  }
}
