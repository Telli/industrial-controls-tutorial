import { useEffect, useRef, useState } from 'react'
import { HighAlarm, type AlarmState } from '../lib/alarm'
import { Slider, Stat, VizTitle } from '../components/ui'

const N = 300 // samples kept (30 s at 10 Hz)
const W = 1000, H = 280, YMIN = 50, YMAX = 80
const STATE_COLOR: Record<AlarmState, string> = { Normal: 'var(--green)', UnackActive: 'var(--red)', AckedActive: 'var(--accent)', UnackReturned: 'var(--cyan)' }

interface Sim {
  t: number
  values: number[]
  active: boolean[]
  bad: boolean[]
  alarm: HighAlarm
  naiveActive: boolean
  naiveCount: number
  spike: number
}

export default function AlarmLab() {
  const [setPt, setSetPt] = useState(65)
  const [deadband, setDeadband] = useState(2)
  const [onDelay, setOnDelay] = useState(0)
  const [noise, setNoise] = useState(1)
  const [base, setBase] = useState(63.5)
  const [bad, setBad] = useState(false)
  const [running, setRunning] = useState(true)
  const [, setFrame] = useState(0)

  const params = useRef({ setPt, deadband, onDelay, noise, base, bad })
  params.current = { setPt, deadband, onDelay, noise, base, bad }
  const sim = useRef<Sim | null>(null)

  const reset = () => {
    const p = params.current
    sim.current = { t: 0, values: [], active: [], bad: [], alarm: new HighAlarm(p.setPt, p.setPt - p.deadband, p.onDelay), naiveActive: false, naiveCount: 0, spike: 0 }
    setFrame((f) => f + 1)
  }
  if (!sim.current) reset()

  // Rebuild the alarm when its configuration changes; keep history.
  useEffect(() => {
    const s = sim.current
    if (!s) return
    s.alarm = new HighAlarm(setPt, setPt - deadband, onDelay)
    s.naiveCount = 0
    s.naiveActive = false
  }, [setPt, deadband, onDelay])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      const s = sim.current!
      const p = params.current
      s.t += 0.1
      if (s.spike > 0) s.spike -= 0.1
      const v = p.base + Math.sin(s.t / 4) * 2.2 + (Math.random() - 0.5) * 2 * p.noise + (s.spike > 0 ? 6 : 0)
      const q = p.bad ? 'Bad' : 'Good'
      s.alarm.evaluate(v, q, s.t)
      const naive = v >= p.setPt
      if (naive && !s.naiveActive) s.naiveCount++
      s.naiveActive = naive
      s.values.push(v); s.active.push(s.alarm.conditionActive); s.bad.push(p.bad)
      if (s.values.length > N) { s.values.shift(); s.active.shift(); s.bad.shift() }
      setFrame((f) => f + 1)
    }, 100)
    return () => window.clearInterval(id)
  }, [running])

  const s = sim.current!
  const y = (v: number) => H - ((Math.max(YMIN, Math.min(YMAX, v)) - YMIN) / (YMAX - YMIN)) * H
  const x = (i: number) => (i / (N - 1)) * W
  const path = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const activations = s.alarm.events.filter((e) => e.transition === 'Activated').length
  const eventCount = s.alarm.events.length

  // active bands
  const bands: [number, number][] = []
  s.active.forEach((a, i) => {
    const idx = i
    if (a) { const last = bands[bands.length - 1]; if (last && last[1] === idx - 1) last[1] = idx; else bands.push([idx, idx]) }
  })

  const nodes: { st: AlarmState; x: number; y: number }[] = [
    { st: 'Normal', x: 60, y: 50 }, { st: 'UnackActive', x: 260, y: 50 }, { st: 'AckedActive', x: 460, y: 50 }, { st: 'UnackReturned', x: 260, y: 150 },
  ]

  return (
    <>
      <div className="panel">
        <div className="controls">
          <Slider label="Set limit (alarm on)" value={setPt} min={60} max={75} step={0.5} unit=" °C" onChange={setSetPt} />
          <Slider label="Deadband (clear below set − this)" value={deadband} min={0} max={6} step={0.5} unit=" °C" onChange={setDeadband} />
          <Slider label="On-delay" value={onDelay} min={0} max={5} step={0.5} unit=" s" onChange={setOnDelay} />
          <Slider label="Signal noise" value={noise} min={0} max={3} step={0.1} unit=" °C" onChange={setNoise} />
          <Slider label="Process level" value={base} min={55} max={72} step={0.5} unit=" °C" onChange={setBase} />
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn small" onClick={() => { s.spike = 1 }}>Inject 1 s spike</button>
          <button className={`btn small ${bad ? 'danger' : 'ghost'}`} onClick={() => setBad(!bad)} aria-pressed={bad}>{bad ? 'Quality: BAD (link down)' : 'Quality: good'}</button>
          <button className="btn small ghost" onClick={() => s.alarm.acknowledge(s.t)}>Acknowledge</button>
          <button className="btn small ghost" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'}</button>
          <button className="btn small ghost" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="stats">
        <Stat k="State" n={<span style={{ color: STATE_COLOR[s.alarm.state], fontSize: '1.05rem' }}>{s.alarm.state}</span>} s={s.alarm.qualityBad ? 'evidence is bad, state held' : undefined} tone={s.alarm.qualityBad ? 'warn' : undefined} />
        <Stat k="Naive alarms (no deadband)" n={s.naiveCount} tone={s.naiveCount > 3 ? 'bad' : undefined} s="every crossing of the limit" />
        <Stat k="Configured activations" n={activations} tone="ok" s="with deadband and delay" />
        <Stat k="Events logged" n={eventCount} />
      </div>

      <div className="viz">
        <VizTitle title="Last 30 seconds" legend={[
          { color: 'var(--text)', label: 'Signal' }, { color: 'var(--red)', label: 'Set limit' }, { color: 'var(--green)', label: 'Clear limit' }, { color: 'rgba(255,93,108,.3)', label: 'Alarm active' },
        ]} />
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Signal with alarm limits">
          {bands.map(([a, b]) => <rect key={a} x={x(a)} y={0} width={Math.max(2, x(b) - x(a))} height={H} fill="var(--red)" opacity={0.18} />)}
          {s.bad.map((b, i) => b ? <rect key={i} x={x(i)} y={H - 6} width={W / N + 0.5} height={6} fill="var(--accent)" /> : null)}
          <line x1={0} x2={W} y1={y(setPt)} y2={y(setPt)} stroke="var(--red)" strokeDasharray="6 4" />
          <line x1={0} x2={W} y1={y(setPt - deadband)} y2={y(setPt - deadband)} stroke="var(--green)" strokeDasharray="6 4" />
          <path d={path} fill="none" stroke="var(--text)" strokeWidth="2" />
          <text x={W - 6} y={y(setPt) - 6} textAnchor="end" fill="var(--red)" fontSize="12" fontFamily="JetBrains Mono, monospace">set {setPt}</text>
          <text x={W - 6} y={y(setPt - deadband) + 16} textAnchor="end" fill="var(--green)" fontSize="12" fontFamily="JetBrains Mono, monospace">clear {setPt - deadband}</text>
        </svg>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16 }}>
        <div className="viz">
          <VizTitle title="Alarm state machine" />
          <svg viewBox="0 0 640 210" role="img" aria-label="Alarm state machine">
            <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)" /></marker></defs>
            {[
              ['M140,50H240', 'value ≥ set'], ['M340,50H440', 'ack'], ['M300,74V128', 'value ≤ clear'], ['M240,150H100L100,74', 'ack'],
            ].map(([d], i) => <path key={i} d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#ah)" />)}
            <text x="145" y="42" fill="var(--muted)" fontSize="11">≥ set</text>
            <text x="370" y="42" fill="var(--muted)" fontSize="11">ack</text>
            <text x="310" y="106" fill="var(--muted)" fontSize="11">≤ clear</text>
            <text x="150" y="170" fill="var(--muted)" fontSize="11">ack</text>
            <path d="M540,26V10H130V26" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#ah)" />
            <text x="290" y="7" fill="var(--muted)" fontSize="11">≤ clear (already acked)</text>
            {nodes.map((n) => {
              const cur = s.alarm.state === n.st
              return (
                <g key={n.st}>
                  <rect x={n.x - 10} y={n.y - 24} width={cur ? 160 : 160} height={48} rx={10} fill={cur ? STATE_COLOR[n.st] : 'var(--panel)'} fillOpacity={cur ? 0.22 : 1} stroke={STATE_COLOR[n.st]} strokeWidth={cur ? 3 : 1} />
                  <text x={n.x + 70} y={n.y + 5} textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="JetBrains Mono, monospace">{n.st}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="log" style={{ maxHeight: 250 }} aria-live="polite">
          {s.alarm.events.length === 0 && <div>No events yet. Raise the process level toward the limit.</div>}
          {[...s.alarm.events].reverse().map((e, i) => (
            <div key={i}><span className="t">{e.t.toFixed(1)}s</span>{e.transition}{e.value !== null ? ` @ ${e.value.toFixed(1)}` : ''} → {e.state}</div>
          ))}
        </div>
      </div>
      <div className="callout">
        Bad quality is not a return to normal. With the link down the alarm holds its state and records that its evidence is unreliable, exactly like <code>HighAlarm.Evaluate</code> in the C# lab.
      </div>
    </>
  )
}
