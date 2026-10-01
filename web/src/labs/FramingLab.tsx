import { useMemo, useState } from 'react'
import { FrameAssembler, buildFc03Request, buildFc03Response, hex } from '../lib/wire'
import { Slider, Stat, VizTitle } from '../components/ui'

const FIELD_COLORS = ['var(--accent)', 'var(--muted)', 'var(--cyan)', 'var(--green)', 'var(--violet)', 'var(--pink)', 'var(--accent)']

export default function FramingLab() {
  const [start, setStart] = useState(0)
  const [count, setCount] = useState(2)
  const [txn, setTxn] = useState(1)
  const [chunk, setChunk] = useState(5)
  const [glue, setGlue] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const req = useMemo(() => buildFc03Request(txn, 1, start, count), [txn, start, count])
  const regs = useMemo(() => Array.from({ length: count }, (_, i) => 0x4100 + start + i), [count, start])
  const resp = useMemo(() => buildFc03Response(txn, 1, regs), [txn, regs])

  // Stream: one or two replies, then chopped into chunks of the given size.
  const stream = useMemo(() => (glue ? [...resp, ...resp] : resp), [glue, resp])
  const chunks = useMemo(() => {
    const out: number[][] = []
    for (let i = 0; i < stream.length; i += chunk) out.push(stream.slice(i, i + chunk))
    return out
  }, [stream, chunk])

  const steps = useMemo(() => {
    const asm = new FrameAssembler()
    return chunks.map((c) => ({ chunk: c, frames: asm.push(c).length, pending: asm.pending }))
  }, [chunks])
  const total = steps.reduce((a, s) => a + s.frames, 0)

  // A naive reader: treats each chunk as one message.
  const naiveOk = chunks.length === (glue ? 2 : 1) && chunks.every((c) => c.length === resp.length)

  const fieldOf = (i: number) => req.fields.findIndex((f) => i >= f.from && i < f.to)
  const hf = hover === null ? null : req.fields[hover]

  return (
    <>
      <div className="panel">
        <div className="controls">
          <Slider label="Start offset" value={start} min={0} max={200} onChange={setStart} />
          <Slider label="Quantity" value={count} min={1} max={10} onChange={setCount} />
          <Slider label="Transaction ID" value={txn} min={1} max={60000} step={1} onChange={setTxn} />
        </div>
      </div>

      <div className="viz">
        <VizTitle title="FC03 request frame: 12 bytes" />
        <div style={{ padding: 18 }}>
          <div className="bytes" onMouseLeave={() => setHover(null)}>
            {req.bytes.map((b, i) => {
              const f = fieldOf(i)
              const dim = hover !== null && hover !== f
              return (
                <div key={i} className="byte" onMouseEnter={() => setHover(f)}
                  style={{ color: FIELD_COLORS[f], borderColor: FIELD_COLORS[f], background: `color-mix(in srgb, ${FIELD_COLORS[f]} 14%, var(--bg))`, opacity: dim ? 0.35 : 1 }}>
                  {hex(b)}<small>#{i}</small>
                </div>
              )
            })}
          </div>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            {req.fields.map((f, i) => (
              <span key={f.name} className="tag" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                style={{ color: FIELD_COLORS[i], borderColor: FIELD_COLORS[i], cursor: 'default' }}>{f.name}</span>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', minHeight: 26, color: 'var(--muted)', fontSize: '.92rem' }}>
            {hf ? <><b style={{ color: FIELD_COLORS[hover!] }}>{hf.name}</b> · {hf.note}</> : 'Hover a byte or field name. MBAP header = first 7 bytes; function PDU = last 5.'}
          </p>
        </div>
      </div>

      <div className="panel">
        <h3>Reply arrives over TCP</h3>
        <div className="controls" style={{ marginBottom: 16 }}>
          <Slider label="Bytes per TCP chunk" value={chunk} min={1} max={stream.length} onChange={setChunk} />
          <div className="field">
            <label>Two replies back to back</label>
            <button className={`btn small ${glue ? 'on' : 'ghost'}`} onClick={() => setGlue((g) => !g)} aria-pressed={glue}>{glue ? 'Coalesced: on' : 'Coalesced: off'}</button>
          </div>
        </div>
        <div className="stats" style={{ marginBottom: 14 }}>
          <Stat k="Chunks received" n={chunks.length} />
          <Stat k="Frames assembled" n={total} tone="ok" s="length-based reassembly" />
          <Stat k="Naive 'one read = one frame'" n={naiveOk ? 'works' : 'breaks'} tone={naiveOk ? 'ok' : 'bad'} />
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>Chunk bytes</th><th>Buffered</th><th>Frames out</th></tr></thead>
          <tbody>
            {steps.slice(0, 14).map((s, i) => (
              <tr key={i} className={s.frames ? 'best' : ''}>
                <td>{i + 1}</td>
                <td>{s.chunk.map((b) => hex(b)).join(' ')}</td>
                <td>{s.pending}</td>
                <td>{s.frames}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {steps.length > 14 && <p style={{ margin: '8px 0 0' }}>…{steps.length - 14} more chunks</p>}
      </div>
      <div className="callout">
        TCP is a byte stream. Read the 6-byte header, take the length from bytes 4–5, then read exactly that many more bytes.
        Sleeping for a fixed time and calling <code>Read()</code> once happens to work until the network gets busy.
      </div>
    </>
  )
}
