import { useState } from 'react'
import {
  ARCHITECTURES, LIMITS, OverfillModel, reliability, tripCircuit,
  type CircuitFault, type OverfillFaults, type TripDesign, type Voting,
} from '../lib/safety'
import { useLabClock } from '../lib/useLabClock'
import { Seg, Slider, Stat, VizTitle } from '../components/ui'
import Prediction from '../components/Prediction'

const FAULTS: { key: keyof Omit<OverfillFaults, 'failedSwitches'>; label: string; hint: string }[] = [
  { key: 'transmitterStuck', label: 'LT-1 level transmitter stuck', hint: 'Its reading freezes while the tank keeps filling.' },
  { key: 'valveStuckOpen', label: 'BPCS inlet valve stuck open', hint: 'The control system commands it shut; it stays open.' },
  { key: 'operatorAbsent', label: 'No operator response', hint: 'The alarm is raised but nobody acts.' },
  { key: 'sisSharesTransmitter', label: 'SIS uses LT-1 (design flaw)', hint: 'Instead of its own level switches.' },
  { key: 'sisBypassed', label: 'SIS bypassed after maintenance', hint: 'An override left in place.' },
]

// The drawing shows the top half of the tank, 50–100 %, so the limits are far enough apart to read.
const H = 260
const LOW = 50
const y = (pct: number) => 30 + H - (Math.max(LOW, pct) - LOW) / (100 - LOW) * H

function Valve({ x, tag, role, closed, failed }: { x: number; tag: string; role: string; closed: boolean; failed?: boolean }) {
  return (
    <g transform={`translate(${x},60)`}>
      <path d="M-14 -10 L14 10 L14 -10 L-14 10 Z" fill={closed ? 'var(--text)' : 'var(--panel)'} stroke={failed ? 'var(--red)' : 'var(--text)'} strokeWidth="2" />
      <text y="-30" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">{tag}</text>
      <text y="-17" textAnchor="middle" fontSize="10" fill="var(--muted)">{role}</text>
      <text y="28" textAnchor="middle" fontSize="10" fill={failed ? 'var(--red)' : 'var(--muted)'}>{failed ? 'STUCK' : closed ? 'CLOSED' : 'OPEN'}</text>
    </g>
  )
}

