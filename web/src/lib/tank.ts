import { HighAlarm } from './alarm'

export type ControlMode = 'On/off' | 'P' | 'PI'
/** Heat balance: heater power + disturbance - heat lost to ambient. */
export class TankSim {
  temp = 25
  link = true
  fault = false
  disturbance = 0 // external heat load, kW
  setpoint = 60
  mode: ControlMode = 'On/off'
  kp = .08 // output fraction per degree C
  ki = .008 // output fraction per degree C per second
  deadband = 1
  power = 0 // applied output, 0..1
  integral = 0
  t = 0
  lastRx = 0
  seen = 25
  ctrlAlarm = false
  sup = new HighAlarm(65, 63)
  private rxAcc = 0
  private demand = false
  private lastMode: ControlMode = 'On/off'
  readonly maxPower = 12 // kW
  readonly heatCapacity = 12 // kJ / degree C (small teaching vessel)
  readonly loss = .2 // kW / degree C
  get heater() { return this.power > .001 }
  get age() { return this.t - this.lastRx }
  get quality(): 'Good' | 'Stale' | 'BadCommunication' { return !this.link ? 'BadCommunication' : this.age > 2 ? 'Stale' : 'Good' }
  get error() { return this.setpoint - this.temp }
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return
    let left = dt
    while (left > .000001) {
      const h = Math.min(.05, left); left -= h; this.t += h
      if (this.mode !== this.lastMode) { this.integral = 0; this.lastMode = this.mode }
      const error = this.error
      if (this.mode === 'On/off') {
        if (this.temp <= this.setpoint - this.deadband / 2) this.demand = true
        if (this.temp >= this.setpoint + this.deadband / 2) this.demand = false
        this.power = this.demand ? 1 : 0
      } else {
        const p = this.kp * error
        if (this.mode === 'PI' && !this.fault) {
          const candidate = this.integral + this.ki * error * h
          const candidateOutput = p + candidate
          // Conditional integration: don't accumulate error into saturation.
          if ((candidateOutput >= 0 && candidateOutput <= 1) || (candidateOutput > 1 && error < 0) || (candidateOutput < 0 && error > 0)) this.integral = candidate
        }
        this.power = Math.max(0, Math.min(1, p + (this.mode === 'PI' ? this.integral : 0)))
      }
      if (this.fault) this.power = 0
      this.temp += (this.maxPower * this.power + this.disturbance - this.loss * (this.temp - 25)) / this.heatCapacity * h
      if (this.temp >= 65) this.ctrlAlarm = true
      else if (this.temp <= 63) this.ctrlAlarm = false
      this.rxAcc += h
      if (this.rxAcc >= .25 - 1e-9) {
        this.rxAcc = 0
        if (this.link) { this.seen = this.temp; this.lastRx = this.t; this.sup.evaluate(this.seen, 'Good', this.t) }
        else this.sup.evaluate(this.seen, 'Bad', this.t)
      }
    }
  }
}
