// TypeScript port of labs/IndustrialLab/ScanSimulator.cs: field input -> PLC scan -> external poller.
// Deterministic 1 ms model. A teaching model, not a PLC emulator.

export interface ScanOptions {
  scanMs: number
  pollMs: number
  pulseMs: number
  pulses: number
  seed: number
  pollPhaseMs: number
}

export interface ScanResult {
  options: ScanOptions
  input: Uint8Array
  publishedBit: Uint8Array
  publishedCounter: Int32Array
  pulseStarts: number[]
  pollTimes: number[]
  pulseOutcome: { start: number; detected: boolean; sawBit: boolean }[]
  physicalPulses: number
  plcDetected: number
  pollerSawBit: number
  pollerCounterDelta: number
  maxLatencyMs: number
  meanLatencyMs: number
  end: number
}

// Small seeded PRNG (mulberry32); values differ from .NET Random but the model is the same.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function runScan(o: ScanOptions): ScanResult {
  const rand = rng(o.seed)
  const starts: number[] = []
  let t0 = 50
  for (let i = 0; i < o.pulses; i++) {
    starts.push(t0)
    t0 += o.pulseMs + 2 * o.scanMs + 50 + Math.floor(rand() * 300)
  }
  const end = starts[starts.length - 1] + o.pulseMs + 3 * o.scanMs + 2 * o.pollMs
  const input = new Uint8Array(end + 1)
  for (const s of starts) for (let t = s; t < s + o.pulseMs && t <= end; t++) input[t] = 1

  const lastStartAtOrBefore = (t: number) => {
    let s = starts[0]
    for (const x of starts) if (x <= t) s = x
    return s
  }

  const publishedBit = new Uint8Array(end + 1)
  const publishedCounter = new Int32Array(end + 1)
  const detectionPulseStart: number[] = []
  let previousInput = 0
  let imageBit = 0
  let counter = 0
  let imageCounter = 0
  for (let t = 0; t <= end; t++) {
    if (t % o.scanMs === 0) {
      if (t > 0) {
        imageBit = previousInput
        imageCounter = counter
      }
      const sampled = input[t]
      if (sampled && !previousInput) {
        counter++
        detectionPulseStart.push(lastStartAtOrBefore(t))
      }
      previousInput = sampled
    }
    publishedBit[t] = imageBit
    publishedCounter[t] = imageCounter
  }

  let sawBit = 0
  let firstCounter = -1
  let lastCounter = 0
  let assigned = 0
  let lastBit = 0
  const latencies: number[] = []
  const pollTimes: number[] = []
  const pulseSawBit = new Set<number>()
  for (let t = o.pollPhaseMs; t <= end; t += o.pollMs) {
    pollTimes.push(t)
    const bit = publishedBit[t]
    if (bit && !lastBit) {
      sawBit++
      pulseSawBit.add(lastStartAtOrBefore(t))
    }
    lastBit = bit
    const c = publishedCounter[t]
    if (firstCounter < 0) firstCounter = c
    lastCounter = c
    while (assigned < c) latencies.push(t - detectionPulseStart[assigned++])
  }
  const detectedSet = new Set(detectionPulseStart)
  return {
    options: o,
    input,
    publishedBit,
    publishedCounter,
    pulseStarts: starts,
    pollTimes,
    pulseOutcome: starts.map((s) => ({ start: s, detected: detectedSet.has(s), sawBit: pulseSawBit.has(s) })),
    physicalPulses: o.pulses,
    plcDetected: counter,
    pollerSawBit: sawBit,
    pollerCounterDelta: lastCounter - firstCounter,
    maxLatencyMs: latencies.length ? Math.max(...latencies) : 0,
    meanLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    end,
  }
}
