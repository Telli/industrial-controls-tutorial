import { useState } from 'react'
import { assessFault, DIAGNOSES, FAULT_CASES, PROBES, type Probe } from '../lib/troubleshoot'

export default function TroubleshootingLab() {
  const [caseIndex, setCaseIndex] = useState(0)
  const [probes, setProbes] = useState<Probe[]>([])
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null)
  const [solved, setSolved] = useState<number[]>([])
  const c = FAULT_CASES[caseIndex]
  const changeCase = (i: number) => { setCaseIndex(i); setProbes([]); setAnswer(''); setResult(null) }
  const diagnose = () => { const r = assessFault(c, probes, answer); setResult(r); if (r.correct) setSolved(s => s.includes(caseIndex) ? s : [...s, caseIndex]) }
  return <>
    <section className="panel prediction"><h3>Predict → inspect → diagnose → explain</h3><div className="fault-case-tabs" role="group" aria-label="Troubleshooting cases">{FAULT_CASES.map((_, i) => <button className={`btn small ${i === caseIndex ? '' : 'ghost'}`} key={i} aria-pressed={i === caseIndex} onClick={() => changeCase(i)}>Case {i + 1}{solved.includes(i) ? ' ✓' : ''}</button>)}</div><h2 className="case-title">{c.title}</h2><p>{c.symptom}</p><p className="lesson-hint">Each case has one fault. Select virtual inspection points to gather evidence before choosing a cause.</p></section>
    <div className="probe-grid">{PROBES.map((probe, i) => <button key={probe} className={probes.includes(probe) ? 'inspected' : ''} aria-pressed={probes.includes(probe)} onClick={() => { setProbes(ps => ps.includes(probe) ? ps : [...ps, probe]); setResult(null) }}><span>0{i + 1}</span><strong>{probe}</strong><small>{probes.includes(probe) ? 'Evidence collected' : 'Inspect this point →'}</small></button>)}</div>
    <div className="panel"><h3>Evidence notebook · {probes.length} / {PROBES.length}</h3>{probes.length === 0 ? <p>No observations yet. Start with a point that could separate two possible causes.</p> : <dl className="evidence-list">{probes.map(probe => <div key={probe}><dt>{probe}</dt><dd>{c.evidence[probe]}</dd></div>)}</dl>}</div>
    <div className="panel"><h3>Your diagnosis</h3><div className="prediction-options" role="group" aria-label="Choose the fault">{DIAGNOSES.map(d => <button key={d} className={answer === d ? 'chosen' : ''} aria-pressed={answer === d} onClick={() => { setAnswer(d); setResult(null) }}>{d}</button>)}</div><div className="row"><button className="btn small" disabled={!answer} onClick={diagnose}>Check diagnosis</button><span className="lesson-hint">{solved.length} of {FAULT_CASES.length} cases solved</span></div>{result && <p role="status" className="prediction-result"><b>{result.correct ? 'Evidence supports your diagnosis. ' : 'Keep investigating. '}</b>{result.message}</p>}{result?.correct && <button className="btn small ghost" onClick={() => changeCase((caseIndex + 1) % FAULT_CASES.length)}>Next case →</button>}</div>
    <div className="callout">Follow the evidence from field device → wiring → channel → tag → logic → load. These are virtual measurements. A green indicator at one point does not prove the rest of the chain is healthy.</div>
  </>
}
