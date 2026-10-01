import { useState } from 'react'
import { TimingModel } from '../lib/plc'
import { useLabClock } from '../lib/useLabClock'
import { Slider, Stat, VizTitle } from '../components/ui'
import Prediction from '../components/Prediction'

export default function TimingLab() {
  const [s, setModel] = useState(() => new TimingModel())
  const [running, setRunning] = useState(false)
  const refresh = useLabClock(dt => s.step(dt), running)
  const update = (fn: () => void) => { fn(); refresh() }
  const traces = ['input', 'ton', 'tof', 'rto'] as const
  const start = s.history[0]?.t ?? 0
  const span = Math.max(5, s.time - start)
  return <>
    <Prediction question="Hold the input true for two seconds, then false for one second. With a three-second preset, which timer keeps its two seconds?" options={['TON', 'RTO', 'All three timers']} answer={1} explanation="RTO retains accumulated time when its rung becomes false. TON clears it. TOF starts its off-delay on the true-to-false transition. A reset instruction clears the retentive timer." />
    <div className="panel"><h3>One input, four different meanings</h3><div className="controls"><Slider label="Timer preset" min={1} max={10} step={.5} value={s.preset} unit=" s" onChange={v => update(() => { s.preset = v })} /><Slider label="Counter preset" min={1} max={10} value={s.counterPreset} unit=" events" onChange={v => update(() => { s.counterPreset = v })} /></div><div className="row" style={{ marginTop: 20 }}><button className={`btn small ${s.input ? 'on' : 'ghost'}`} aria-pressed={s.input} onClick={() => update(() => { s.input = !s.input })}>Input {s.input ? 'ON → turn off' : 'OFF → turn on'}</button><button className="btn small" onClick={() => update(() => s.step(.1))} disabled={running}>Step 100 ms</button><button className="btn small ghost" onClick={() => setRunning(r => !r)} aria-pressed={running}>{running ? 'Pause clock' : 'Run clock'}</button><button className="btn small ghost" onClick={() => update(() => s.step(0, true))}>Reset RTO + counter</button><button className="btn small ghost" onClick={() => { setRunning(false); setModel(new TimingModel()) }}>Restart experiment</button></div><p className="lesson-hint">This model executes every 100 ms. Values change when an instruction is evaluated. Reset evaluates a scan with RES after the timer/counter instructions; it does not reset TOF.</p></div>
    <div className="timer-grid">{s.timers.map(timer => <div className="panel timer-card" key={timer.kind}><div className="timer-title"><h2>{timer.kind}</h2><span>{timer.kind === 'TON' ? 'Delay on' : timer.kind === 'TOF' ? 'Delay off' : 'Retain elapsed time'}</span></div><div className="timer-value">{timer.acc.toFixed(1)}<small> / {s.preset.toFixed(1)} s</small></div><div className="progress-track"><div style={{ width: `${Math.min(100, timer.acc / s.preset * 100)}%` }} /></div><div className="timer-flags">{(['en', 'tt', 'dn'] as const).map(flag => <span key={flag} className={timer[flag] ? 'lit' : ''}>{flag.toUpperCase()} {Number(timer[flag])}</span>)}</div></div>)}</div>
    <div className="stats"><Stat k="CTU accumulator" n={s.count} s={`Preset ${s.counterPreset} · DN ${Number(s.count >= s.counterPreset)}`} tone={s.count >= s.counterPreset ? 'ok' : undefined} /><Stat k="One-shot this scan" n={Number(s.oneShot)} s="false → true edge only" /><Stat k="Simulation clock" n={`${s.time.toFixed(1)} s`} s={`${s.scans} evaluations`} /></div>
    <div className="viz"><VizTitle title="Input and done bits over time" /><svg viewBox="0 0 800 300" role="img" aria-label="Timing traces for the input, TON done, TOF done and RTO done">{traces.map((k, row) => { const y = 48 + row * 63; const path = s.history.map((p, i) => `${i ? 'H' : 'M'}${100 + (p.t - start) / span * 675}${i ? 'V' : ','}${y + (p[k] ? -15 : 15)}`).join(' '); return <g key={k}><text x="14" y={y + 4} fill="var(--muted)" fontSize="13">{k.toUpperCase()}</text><path d={`M100 ${y + 15}H775`} stroke="var(--line)" /><path d={path} fill="none" stroke={row ? 'var(--accent)' : 'var(--green)'} strokeWidth="2.5" /></g> })}<text x="100" y="286" fontSize="11" fill="var(--muted)">{start.toFixed(1)} s</text><text x="775" y="286" textAnchor="end" fontSize="11" fill="var(--muted)">{(start + span).toFixed(1)} s</text></svg></div>
    <div className="callout">A counter records rising edges, not how many scans see a high input. Keep the input on: the counter stays at one while the timers progress. Turn it off and on for the next count. Timer retention here describes rung-false behavior; power-up behavior depends on the controller.</div>
  </>
}
