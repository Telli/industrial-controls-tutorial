// Teaching model for lab 15: a small pump station with six measurements. Each round injects one
// problem (a slow drift, an alarm or frozen data) and times how long the viewer takes to find it.

export interface Tag {
  id: string
  label: string
  unit: string
  min: number
  max: number
  normal: [number, number]
  alarmHigh: number
  priority: 1 | 2 | 3 // 1 = high
  base: number
}

export const TAGS: Tag[] = [
  { id: 'level', label: 'Tank level', unit: '%', min: 0, max: 100, normal: [30, 75], alarmHigh: 85, priority: 2, base: 55 },
  { id: 'flow', label: 'Outlet flow', unit: 'm³/h', min: 0, max: 60, normal: [28, 42], alarmHigh: 50, priority: 3, base: 35 },
  { id: 'pressure', label: 'Discharge pressure', unit: 'bar', min: 0, max: 10, normal: [4, 6.5], alarmHigh: 8, priority: 2, base: 5.2 },
  { id: 'current', label: 'Motor current', unit: 'A', min: 0, max: 60, normal: [30, 42], alarmHigh: 50, priority: 2, base: 36 },
  { id: 'bearing', label: 'Bearing temperature', unit: '°C', min: 0, max: 120, normal: [40, 70], alarmHigh: 85, priority: 1, base: 58 },
  { id: 'valve', label: 'Discharge valve', unit: '% open', min: 0, max: 100, normal: [40, 80], alarmHigh: 95, priority: 3, base: 62 },
]

export type ProblemKind = 'drift' | 'alarm' | 'stale'
export type DisplayMode = 'legacy' | 'high-performance' | 'custom'

export interface Reading {
  value: number
  history: number[]
  stale: boolean
  age: number
}

export interface RoundResult { mode: DisplayMode; kind: ProblemKind; tag: string; seconds: number; correct: boolean }

/** Deterministic pseudo-random sequence so rounds are reproducible in tests. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class HmiModel {
  t = 0
  readings: Record<string, Reading> = {}
  round: { tag: string; kind: ProblemKind; started: number } | null = null
  results: RoundResult[] = []
  private random: () => number

  constructor(seed = 11) {
    this.random = rng(seed)
    for (const tag of TAGS) this.readings[tag.id] = { value: tag.base, history: Array(40).fill(tag.base), stale: false, age: 0 }
  }

  /** Normal, outside the normal band, or in alarm. */
  status(tag: Tag): 'normal' | 'abnormal' | 'alarm' {
    const v = this.readings[tag.id].value
    if (v >= tag.alarmHigh) return 'alarm'
    if (v < tag.normal[0] || v > tag.normal[1]) return 'abnormal'
    return 'normal'
  }

  startRound(kind?: ProblemKind) {
    for (const tag of TAGS) Object.assign(this.readings[tag.id], { value: tag.base, stale: false, age: 0 })
    const tag = TAGS[Math.floor(this.random() * TAGS.length)]
    const kinds: ProblemKind[] = ['drift', 'alarm', 'stale']
    this.round = { tag: tag.id, kind: kind ?? kinds[Math.floor(this.random() * kinds.length)], started: this.t }
    if (this.round.kind === 'alarm') this.readings[tag.id].value = tag.alarmHigh + (tag.max - tag.alarmHigh) * .3
  }

  step(dt: number) {
    this.t += dt
    for (const tag of TAGS) {
      const r = this.readings[tag.id]
      const span = tag.max - tag.min
      const problem = this.round?.tag === tag.id ? this.round.kind : null
      if (problem === 'stale') { r.stale = true; r.age += dt; continue }
      r.age = 0
      if (problem === 'drift') {
        // Leaves the normal band after ~4–8 s and reaches the alarm limit about 14 s later.
        const target = tag.alarmHigh + (tag.alarmHigh - tag.normal[1]) * .2
        r.value += (target - r.value) * Math.min(1, dt / 8)
      } else if (problem !== 'alarm') {
        r.value += (tag.base - r.value) * Math.min(1, dt / 3)
      }
      r.value = Math.min(tag.max, Math.max(tag.min, r.value + (this.random() - .5) * span * .006))
    }
    for (const tag of TAGS) {
      const r = this.readings[tag.id]
      r.history.push(r.value)
      if (r.history.length > 40) r.history.shift()
    }
  }

  /** The viewer picks the tile they think has the problem. */
  answer(tagId: string, mode: DisplayMode): RoundResult | null {
    if (!this.round) return null
    const result: RoundResult = { mode, kind: this.round.kind, tag: this.round.tag, seconds: this.t - this.round.started, correct: tagId === this.round.tag }
    this.results.push(result)
    this.round = null
    return result
  }

  summary(mode: DisplayMode) {
    const rows = this.results.filter(r => r.mode === mode)
    const correct = rows.filter(r => r.correct)
    return {
      rounds: rows.length,
      correct: correct.length,
      meanSeconds: correct.length ? correct.reduce((a, r) => a + r.seconds, 0) / correct.length : null,
    }
  }
}
