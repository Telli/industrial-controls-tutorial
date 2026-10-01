import { useState } from 'react'
import { HmiModel, TAGS, type DisplayMode, type RoundResult, type Tag } from '../lib/hmi'
import { useLabClock } from '../lib/useLabClock'
import { Seg, Stat, VizTitle } from '../components/ui'
import Prediction from '../components/Prediction'

type Principle = 'muted' | 'analog' | 'priority' | 'quality' | 'trend'
type Principles = Record<Principle, boolean>

const PRINCIPLES: { key: Principle; label: string; guideline: string; why: string }[] = [
  { key: 'muted', label: 'Gray background, color only for abnormal', guideline: 'NUREG-0700 1.3.8-10', why: 'When normal equipment is already red and green, an alarm color has nothing to stand out against.' },
  { key: 'analog', label: 'Analog indicators with normal range and limits', guideline: 'NUREG-0700 1.1-19, 1.2.4-7', why: 'A pointer leaving a shaded band is visible at a glance; a number has to be read and compared from memory.' },
  { key: 'priority', label: 'Alarm priority by shape, text and color', guideline: 'NUREG-0700 4.2.2-3', why: 'Priority you can see without color survives color-vision deficiency and poor screens.' },
  { key: 'quality', label: 'Show stale and invalid data', guideline: 'NUREG-0700 14.3-3, 14.3-4', why: 'A frozen number looks exactly like a steady process unless the display says otherwise.' },
  { key: 'trend', label: 'Short trend beside each value', guideline: 'NUREG-0700 1.2.5', why: 'Direction and rate of change tell you what will happen next, not just what is true now.' },
]

const PRESETS: Record<'legacy' | 'high-performance', Principles> = {
  legacy: { muted: false, analog: false, priority: false, quality: false, trend: false },
  'high-performance': { muted: true, analog: true, priority: true, quality: true, trend: true },
}