export default function SafetyLab() {
  const [m, setModel] = useState(() => new OverfillModel())
  const [running, setRunning] = useState(false)
  const refresh = useLabClock(dt => { m.step(dt); if (m.outcome !== 'running') setRunning(false) }, running)
  const update = (fn: () => void) => { fn(); refresh() }

  const reset = () => {
    const next = new OverfillModel()
    next.faults = { ...m.faults }
    next.voting = m.voting
    next.operatorDelay = m.operatorDelay
    setRunning(false)
    setModel(next)
  }

  // ---------------- layer status, derived from the model
  const stuckBlind = m.faults.transmitterStuck && m.level >= LIMITS.bpcsStop && m.reading < LIMITS.bpcsStop
  const layers = [
    {
      name: 'Basic process control', detail: `LT-1 → close XV-1 at ${LIMITS.bpcsStop} %`,
      status: m.outcome === 'bpcs' ? 'acted' : stuckBlind ? 'blind: LT-1 reading frozen' : m.faults.valveStuckOpen && m.reading >= LIMITS.bpcsStop ? 'failed: valve stuck open' : 'watching',
    },
    {
      name: 'Alarm and operator', detail: `LT-1 alarm at ${LIMITS.alarm} % → close HV-1`,
      status: m.outcome === 'operator' ? 'acted'
        : m.faults.transmitterStuck && m.level >= LIMITS.alarm && !m.alarmActive ? 'blind: no alarm from LT-1'
          : m.alarmSince !== null ? (m.faults.operatorAbsent ? 'failed: no response' : m.outcome !== 'running' ? 'too slow' : 'alarm raised, responding…') : 'watching',
    },
    {
      name: 'Safety instrumented function', detail: m.faults.sisSharesTransmitter ? `LT-1 at ${LIMITS.sisTrip} % → close SDV-1` : `${m.voting} level switches at ${LIMITS.sisTrip} % → close SDV-1`,
      status: m.outcome === 'sis' ? 'tripped' : m.faults.sisBypassed ? 'bypassed'
        : m.level >= LIMITS.sisTrip ? (m.faults.sisSharesTransmitter ? 'blind: shares LT-1' : 'failed: too few working switches') : 'armed',
    },
    { name: 'Bund (containment)', detail: 'Passive wall around the tank', status: m.outcome === 'overflow' ? 'containing the spill' : 'standing by' },
  ]
  const tone = (s: string) => s === 'acted' || s === 'tripped' ? 'good' : s.startsWith('failed') || s.startsWith('blind') || s === 'bypassed' || s === 'too slow' || s.startsWith('containing') ? 'bad' : ''

  // ---------------- trip circuits and reliability
  const [design, setDesign] = useState<TripDesign>('de-energize')
  const [lambdaYears, setLambdaYears] = useState(50) // one dangerous undetected failure per N years per channel
  const [testMonths, setTestMonths] = useState(12)
  const [betaPct, setBetaPct] = useState(10)
  const [spuriousYears, setSpuriousYears] = useState(10)
  const inputs = { lambdaDU: 1 / lambdaYears, lambdaS: 1 / spuriousYears, proofTestYears: testMonths / 12, beta: betaPct / 100, repairHours: 8 }
  const rows = ARCHITECTURES.map(a => ({ arch: a, ...reliability(a, inputs) }))
  const logX = (pfd: number) => Math.max(0, Math.min(1, (Math.log10(pfd) + 5) / 5)) * 560

  return <>
    <Prediction
      question="LT-1 sticks at 60 %. The BPCS, the high-level alarm and the SIS all read LT-1. What stops the tank overflowing?"
      options={['The SIS, because it is a separate layer', 'The operator, when the alarm sounds', 'Nothing until the bund']}
      answer={2}
      explanation="All three layers depend on the same failed instrument, so none of them sees the level rise. Layers of protection only count if they are independent. Tick “LT-1 stuck” and “SIS uses LT-1”, then start the transfer. Untick the design flaw to give the SIS its own switches."
    />

    <div className="panel">
      <h3>Inject failures, then start the transfer</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {FAULTS.map(f => (
          <label key={f.key} className="check-label" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={m.faults[f.key]} onChange={e => update(() => { m.faults[f.key] = e.target.checked })} style={{ marginTop: 5 }} />
            <span className="principle"><b>{f.label}</b><span className="principle-why">{f.hint}</span></span>
          </label>
        ))}
      </div>
      <div className="controls" style={{ marginTop: 18 }}>
        <div className="field"><label>SIS voting</label><Seg label="SIS voting" value={m.voting} options={['1oo1', '1oo2', '2oo3'] as Voting[]} onChange={v => update(() => { m.voting = v; m.faults.failedSwitches = Math.min(m.faults.failedSwitches, m.switchCount) })} /></div>
        <Slider label="Failed level switches" value={m.faults.failedSwitches} min={0} max={m.switchCount} onChange={v => update(() => { m.faults.failedSwitches = v })} />
        <Slider label="Operator response time" value={m.operatorDelay} min={1} max={20} unit=" s" onChange={v => update(() => { m.operatorDelay = v })} />
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn small" disabled={m.transferring} onClick={() => update(() => { m.start(); setRunning(true) })}>Start transfer</button>
        <button className="btn small ghost" disabled={!m.transferring || m.outcome !== 'running'} onClick={() => setRunning(r => !r)} aria-pressed={running}>{running ? 'Pause' : 'Resume'}</button>
        <button className="btn small ghost" onClick={reset}>Reset tank (keep settings)</button>
      </div>
      <p className="lesson-hint" style={{ marginTop: 12, marginBottom: 0 }}>The tank fills at 1 % per second. The alarm sounds at {LIMITS.alarm} %, so an operator has {LIMITS.sisTrip - LIMITS.alarm} s before the SIS setpoint and {LIMITS.overflow - LIMITS.alarm} s before overflow.</p>
    </div>

    <div className="safety-grid">
      <div className="viz">
        <VizTitle title="Storage tank and protection layers" legend={[{ color: 'var(--accent)', label: 'True level' }, { color: 'var(--red)', label: 'LT-1 reading' }]} />
        <svg viewBox="0 0 540 340" role="img" aria-label={`Tank at ${m.level.toFixed(0)} percent, LT-1 reads ${m.reading.toFixed(0)} percent`}>
          {/* bund */}
          <path d="M180 305 V262 M180 305 H360 V262" fill="none" stroke="var(--muted)" strokeWidth="3" strokeDasharray="6 4" />
          {m.outcome === 'overflow' && <rect x="182" y="292" width="176" height="11" fill="var(--red)" opacity=".35" />}
          {/* inlet with three valves in series */}
          <path d="M10 60 H240 V80" fill="none" stroke={m.flowing ? 'var(--accent)' : 'var(--line)'} strokeWidth="6" />
          <Valve x={55} tag="XV-1" role="BPCS" closed={!m.inletOpen} failed={m.faults.valveStuckOpen && m.reading >= LIMITS.bpcsStop} />
          <Valve x={120} tag="HV-1" role="manual" closed={m.manualClosed} />
          <Valve x={185} tag="SDV-1" role="SIS" closed={m.sdvClosed} />
          {/* tank (top half shown) */}
          <rect x="220" y={y(m.level)} width="110" height={290 - y(m.level)} fill="var(--accent)" opacity=".28" />
          <path d="M220 290 V30 H330 V290" fill="none" stroke="var(--text)" strokeWidth="2" />
          <path d="M220 290 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l6 4" fill="none" stroke="var(--muted)" />
          <text x="214" y="294" textAnchor="end" fontSize="10" fill="var(--muted)">{LOW} %</text>
          {m.outcome === 'overflow' && <path d="M330 30 q26 10 22 262" fill="none" stroke="var(--red)" strokeWidth="4" />}
          {[['BPCS stop', LIMITS.bpcsStop], ['Alarm', LIMITS.alarm], ['SIS trip', LIMITS.sisTrip], ['Overflow', LIMITS.overflow]].map(([label, pct]) => (
            <g key={label}>
              <path d={`M214 ${y(pct as number)} H336`} stroke="var(--muted)" strokeDasharray="3 4" />
              <text x="340" y={y(pct as number) + 4} fontSize="11" fill="var(--muted)">{pct} % {label}</text>
            </g>
          ))}
          {/* LT-1 reading marker */}
          <path d={`M432 ${y(m.reading)} l12 -7 v14 z`} fill="var(--red)" />
          <text x="448" y={y(m.reading) + 4} fontSize="11" fill="var(--red)">LT-1 {m.reading.toFixed(0)} %</text>
          {/* SIS level switches */}
          {m.faults.sisSharesTransmitter ? null : m.switchStates.map((on, i) => {
            const failed = i < m.faults.failedSwitches
            return (
              <g key={i} transform={`translate(${236 + i * 22},${y(LIMITS.sisTrip)})`}>
                <circle r="7" fill={failed ? 'var(--panel)' : on ? 'var(--red)' : 'var(--green)'} stroke={failed ? 'var(--red)' : 'var(--text)'} strokeWidth="1.5" />
                {failed && <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="var(--red)" strokeWidth="1.5" />}
              </g>
            )
          })}
          {!m.faults.sisSharesTransmitter && <text x="230" y={y(LIMITS.sisTrip) - 12} fontSize="10" fill="var(--muted)">LSH {m.voting}</text>}
          <text x="275" y="330" textAnchor="middle" fontSize="11" fill="var(--muted)">Tank T-1 · true level {m.level.toFixed(1)} %</text>
        </svg>
      </div>
      <div className="panel layers-panel">
        <h3>Protection layers</h3>
        <ol className="protection-layers">
          {layers.map(l => (
            <li key={l.name}>
              <div><b>{l.name}</b><span className="lesson-hint">{l.detail}</span></div>
              <span className={`badge ${tone(l.status)}`}>{l.status}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>

    <div className="stats">
      <Stat k="True level" n={`${m.level.toFixed(1)} %`} />
      <Stat k="LT-1 reading" n={`${m.reading.toFixed(1)} %`} tone={Math.abs(m.reading - m.level) > 2 ? 'bad' : undefined} s={Math.abs(m.reading - m.level) > 2 ? 'disagrees with the tank' : 'agrees with the tank'} />
      <Stat k="Outcome" n={{ running: m.transferring ? 'Filling' : 'Ready', bpcs: 'Stopped by BPCS', operator: 'Stopped by operator', sis: 'SIS trip', overflow: 'OVERFLOW' }[m.outcome]} tone={m.outcome === 'overflow' ? 'bad' : m.outcome === 'running' ? undefined : 'ok'} s={m.stoppedAt !== null ? `at ${m.stoppedAt.toFixed(1)} %` : undefined} />
    </div>
    <div className="log" aria-live="polite">
      {m.log.length === 0 ? <div>No transfer yet.</div> : m.log.map((l, i) => <div key={i}><span className="t">{l.t.toFixed(1)} s</span>{l.text}</div>)}
    </div>

    <div className="panel">
      <h3>Fail-safe trip circuits</h3>
      <p>A safety function must reach its safe state when it is asked to. Choose how the shutoff valve is driven, then compare what each failure does.</p>
      <Seg label="Trip design" value={design} options={['de-energize', 'energize'] as TripDesign[]} onChange={setDesign} />
      <p className="lesson-hint" style={{ margin: '10px 0 14px' }}>{design === 'de-energize' ? 'De-energize to trip: the logic holds the valve open with power. Removing power, for any reason, closes it.' : 'Energize to trip: the valve stays open until the logic applies power to close it.'}</p>
      <div className="table-scroll"><table className="table">
        <thead><tr><th>Condition</th><th>Valve trips?</th><th>Result</th></tr></thead>
        <tbody>{(['none', 'demand', 'power-lost', 'wire-broken'] as CircuitFault[]).map(f => {
          const r = tripCircuit(design, f)
          return <tr key={f}><td>{{ none: 'Normal operation', demand: 'Genuine high level (demand)', 'power-lost': 'Power supply lost', 'wire-broken': 'Field wire broken' }[f]}</td><td>{r.tripped ? 'Yes' : 'No'}</td><td><span className={`badge ${r.result === 'correct' ? 'good' : r.result.startsWith('cannot') ? 'bad' : 'warn'}`}>{r.result}</span></td></tr>
        })}</tbody>
      </table></div>
    </div>

    <div className="panel">
      <h3>Redundancy, proof testing and common cause</h3>
      <div className="controls">
        <Slider label="Dangerous undetected failure: once per" value={lambdaYears} min={10} max={200} step={5} unit=" yr" onChange={setLambdaYears} />
        <Slider label="Proof-test interval" value={testMonths} min={3} max={60} step={3} unit=" months" onChange={setTestMonths} />
        <Slider label="Common-cause fraction β" value={betaPct} min={0} max={20} unit=" %" onChange={setBetaPct} />
        <Slider label="Spurious failure: once per" value={spuriousYears} min={1} max={50} unit=" yr" onChange={setSpuriousYears} />
      </div>
    </div>
    <div className="viz">
      <VizTitle title="Average probability of failure on demand (log scale) and SIL bands" />
      <svg viewBox="0 0 700 220" role="img" aria-label="Probability of failure on demand for each voting architecture">
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <rect x={120 + i * 112} y="10" width="112" height="170" fill={i % 2 ? 'var(--panel2)' : 'transparent'} opacity=".6" />
            <text x={176 + i * 112} y="200" textAnchor="middle" fontSize="11" fill="var(--muted)">{['SIL 4', 'SIL 3', 'SIL 2', 'SIL 1', 'no SIL'][i]}</text>
            <text x={120 + i * 112} y="214" fontSize="10" fill="var(--muted)">1e-{5 - i}</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.arch}>
            <text x="10" y={42 + i * 40} fontSize="13" fill="var(--text)" fontFamily="var(--mono)">{r.arch}</text>
            <rect x="120" y={28 + i * 40} width={logX(r.pfd)} height="20" rx="3" fill="var(--accent)" />
            <text x={128 + logX(r.pfd)} y={42 + i * 40} fontSize="11" fill="var(--text)">{r.pfd.toExponential(1)}</text>
          </g>
        ))}
      </svg>
    </div>
    <div className="panel">
      <div className="table-scroll"><table className="table">
        <thead><tr><th>Voting</th><th>PFDavg</th><th>SIL band</th><th>Spurious trips</th><th>Common-cause share of PFD</th></tr></thead>
        <tbody>{rows.map(r => {
          const ccf = inputs.beta * inputs.lambdaDU * inputs.proofTestYears / 2
          return <tr key={r.arch}><td>{r.arch}</td><td>{r.pfd.toExponential(2)}</td><td>{r.sil ? `SIL ${r.sil}` : 'below SIL 1'}</td><td>{r.str > 0 ? `1 per ${(1 / r.str).toFixed(r.str > 1 ? 1 : 0)} yr` : '—'}</td><td>{r.arch === '1oo1' ? '—' : `${Math.round(ccf / r.pfd * 100)} %`}</td></tr>
        })}</tbody>
      </table></div>
      <p className="lesson-hint" style={{ marginTop: 12, marginBottom: 0 }}>Simplified average-PFD equations for low-demand mode, ignoring diagnostics and repair during the test interval. A real SIL claim also needs hardware fault tolerance, systematic capability and a verified safety requirements specification (IEC 61511). Use this to build intuition, not to design.</p>
    </div>
    <div className="callout">
      Redundancy only helps while failures are independent. At β = 10 %, the common-cause term usually dominates a 1oo2 or 2oo3 result, which is why diverse sensors, separate wiring and staggered proof tests matter as much as voting. 1oo2 trips on either switch, so it is safest but trips spuriously most often; 2oo3 balances both.
    </div>
  </>
}
