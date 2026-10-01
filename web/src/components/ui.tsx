import type { ReactNode } from 'react'

export function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step = 1, unit = '', onChange } = props
  return (
    <div className="field">
      <label>
        {label}
        <span className="v">{value}{unit}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export function Stat(props: { k: string; n: ReactNode; s?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${props.tone ?? ''}`}>
      <div className="k">{props.k}</div>
      <div className="n">{props.n}</div>
      {props.s && <div className="s">{props.s}</div>}
    </div>
  )
}

export function Seg<T extends string | number>(props: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o)} className={o === props.value ? 'on' : ''} onClick={() => props.onChange(o)} aria-pressed={o === props.value}>
          {String(o)}
        </button>
      ))}
    </div>
  )
}

export function VizTitle(props: { title: ReactNode; legend?: { color: string; label: string }[] }) {
  return (
    <div className="viz-title">
      <span>{props.title}</span>
      {props.legend && (
        <span className="legend">
          {props.legend.map((l) => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </span>
      )}
    </div>
  )
}