const PRIORITY_LABEL = { 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' } as const

function PriorityMark({ p }: { p: 1 | 2 | 3 }) {
  // Shape carries priority on its own: diamond, triangle, square.
  const fill = p === 1 ? '#c0182b' : p === 2 ? '#d98200' : '#6b4fb3'
  return (
    <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
      {p === 1 && <path d="M0 -10 L10 0 L0 10 L-10 0 Z" fill={fill} />}
      {p === 2 && <path d="M0 -10 L10 8 L-10 8 Z" fill={fill} />}
      {p === 3 && <rect x="-8" y="-8" width="16" height="16" fill={fill} />}
      <text y={p === 2 ? 6 : 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{p}</text>
    </svg>
  )
}

function Tile({ tag, m, p, onPick, disabled }: { tag: Tag; m: HmiModel; p: Principles; onPick: () => void; disabled: boolean }) {
  const r = m.readings[tag.id]
  const status = m.status(tag)
  const showStale = p.quality && r.stale
  const alarm = status === 'alarm' && !showStale
  const frac = (v: number) => (v - tag.min) / (tag.max - tag.min) * 100
  const legacyValueColor = alarm && !p.priority ? '#ff3030' : '#ffe14d'
  const valueText = tag.id === 'valve' && !p.muted ? `${r.value.toFixed(0)} % OPEN` : `${r.value.toFixed(tag.max <= 10 ? 1 : 0)} ${tag.unit}`
  return (
    <button className={`hmi-tile ${p.muted ? 'hp' : 'legacy'} ${alarm && p.muted ? 'in-alarm' : ''} ${showStale ? 'stale' : ''}`} onClick={onPick} disabled={disabled} aria-label={`${tag.label}: ${valueText}${showStale ? ', stale' : ''}`}>
      <div className="hmi-tile-head">
        <span className="hmi-label" style={!p.muted ? { color: '#5ee0ff' } : undefined}>{tag.label}</span>
        {alarm && p.priority && <span className="hmi-priority"><PriorityMark p={tag.priority} />{PRIORITY_LABEL[tag.priority]}</span>}
        {showStale && <span className="hmi-stale">STALE {r.age.toFixed(0)} s</span>}
        {p.analog && status === 'abnormal' && !showStale && <span className="hmi-deviation">▲ above normal</span>}
      </div>
      <div className="hmi-value" style={!p.muted ? { color: legacyValueColor } : alarm && !p.priority ? { color: '#c0182b' } : undefined}>
        {showStale ? '?' : ''}{valueText}
      </div>
      {p.analog && (
        <div className="hmi-bar" aria-hidden="true">
          <div className="hmi-band" style={{ left: `${frac(tag.normal[0])}%`, width: `${frac(tag.normal[1]) - frac(tag.normal[0])}%` }} />
          <div className="hmi-limit" style={{ left: `${frac(tag.alarmHigh)}%` }} />
          <div className={`hmi-pointer ${status !== 'normal' && !showStale ? 'out' : ''}`} style={{ left: `${frac(r.value)}%` }} />
        </div>
      )}
      {p.trend && (
        <svg className="hmi-trend" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" width="100" y={24 - frac(tag.normal[1]) * .24} height={(frac(tag.normal[1]) - frac(tag.normal[0])) * .24} fill="currentColor" opacity=".1" />
          <polyline points={r.history.map((v, i) => `${i / (r.history.length - 1) * 100},${24 - frac(v) * .24}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </button>
  )
}

function Mimic({ m, p }: { m: HmiModel; p: Principles }) {
  const level = m.readings.level.value
  const colors = p.muted
    ? { pipe: '#9aa3ad', tank: '#c9ced4', fluid: '#b3bac2', pump: '#5b6470', valve: '#5b6470', text: '#2b3038' }
    : { pipe: '#2f7bff', tank: '#e6e6e6', fluid: '#2f7bff', pump: '#00d23c', valve: '#ff3030', text: '#ffffff' }
  return (
    <svg viewBox="0 0 520 120" className="hmi-mimic" role="img" aria-label="Process overview: tank, pump and discharge valve">
      <rect x="20" y="15" width="70" height="90" fill="none" stroke={colors.tank} strokeWidth="2" />
      <rect x="21" y={105 - level * .9} width="68" height={level * .9} fill={colors.fluid} opacity={p.muted ? 1 : .8} />
      <path d="M90 95 H210 M250 95 H330 M370 95 H500" stroke={colors.pipe} strokeWidth="6" />
      <circle cx="230" cy="95" r="20" fill={colors.pump} />
      <path d="M222 85 L242 95 L222 105 Z" fill={p.muted ? '#e8ebee' : '#003b10'} />
      <path d="M330 83 L370 107 L370 83 L330 107 Z" fill={colors.valve} />
      <g fill={colors.text} fontSize="11" fontFamily="var(--mono)">
        <text x="20" y="11">T-101</text><text x="212" y="66">P-101 {p.muted ? 'RUN' : ''}</text><text x="330" y="74">XV-102</text>
      </g>
    </svg>
  )
}

export default function HmiLab() {
  const [m] = useState(() => new HmiModel(Date.now() % 100000))
  const [principles, setPrinciples] = useState<Principles>(PRESETS.legacy)
  const [cvd, setCvd] = useState(false)
  const [last, setLast] = useState<RoundResult | null>(null)
  const refresh = useLabClock(dt => m.step(dt), true, 200)

  const mode: DisplayMode = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).find(k => PRINCIPLES.every(pr => PRESETS[k][pr.key] === principles[pr.key])) ?? 'custom'
  const pick = (tagId: string) => { setLast(m.answer(tagId, mode)); refresh() }
  const start = () => { setLast(null); m.startRound(); refresh() }
  const describe = (r: RoundResult) => {
    const tag = TAGS.find(t => t.id === r.tag)!
    return { drift: `${tag.label} was drifting upward. It left its normal range about 14 s before it reached its alarm limit.`, alarm: `${tag.label} was in alarm (${PRIORITY_LABEL[tag.priority].toLowerCase()} priority).`, stale: `${tag.label} had frozen: communication was lost and the value stopped updating.` }[r.kind]
  }

  return <>
    <Prediction
      question="A pump bearing temperature is rising but has not reached its alarm limit. Which display element shows it first?"
      options={['Red alarm text', 'A pointer leaving its shaded normal range', 'A flashing pump symbol']}
      answer={1}
      explanation="Nothing alarms until the limit is crossed. An analog indicator with a normal band shows the drift while there is still time to act, which is the point of high-performance HMI design. Run a few rounds in each style and compare your times."
    />

    <div className="panel">
      <h3>Display design</h3>
      <div className="row" style={{ marginBottom: 14 }}>
        <Seg label="Display preset" value={mode === 'custom' ? 'custom' : mode} options={['legacy', 'high-performance', 'custom'] as const} onChange={v => { if (v !== 'custom') setPrinciples(PRESETS[v]) }} />
        <label className="check-label"><input type="checkbox" checked={cvd} onChange={e => setCvd(e.target.checked)} /> Simulate red–green color-vision deficiency</label>
      </div>
      <div className="principles">
        {PRINCIPLES.map(pr => (
          <label key={pr.key} className="check-label" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={principles[pr.key]} onChange={e => setPrinciples({ ...principles, [pr.key]: e.target.checked })} style={{ marginTop: 5 }} />
            <span className="principle"><b>{pr.label}</b><span className="principle-ref">{pr.guideline}</span><span className="principle-why">{pr.why}</span></span>
          </label>
        ))}
      </div>
    </div>

    <div className="panel">
      <h3>Find the problem</h3>
      <p style={{ marginBottom: 12 }}>Each round puts one problem on the screen: a slow drift, an alarm or a frozen value. Click the tile as soon as you find it. Try the same number of rounds in each display style.</p>
      <div className="row">
        <button className="btn small" onClick={start}>{m.round ? 'Restart round' : 'Start a round'}</button>
        {m.round && <span className="lesson-hint" role="status">Round running: {(m.t - m.round.started).toFixed(1)} s</span>}
      </div>
      {last && (
        <p className={`prediction-result`} role="status" style={{ marginTop: 14 }}>
          <b>{last.correct ? `Found in ${last.seconds.toFixed(1)} s. ` : 'Not that one. '}</b>{describe(last)}
        </p>
      )}
    </div>

    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="cvd-deuteranopia"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0" /></filter>
    </svg>
    <div className={`hmi-screen ${principles.muted ? 'hp' : 'legacy'}`} style={cvd ? { filter: 'url(#cvd-deuteranopia)' } : undefined}>
      <Mimic m={m} p={principles} />
      <div className="hmi-grid">
        {TAGS.map(tag => <Tile key={tag.id} tag={tag} m={m} p={principles} onPick={() => pick(tag.id)} disabled={!m.round} />)}
      </div>
    </div>

    <div className="viz">
      <VizTitle title="Your results by display style" />
      <div className="stats" style={{ padding: 14 }}>
        {(['legacy', 'high-performance', 'custom'] as DisplayMode[]).map(dm => {
          const s = m.summary(dm)
          return <Stat key={dm} k={dm === 'high-performance' ? 'High-performance' : dm === 'legacy' ? 'Legacy' : 'Custom mix'} n={s.meanSeconds === null ? '—' : `${s.meanSeconds.toFixed(1)} s`} s={`${s.correct} of ${s.rounds} found · mean time`} />
        })}
      </div>
    </div>
    <div className="callout">
      In the legacy style, red already means “valve open” and green means “pump running”, so an alarm has to compete with normal states. Drifts are invisible until they alarm, and frozen data looks healthy. Turn the principles on one at a time and notice which problem each one makes visible.
    </div>
  </>
}
