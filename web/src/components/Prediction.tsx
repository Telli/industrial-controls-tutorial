import { useId, useState } from 'react'

export default function Prediction({ question, options, answer, explanation }: { question: string; options: string[]; answer: number; explanation: string }) {
  const id = useId()
  const [choice, setChoice] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  return <section className="panel prediction" aria-labelledby={id}><h3 id={id}>Predict → run → inspect → explain</h3><p className="prediction-question">{question}</p><div className="prediction-options" role="group" aria-label="Your prediction">{options.map((o, i) => <button key={o} className={choice === i ? 'chosen' : ''} aria-pressed={choice === i} onClick={() => { setChoice(i); setChecked(false) }}>{o}</button>)}</div><div className="row"><button className="btn small" disabled={choice === null} onClick={() => setChecked(true)}>Check prediction</button><span className="lesson-hint">Try it in the controls, then check your reasoning.</span></div>{checked && <p className="prediction-result" role="status"><b>{choice === answer ? 'That’s right. ' : 'Revisit your prediction. '}</b>{explanation}</p>}</section>
}
