import { useMemo, useState } from 'react'
import { VizTitle } from '../components/ui'

type Q = 'legacy' | 'model' | 'secure' | 'fanout' | 'wan' | 'poll'
const QUESTIONS: { k: Q; label: string; hint: string }[] = [
  { k: 'legacy', label: 'Legacy device or meter', hint: 'Only speaks simple register reads.' },
  { k: 'model', label: 'Needs browsing and typed data', hint: 'Engineering units, structure, discovery.' },
  { k: 'secure', label: 'Needs built-in security', hint: 'Certificates, signing, encryption at the protocol level.' },
  { k: 'fanout', label: 'Many consumers of the same data', hint: 'Dashboards, analytics, historian, AI all want it.' },
  { k: 'wan', label: 'Unreliable or remote link', hint: 'Cellular, satellite, or a cloud hop.' },
  { k: 'poll', label: 'Master polls on its own schedule', hint: 'Request/response is acceptable.' },
]

// Transparent scoring: each answer adds or removes points. This is a teaching heuristic, not a rule.
const WEIGHTS: Record<Q, { Modbus: number; 'OPC UA': number; MQTT: number }> = {
  legacy: { Modbus: 3, 'OPC UA': 0, MQTT: -1 },
  model: { Modbus: -2, 'OPC UA': 3, MQTT: 0 },
  secure: { Modbus: -2, 'OPC UA': 3, MQTT: 1 },
  fanout: { Modbus: -1, 'OPC UA': 1, MQTT: 3 },
  wan: { Modbus: -2, 'OPC UA': 0, MQTT: 3 },
  poll: { Modbus: 2, 'OPC UA': 1, MQTT: -1 },
}
const COLORS = { Modbus: 'var(--accent)', 'OPC UA': 'var(--cyan)', MQTT: 'var(--violet)' } as const
const NOTES = {
  Modbus: 'Simple, ubiquitous register model. No discovery, typing or security: you need the manual, and a separate protection layer.',
  'OPC UA': 'Rich information model, browsing, subscriptions and certificate-based security. More to configure; great at plant level.',
  MQTT: 'Lightweight publish/subscribe through a broker. Excellent fan-out and poor-link behavior; payload meaning is up to you.',
} as const

export default function ProtocolPicker() {
  const [on, setOn] = useState<Record<Q, boolean>>({ legacy: true, model: false, secure: false, fanout: false, wan: false, poll: true })
  const scores = useMemo(() => {
    const s = { Modbus: 0, 'OPC UA': 0, MQTT: 0 }
    for (const q of QUESTIONS) if (on[q.k]) for (const p of Object.keys(s) as (keyof typeof s)[]) s[p] += WEIGHTS[q.k][p]
    return s
  }, [on])
  const ranked = (Object.keys(scores) as (keyof typeof scores)[]).sort((a, b) => scores[b] - scores[a])
  const min = -4, max = 10
  const pct = (v: number) => Math.max(2, Math.min(100, ((v - min) / (max - min)) * 100))

  return (
    <>
      <div className="panel">
        <h3>Your constraints</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {QUESTIONS.map((q) => (
            <label key={q.k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={on[q.k]} onChange={() => setOn({ ...on, [q.k]: !on[q.k] })} style={{ marginTop: 6, accentColor: 'var(--accent)' }} />
              <span><b>{q.label}</b><br /><span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{q.hint}</span></span>
            </label>
          ))}
        </div>
      </div>

      <div className="viz">
        <VizTitle title="Fit score" />
        <div style={{ padding: 18, display: 'grid', gap: 14 }}>
          {ranked.map((p, i) => (
            <div key={p}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <b style={{ color: COLORS[p] }}>{p} {i === 0 && <span className="badge good">best fit</span>}</b>
                <span className="mono">{scores[p]}</span>
              </div>
              <div style={{ height: 14, background: 'var(--panel2)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ width: `${pct(scores[p])}%`, height: '100%', background: COLORS[p], transition: 'width .35s' }} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '.88rem', color: 'var(--muted)' }}>{NOTES[p]}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="callout">
        This is a heuristic. The most common real answer is a layered one: <b>Modbus</b> from the device to a gateway, <b>OPC UA</b> inside the plant, <b>MQTT</b> out to enterprise consumers.
      </div>
    </>
  )
}
