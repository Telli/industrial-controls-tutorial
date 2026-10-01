import { useState } from 'react'
import { decodeInt16, hex } from '../lib/wire'
import { Stat, VizTitle } from '../components/ui'

const NAMES = ['Running', 'Ready', 'Fault', 'Warning', 'Remote', 'At speed', 'Reverse', 'E-stop', 'Door open', 'Heater on', 'Pump on', 'Valve open', 'Low level', 'High level', 'Comms ok', 'Reserved']

export default function PackedBitsLab() {
  const [word, setWord] = useState(0b0100_0000_0010_0011)
  const [shadow, setShadow] = useState<number | null>(null) // stale copy held by the client
  const [plcWord, setPlcWord] = useState<number | null>(null) // what the PLC changed meanwhile
  const [log, setLog] = useState<string[]>([])

  const toggle = (b: number) => setWord((w) => w ^ (1 << b))
  const bits = Array.from({ length: 16 }, (_, i) => 15 - i)

  const startRmw = () => {
    setShadow(word)
    setPlcWord(word | (1 << 2)) // PLC raises Fault while the client is mid read-modify-write
    setLog((l) => [`Client reads 0x${hex(word, 4)}`, 'PLC sets bit 2 (Fault) meanwhile', ...l])
  }
  const finishRmw = () => {
    if (shadow === null || plcWord === null) return
    const written = shadow | (1 << 10) // client sets bit 10 based on the stale copy
    setWord(written)
    setLog((l) => [`Client writes 0x${hex(written, 4)} (stale copy | bit 10)`, written & (1 << 2) ? 'Fault preserved' : 'Fault bit LOST: overwritten by stale write', ...l])
    setShadow(null); setPlcWord(null)
  }

  return (
    <>
      <div className="panel">
        <h3>One 16-bit holding register</h3>
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          {bits.map((b) => (
            <button key={b} className={`bit ${word & (1 << b) ? 'on' : ''}`} onClick={() => toggle(b)}
              aria-pressed={!!(word & (1 << b))} aria-label={`bit ${b} ${NAMES[b]}`} title={NAMES[b]}>
              {word & (1 << b) ? 1 : 0}<small>b{b}</small>
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn small ghost" onClick={() => setWord(0)}>Clear</button>
          <button className="btn small ghost" onClick={() => setWord(0xffff)}>All set</button>
          <button className="btn small ghost" onClick={() => setWord(0x8000)}>Only bit 15</button>
        </div>
      </div>

      <div className="stats">
        <Stat k="Hex" n={`0x${hex(word, 4)}`} />
        <Stat k="Unsigned" n={word} />
        <Stat k="Signed int16" n={decodeInt16(word)} tone={decodeInt16(word) < 0 ? 'warn' : undefined} s={decodeInt16(word) < 0 ? 'bit 15 reads as a sign' : undefined} />
        <Stat k="Bits set" n={bits.filter((b) => word & (1 << b)).length} />
      </div>

      <div className="viz">
        <VizTitle title="Decoded flags" />
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {NAMES.map((n, b) => (
            <div key={b} className={`badge ${word & (1 << b) ? (b === 2 || b === 7 ? 'bad' : 'good') : ''}`} style={{ padding: '6px 10px', opacity: word & (1 << b) ? 1 : 0.45, border: '1px solid var(--line)' }}>
              b{b} · {n}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Hazard: stale read-modify-write</h3>
        <p>
          Writing a whole register to change one bit replaces bits the PLC may have changed since you read it. Step through it:
        </p>
        <div className="row">
          <button className="btn small" onClick={startRmw} disabled={shadow !== null}>1 · Client reads, PLC changes bit 2</button>
          <button className="btn small" onClick={finishRmw} disabled={shadow === null}>2 · Client writes back bit 10</button>
        </div>
        <div className="log" style={{ marginTop: 12, minHeight: 60 }}>
          {log.length === 0 ? <div>Nothing yet. Bit 2 (Fault) starts clear.</div> : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
      <div className="callout">
        Prefer device-side set/clear masks, single-coil writes (FC05) or dedicated command registers. If you must read-modify-write, treat it as racing the PLC.
        Document whether bit 0 is the least significant bit and whether the register is signed.
      </div>
    </>
  )
}
