import { lazy, Suspense, useState } from 'react'
import { BatchModel, ShiftModel, type BatchState } from '../lib/plc'
import { useLabClock } from '../lib/useLabClock'
import { Seg, Slider, Stat } from '../components/ui'
import Prediction from '../components/Prediction'
const MachineScene = lazy(() => import('../components/MachineScene'))
const STATES: BatchState[] = ['Idle', 'Fill', 'Mix', 'Drain', 'Complete', 'Fault']

function Batch() {
  const [s] = useState(() => new BatchModel())
  const [running, setRunning] = useState(false)
  const refresh = useLabClock(dt => s.step(dt), running && !['Idle', 'Complete', 'Fault'].includes(s.state))
  const update = (fn: () => void) => { fn(); refresh() }
  const outputs = s.outputs
  return <>
    <Prediction question="The inlet is blocked and the tank never reaches high level. What should advance the process from Fill to Mix?" options={['Elapsed fill time alone', 'Confirmed high level; otherwise a timeout fault', 'The Start button staying on']} answer={1} explanation="Elapsed time does not prove that material arrived. This sequence requires high level, and faults after 12 seconds if it cannot confirm it. The mixer and drain remain off during a fill fault." />
    <div className="panel"><div className="row"><button className="btn small" disabled={!['Idle', 'Complete'].includes(s.state)} onClick={() => { s.start(); setRunning(true); refresh() }}>Start batch</button><button className="btn small ghost" onClick={() => setRunning(r => !r)} disabled={['Idle', 'Complete', 'Fault'].includes(s.state)}>{running ? 'Pause sequence' : 'Resume sequence'}</button><button className="btn small ghost" disabled={running && !['Complete', 'Fault'].includes(s.state)} onClick={() => update(() => s.step(1))}>Advance 1 second</button><button className="btn small danger" disabled={!['Fill', 'Mix', 'Drain'].includes(s.state)} onClick={() => update(() => s.abort())}>Stop batch</button><button className="btn small ghost" onClick={() => { s.reset(); setRunning(false); refresh() }}>Reset batch</button></div><div className="controls" style={{ marginTop: 20 }}><Slider label="Mix duration" value={s.mixSeconds} min={1} max={10} unit=" s" onChange={v => update(() => { s.mixSeconds = v })} /><label className="check-label"><input type="checkbox" checked={s.inletBlocked} onChange={e => update(() => { s.inletBlocked = e.target.checked })} /> Block inlet flow</label></div></div>
    <div className="sequence-states" aria-label="Batch states">{STATES.map(state => <span key={state} className={s.state === state ? 'current' : ''} aria-current={s.state === state ? 'step' : undefined}>{state}</span>)}</div>
    <div className="stats"><Stat k="Current state" n={s.state} tone={s.state === 'Fault' ? 'bad' : undefined} s={`${s.elapsed.toFixed(1)} s in state`} /><Stat k="Tank level" n={`${s.level.toFixed(0)}%`} s="high at 80% · empty at 0%" /><Stat k="Output word" n={`${Number(outputs.drain)}${Number(outputs.mixer)}${Number(outputs.inlet)}`} s="bit 2 drain · bit 1 mix · bit 0 fill" /></div>
    <Suspense fallback={<div className="skeleton">Loading process…</div>}><MachineScene kind="batch" active={outputs.mixer} level={s.level} paused={!running} /></Suspense>
    <div className="panel"><h3>Transition evidence</h3><div className="table-scroll"><table className="table"><thead><tr><th>State</th><th>Outputs</th><th>Advance when</th></tr></thead><tbody><tr><td>Idle</td><td>All off</td><td>Start requested</td></tr><tr><td>Fill</td><td>Inlet on</td><td>Level ≥ 80%; fault at 12 s</td></tr><tr><td>Mix</td><td>Mixer on</td><td>Mix timer reaches preset</td></tr><tr><td>Drain</td><td>Drain on</td><td>Level ≤ 0%</td></tr><tr><td>Complete / Fault</td><td>All off</td><td>Start / reset required</td></tr></tbody></table></div></div>
    {s.fault && <div className="form-error" role="alert">{s.fault}</div>}<div className="log" aria-label="Sequence event log">{s.log.length ? s.log.map((line, i) => <div key={`${i}-${line}`}>{line}</div>) : <div>Start a batch to record transitions.</div>}</div><div className="callout">The output pattern belongs to the current state. Inlet and drain are never commanded together. Reset empties this virtual vessel and clears its history; it is not a physical draining procedure.</div>
  </>
}

function Tracking() {
  const [s, setModel] = useState(() => new ShiftModel())
  const [load, setLoad] = useState<'Good part' | 'Reject part' | 'Empty'>('Reject part')
  const [missClock, setMissClock] = useState(false)
  const [, setVersion] = useState(0)
  const advance = () => { s.advance(load, missClock); setMissClock(false); setVersion(v => v + 1) }
  return <>
    <Prediction question="The conveyor moves one position but its tracking pulse is missed. Will the stored reject bits still identify the right products?" options={['Yes, the bits know each product’s identity.', 'No, physical positions and stored positions can drift apart.', 'Only the newest product is affected.']} answer={1} explanation="A shift register tracks position only when its clock matches physical movement. Missing a pulse displaces the stored decisions. Follow a numbered reject part to the exit to see whether the correct item is rejected." />
    <div className="panel"><h3>Load and advance one position</h3><Seg label="Next conveyor input" value={load} options={['Good part', 'Reject part', 'Empty']} onChange={setLoad} /><div className="row" style={{ marginTop: 18 }}><button className="btn small" onClick={advance}>Advance conveyor</button><button className="btn small ghost" onClick={() => { setModel(new ShiftModel()); setMissClock(false) }}>Reset tracking</button><label className="check-label"><input type="checkbox" checked={missClock} onChange={e => setMissClock(e.target.checked)} /> Miss next tracking pulse</label></div></div>
    <Suspense fallback={<div className="skeleton">Loading conveyor…</div>}><MachineScene kind="conveyor" slots={s.slots} /></Suspense>
    <div className="panel"><h3>Presence and reject decision by position</h3><div className="tracking-slots">{s.slots.map((part, i) => <div key={i}><small>POS {i}</small><strong className={part?.reject ? 'reject-part' : ''}>{part ? `#${part.id}` : '—'}</strong><span>{part ? part.reject ? 'reject part' : 'good part' : 'empty'}</span><b className={s.bits[i] ? 'reject-part' : ''}>bit {Number(s.bits[i])}</b></div>)}</div><p className="lesson-hint">Position 0 is the entry; position 5 exits on the next advance. Red boxes are known reject parts. A zero bit can mean a good part or an empty position; the presence row distinguishes them.</p></div>
    <div className="stats"><Stat k="Parts passed" n={s.accepted} /><Stat k="Parts rejected" n={s.rejected} /><Stat k="Wrong decisions" n={s.mistakes} tone={s.mistakes ? 'bad' : 'ok'} /></div><div className="callout" role="status">{s.last}</div>
  </>
}
export default function SequenceLab() {
  const [mode, setMode] = useState<'Batch sequence' | 'Part tracking'>('Batch sequence')
  return <><div className="row"><Seg label="Sequence experiment" value={mode} options={['Batch sequence', 'Part tracking']} onChange={setMode} /></div>{mode === 'Batch sequence' ? <Batch /> : <Tracking />}</>
}
