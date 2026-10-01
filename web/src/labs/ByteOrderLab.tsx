import { useState } from 'react'
import { BYTE_ORDERS, canonicalBytes, decodeFloat, decodeInt16, decodeUInt32, encodeFloatAbcd, hex, type ByteOrder } from '../lib/wire'
import { Seg, VizTitle } from '../components/ui'

const BYTE_COLORS = ['var(--accent)', 'var(--cyan)', 'var(--green)', 'var(--violet)'] // A B C D
const LETTERS = ['A', 'B', 'C', 'D']

const EXAMPLES: { name: string; r0: number; r1: number; note: string }[] = (() => {
  const [a, b] = encodeFloatAbcd(25.5)
  const [c, d] = encodeFloatAbcd(1013.25)
  return [
    { name: '25.5 °C, word-swapped', r0: b, r1: a, note: 'A device that sends the low word first (CDAB).' },
    { name: '25.5 °C, straight', r0: a, r1: b, note: 'Big-endian words and bytes (ABCD).' },
    { name: '1013.25 hPa, straight', r0: c, r1: d, note: 'Pressure transmitter in ABCD.' },
    { name: 'Counter = 70000', r0: 0x0001, r1: 0x1170, note: 'A uint32 total: 0x00011170 = 70000.' },
  ]
})()

function parseReg(s: string): number {
  const n = /^0x/i.test(s.trim()) ? parseInt(s, 16) : parseInt(s.trim(), /[a-f]/i.test(s) ? 16 : 10)
  return Number.isFinite(n) ? n & 0xffff : 0
}

const fmt = (v: number) => (Number.isFinite(v) ? (Math.abs(v) > 1e6 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : String(+v.toPrecision(7))) : String(v))

export default function ByteOrderLab() {
  const [r0, setR0] = useState(EXAMPLES[0].r0)
  const [r1, setR1] = useState(EXAMPLES[0].r1)
  const [order, setOrder] = useState<ByteOrder>('ABCD')
  const [mode, setMode] = useState<'float32' | 'uint32'>('float32')
  const [active, setActive] = useState(0)

  const raw = [(r0 >> 8) & 0xff, r0 & 0xff, (r1 >> 8) & 0xff, r1 & 0xff]
  const canon = canonicalBytes(r0, r1, order)
  // For each canonical position (A..D), which wire index supplied it
  const source = canon.map((_, i) => permIndex(order, i))
  const decode = (o: ByteOrder) => (mode === 'float32' ? decodeFloat(r0, r1, o) : decodeUInt32(r0, r1, o))

  return (
    <>
      <div className="panel">
        <h3>Load an example or type registers</h3>
        <div className="row" style={{ marginBottom: 16 }}>
          {EXAMPLES.map((e, i) => (
            <button key={e.name} className={`btn small ${active === i ? '' : 'ghost'}`} onClick={() => { setR0(e.r0); setR1(e.r1); setActive(i) }}>{e.name}</button>
          ))}
        </div>
        <div className="controls">
          <div className="field">
            <label>Register N <span className="v">0x{hex(r0, 4)}</span></label>
            <input type="text" value={r0} aria-label="Register N" onChange={(e) => { setR0(parseReg(e.target.value)); setActive(-1) }} />
          </div>
          <div className="field">
            <label>Register N+1 <span className="v">0x{hex(r1, 4)}</span></label>
            <input type="text" value={r1} aria-label="Register N+1" onChange={(e) => { setR1(parseReg(e.target.value)); setActive(-1) }} />
          </div>
          <div className="field">
            <label>Interpret as</label>
            <Seg label="Interpretation" value={mode} options={['float32', 'uint32']} onChange={setMode} />
          </div>
        </div>
        {active >= 0 && <p style={{ margin: '12px 0 0' }}>{EXAMPLES[active].note} Values accept decimal or hex (0x…).</p>}
      </div>

      <div className="viz">
        <VizTitle title="Wire bytes → value bytes" legend={LETTERS.map((l, i) => ({ color: BYTE_COLORS[i], label: `Byte ${l}` }))} />
        <div style={{ padding: 18, display: 'grid', gap: 18 }}>
          <div>
            <div className="mono" style={{ color: 'var(--muted)', fontSize: '.78rem', marginBottom: 6 }}>As received (register N, then N+1; each register big-endian on the wire)</div>
            <div className="bytes">
              {raw.map((b, j) => (
                <div key={j} className="byte" style={{ color: 'var(--text)', borderColor: 'var(--line)', background: 'var(--panel2)' }}>
                  {hex(b)}<small>wire {j}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="row"><Seg label="Byte order" value={order} options={BYTE_ORDERS} onChange={setOrder} />
            <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{describe(order)}</span></div>
          <div>
            <div className="mono" style={{ color: 'var(--muted)', fontSize: '.78rem', marginBottom: 6 }}>Re-ordered into the canonical big-endian value A B C D</div>
            <div className="bytes">
              {canon.map((b, i) => (
                <div key={i} className="byte" style={{ color: BYTE_COLORS[i], borderColor: BYTE_COLORS[i], background: `color-mix(in srgb, ${BYTE_COLORS[i]} 14%, var(--bg))` }}>
                  {hex(b)}<small>{LETTERS[i]} ← wire {source[i]}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>All four layouts side by side</h3>
        <table className="table">
          <thead><tr><th>Layout</th><th>Canonical bytes</th><th>{mode}</th><th>int16 of reg N</th></tr></thead>
          <tbody>
            {BYTE_ORDERS.map((o) => {
              const v = decode(o)
              const plausible = mode === 'float32' && Number.isFinite(v) && Math.abs(v) >= 0.01 && Math.abs(v) < 100000
              return (
                <tr key={o} className={plausible ? 'best' : ''} style={{ cursor: 'pointer' }} onClick={() => setOrder(o)}>
                  <td>{o}{o === order ? ' ◀' : ''}</td>
                  <td>{canonicalBytes(r0, r1, o).map((b) => hex(b)).join(' ')}</td>
                  <td>{fmt(v)}</td>
                  <td>{decodeInt16(r0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p style={{ margin: '12px 0 0' }}>Green rows look physically plausible, which is <b>not</b> proof. Confirm against the device manual or a known reading, for example a value you can measure independently.</p>
      </div>
      <div className="callout">
        Layout names describe <b>bytes</b>, not the data type: the same permutation applies to floats, uint32 and int32. Libraries that hand you a <code>ushort</code> have already decoded the wire bytes, so rebuild them explicitly before permuting.
      </div>
    </>
  )
}

// Which wire index feeds canonical byte position i for a given order.
function permIndex(order: ByteOrder, i: number): number {
  const map: Record<ByteOrder, number[]> = { ABCD: [0, 1, 2, 3], BADC: [1, 0, 3, 2], CDAB: [2, 3, 0, 1], DCBA: [3, 2, 1, 0] }
  return map[order][i]
}

function describe(o: ByteOrder) {
  return { ABCD: 'Big-endian: high word first, high byte first.', BADC: 'Bytes swapped within each word.', CDAB: 'Words swapped, bytes in order (common on many PLCs).', DCBA: 'Fully reversed (little-endian).' }[o]
}
