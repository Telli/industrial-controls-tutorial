import { useMemo, useState } from 'react'
import { runScan } from '../lib/scan'
import { Slider, Stat, VizTitle } from '../components/ui'

const W = 1000
const WINDOW_MS = 1200
const C = { input: 'var(--accent)', scan: 'var(--cyan)', bit: 'var(--cyan)', poll: 'var(--green)', miss: 'var(--red)' }

export default function ScanCycleLab() {
  const [scanMs, setScan] = useState(10)
  const [pollMs, setPoll] = useState(100)
  const [pulseMs, setPulse] = useState(15)
  const [phase, setPhase] = useState(3)
  const [seed, setSeed] = useState(7)
  const [offset, setOffset] = useState(0)

  const r = useMemo(
    () => runScan({ scanMs, pollMs, pulseMs, pulses: 50, seed, pollPhaseMs: Math.min(phase, pollMs - 1) }),
    [scanMs, pollMs, pulseMs, phase, seed],
  )

  const maxOffset = Math.max(0, r.end - WINDOW_MS)
  const off = Math.min(offset, maxOffset)
  const x = (t: number) => ((t - off) / WINDOW_MS) * W
  const inWin = (t: number) => t >= off && t <= off + WINDOW_MS

  // Rows (y centre, height)
  const rows = { input: 56, scan: 130, bit: 204, poll: 278 }

  const stepPath = (arr: Uint8Array | Int32Array, y: number, h: number) => {
    let d = ''
    let prev = -1
    const t1 = Math.min(r.end, off + WINDOW_MS)
    for (let t = Math.floor(off); t <= t1; t++) {
      const v = arr[t] ? 1 : 0
      if (v !== prev) {
        const yy = v ? y - h / 2 : y + h / 2
        d += d ? `L${x(t)},${y + (prev ? -h / 2 : h / 2)}L${x(t)},${yy}` : `M${x(t)},${yy}`
        prev = v
      }
    }
    d += `L${x(t1)},${prev ? y - h / 2 : y + h / 2}`
    return d
  }

  const missedPlc = r.physicalPulses - r.plcDetected
  const missedBit = r.plcDetected - r.pollerSawBit

  const visibleScans: number[] = []
  for (let t = Math.ceil(off / scanMs) * scanMs; t <= off + WINDOW_MS; t += scanMs) visibleScans.push(t)
  const visiblePolls = r.pollTimes.filter(inWin)

  return (
    <>
      <div className="panel">
        <div className="controls">
          <Slider label="PLC scan time" value={scanMs} min={1} max={100} unit=" ms" onChange={setScan} />
          <Slider label="Pulse width" value={pulseMs} min={1} max={200} unit=" ms" onChange={setPulse} />
          <Slider label="Poll period" value={pollMs} min={10} max={1000} step={10} unit=" ms" onChange={setPoll} />
          <Slider label="Poll phase" value={Math.min(phase, pollMs - 1)} min={0} max={pollMs - 1} unit=" ms" onChange={setPhase} />
          <Slider label="Random seed (pulse gaps)" value={seed} min={1} max={99} onChange={setSeed} />
        </div>
      </div>

      <div className="stats">
        <Stat k="Physical pulses" n={r.physicalPulses} s="at the input terminal" />
        <Stat k="PLC detected" n={r.plcDetected} tone={missedPlc ? 'bad' : 'ok'} s={missedPlc ? `${missedPlc} fell between scans` : 'every edge seen'} />
        <Stat k="Poller saw live bit" n={r.pollerSawBit} tone={missedBit > 0 ? 'warn' : 'ok'} s={missedBit > 0 ? `${missedBit} missed by polling` : 'none missed'} />
        <Stat k="Poller counter delta" n={r.pollerCounterDelta} tone="ok" s="counter survives slow polls" />
        <Stat k="Latency (max)" n={`${r.maxLatencyMs} ms`} s={`mean ${r.meanLatencyMs.toFixed(0)} ms`} />
      </div>

      <div className="viz">
        <VizTitle
          title={`Timeline ${Math.round(off)}–${Math.round(off + WINDOW_MS)} ms`}
          legend={[
            { color: C.input, label: 'Field input' },
            { color: C.scan, label: 'PLC scan / image bit' },
            { color: C.poll, label: 'Poller reads' },
          ]}
        />
        <svg viewBox={`0 0 ${W} 330`} role="img" aria-label="Timeline of field input, PLC scans, published image bit and poller reads">
          {[['Field input', rows.input], ['PLC scans', rows.scan], ['Published bit', rows.bit], ['Poller', rows.poll]].map(([l, y]) => (
            <text key={l as string} x={8} y={(y as number) - 34} fill="var(--muted)" fontSize="12" fontFamily="JetBrains Mono, monospace">{l}</text>
          ))}
          {/* pulses, marked if missed by the PLC */}
          {r.pulseOutcome.filter((p) => p.start + pulseMs >= off && p.start <= off + WINDOW_MS).map((p) => (
            <rect key={p.start} x={x(p.start)} y={rows.input - 20} width={Math.max(2, (pulseMs / WINDOW_MS) * W)} height={40}
              fill={p.detected ? C.input : C.miss} opacity={p.detected ? 0.9 : 0.85} rx={2} />
          ))}
          {r.pulseOutcome.filter((p) => !p.detected && inWin(p.start)).map((p) => (
            <text key={'m' + p.start} x={x(p.start)} y={rows.input - 26} fill={C.miss} fontSize="11" fontFamily="JetBrains Mono, monospace">missed</text>
          ))}
          {/* scan ticks */}
          {visibleScans.map((t) => {
            const sampled = r.input[t] === 1
            return (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={rows.scan - 22} y2={rows.scan + 22} stroke={C.scan} strokeOpacity={0.35} />
                <circle cx={x(t)} cy={rows.scan} r={sampled ? 4 : 2} fill={sampled ? C.input : C.scan} opacity={sampled ? 1 : 0.6} />
              </g>
            )
          })}
          {/* published bit */}
          <path d={stepPath(r.publishedBit, rows.bit, 36)} fill="none" stroke={C.bit} strokeWidth="2.5" />
          {/* poller */}
          {visiblePolls.map((t) => {
            const v = r.publishedBit[t] === 1
            return (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={rows.poll - 26} y2={rows.poll + 26} stroke={C.poll} strokeWidth="1.5" strokeOpacity={0.7} />
                <circle cx={x(t)} cy={rows.poll - 26 + (v ? 0 : 52)} r={5} fill={v ? C.poll : 'var(--bg)'} stroke={C.poll} strokeWidth="2" />
                <text x={x(t) + 6} y={rows.poll + 44} fill={C.poll} fontSize="10" fontFamily="JetBrains Mono, monospace">c={r.publishedCounter[t]}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="panel">
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Scrub timeline<span className="v">{Math.round(off)} ms</span></label>
          <input type="range" min={0} max={maxOffset} step={10} value={off} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Scrub timeline" />
        </div>
        <h3>Every pulse, in order</h3>
        <div className="row" style={{ gap: 4 }}>
          {r.pulseOutcome.map((p, i) => {
            const c = !p.detected ? C.miss : p.sawBit ? C.poll : C.input
            return (
              <button key={p.start} title={`pulse ${i + 1}: ${!p.detected ? 'missed by PLC' : p.sawBit ? 'seen by PLC and poller' : 'seen by PLC, missed by live-bit polling'}`}
                aria-label={`pulse ${i + 1}`}
                onClick={() => setOffset(Math.max(0, p.start - 200))}
                style={{ width: 16, height: 26, borderRadius: 4, border: 0, background: c }} />
            )
          })}
        </div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <span className="legend"><span><i style={{ background: C.poll }} />seen by PLC and poller</span>
            <span><i style={{ background: C.input }} />PLC saw it, poller missed the bit</span>
            <span><i style={{ background: C.miss }} />PLC missed it</span></span>
        </p>
      </div>
      <div className="callout">
        A level is a snapshot of a snapshot: the PLC samples the input once per scan, then the poller samples the PLC image once per poll.
        Anything shorter than either period can vanish. A counter records that the event happened, even if you read it late.
      </div>
    </>
  )
}
