import { useState } from 'react'
import { scaleAnalog, type AnalogConfig } from '../lib/plc'
import { useLabClock } from '../lib/useLabClock'
import { Seg, Slider, Stat, VizTitle } from '../components/ui'
import Prediction from '../components/Prediction'

export default function AnalogLab() {
  const [actual, setActual] = useState(50)
  const [sensorMax, setSensorMax] = useState(100)
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(100)
  const [bits, setBits] = useState(12)
  const [noise, setNoise] = useState(0)
  const [sample, setSample] = useState(1)
  const [fault, setFault] = useState<AnalogConfig['fault']>('Healthy')
  const [live, setLive] = useState(false)
  useLabClock(() => setSample(n => n + 1), live, 300)
  const valid = max > min
  const s = scaleAnalog({ actual, sensorMin: 0, sensorMax, configuredMin: valid ? min : 0, configuredMax: valid ? max : 100, bits, noise, fault, sample })
  const position = (v: number) => 55 + Math.max(0, Math.min(24, v)) / 24 * 660
  return <>
    <Prediction question="A 0–100 °C transmitter sends 12 mA. The PLC is mistakenly configured for 0–200 °C. What does it display?" options={['About 50 °C', 'About 100 °C', 'A communications error']} answer={1} explanation="12 mA is halfway through the 4–20 mA span. The wrong engineering range maps that to 100 °C. The signal can have good electrical quality and still carry the wrong meaning. Set the PLC maximum to 200 to try it." />
    <div className="panel"><h3>Physical process and transmitter</h3><div className="controls"><Slider label="Actual temperature" value={actual} min={0} max={sensorMax} step={.1} unit=" °C" onChange={setActual} /><div className="field"><label>Transmitter range</label><Seg label="Transmitter range" value={sensorMax} options={[100, 200]} onChange={v => { setSensorMax(v); setActual(a => Math.min(a, v)) }} /><span className="lesson-hint">0 to selected value, in °C</span></div><Slider label="Current noise amplitude" value={noise} min={0} max={.4} step={.02} unit=" mA" onChange={setNoise} /></div><div className="row" style={{ marginTop: 18 }}><Seg label="Sensor condition" value={fault} options={['Healthy', 'Open wire', 'High signal']} onChange={setFault} /><button className="btn small ghost" onClick={() => setSample(n => n + 1)}>Sample again</button><button className="btn small ghost" aria-pressed={live} onClick={() => setLive(v => !v)}>{live ? 'Pause sampling' : 'Live sampling'}</button></div></div>
    <div className="panel"><h3>PLC configuration</h3><div className="controls"><Slider label="Engineering minimum" value={min} min={-50} max={100} unit=" °C" onChange={setMin} /><Slider label="Engineering maximum" value={max} min={0} max={200} unit=" °C" onChange={setMax} /><div className="field"><label>ADC resolution</label><Seg label="ADC resolution" value={bits} options={[8, 12, 16]} onChange={setBits} /><span className="lesson-hint">bits · modeled module range 0–24 mA</span></div></div>{!valid && <p className="form-error" role="alert">Engineering maximum must be greater than minimum. Correct the range to calculate a value.</p>}</div>
    <div className="viz"><VizTitle title="The complete measurement chain" /><div className="signal-chain"><span>{actual.toFixed(1)} °C physical</span><b>→</b><span>{s.current.toFixed(3)} mA</span><b>→</b><span>{s.raw} raw counts</span><b>→</b><span>{valid && s.value !== null ? `${s.value.toFixed(2)} °C` : 'INVALID'}</span></div><svg viewBox="0 0 770 125" role="img" aria-label="Current signal against the valid four to twenty milliamp range"><rect x={position(4)} y="30" width={position(20) - position(4)} height="28" rx="4" fill="var(--green)" opacity=".12" /><path d="M55 58H715" stroke="var(--line)" strokeWidth="2" />{[0, 4, 12, 20, 24].map(v => <g key={v}><path d={`M${position(v)} 56v9`} stroke="var(--muted)" /><text x={position(v)} y="86" textAnchor="middle" fill="var(--muted)" fontSize="12">{v} mA</text></g>)}<circle cx={position(s.current)} cy="44" r="8" fill={s.quality === 'Good' ? 'var(--accent)' : 'var(--red)'} /><text x="385" y="113" textAnchor="middle" fill="var(--muted)" fontSize="12">Expected operating span: 4–20 mA</text></svg></div>
    <div className="stats"><Stat k="PLC engineering value" n={valid && s.value !== null ? `${s.value.toFixed(2)} °C` : 'INVALID'} tone={!valid || s.value === null ? 'bad' : undefined} s={valid && s.value !== null ? `error ${(s.value - actual).toFixed(2)} °C` : 'quality gate rejects the value'} /><Stat k="Signal quality" n={s.quality} tone={s.quality === 'Good' ? 'ok' : 'bad'} s="simple lab limits; not device diagnostic codes" /><Stat k="ADC count" n={s.raw} s={`0–${s.maxCount} for 0–24 mA`} /><Stat k="Resolution" n={valid ? `${s.resolution.toFixed(4)} °C` : '—'} s="one raw count in engineering units" /></div>
    {valid && <div className="panel"><h3>Inspect the scaling</h3><p className="formula">EU = {min} + (measured mA − 4) ÷ 16 × ({max} − {min})</p><p>ADC-reconstructed current: <b>{s.measured.toFixed(4)} mA</b>. Unchecked math would give <b>{s.unguarded.toFixed(2)} °C</b>{s.value === null && ' — a number that must not be presented as a valid measurement'}.</p><p className="lesson-hint">Quantization rounds the current to the nearest ADC count. The module range is explicit here; real module count ranges and diagnostic limits come from its manual.</p></div>}
  </>
}
