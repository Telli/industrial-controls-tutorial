import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TankSim, type ControlMode } from '../lib/tank'
import Prediction from '../components/Prediction'
import { Seg, Slider, Stat, VizTitle } from '../components/ui'
import { useTheme, type Theme } from '../components/Theme'
import SceneBoundary from '../components/SceneBoundary'
import Icon from '../components/Icon'
import ContextLossHandler from '../components/ContextLossHandler'

function Scene({ sim, theme, paused, reducedMotion }: { sim: TankSim; theme: Theme; paused: boolean; reducedMotion: boolean }) {
  const liquid = useRef<THREE.Mesh>(null)
  const coil = useRef<THREE.Mesh>(null)
  const steam = useRef<THREE.InstancedMesh>(null)
  const lamp = useRef<THREE.MeshBasicMaterial>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const cold = useMemo(() => new THREE.Color('#3f78b8'), [])
  const hotColor = useMemo(() => new THREE.Color('#d65e72'), [])
  const time = useRef(0)
  const STEAM = 40

  useFrame((_, dt) => {
    if (!paused && !reducedMotion) time.current += Math.min(dt, .1)
    color.copy(cold).lerp(hotColor, THREE.MathUtils.clamp((sim.temp - 25) / 45, 0, 1))
    if (liquid.current) (liquid.current.material as THREE.MeshStandardMaterial).color.copy(color)
    if (coil.current) {
      const m = coil.current.material as THREE.MeshStandardMaterial
      m.emissive.set(sim.heater ? '#ff5a1f' : '#000000')
      m.emissiveIntensity = sim.heater ? sim.power * (1.2 + Math.sin(time.current * 6) * 0.3) : 0
    }
    if (steam.current) {
      const hot = sim.temp > 62
      for (let i = 0; i < STEAM; i++) {
        const p = (time.current * 0.35 + i / STEAM) % 1
        dummy.position.set(Math.sin(i * 12.9) * 0.6, 1.55 + p * 1.3, Math.cos(i * 7.3) * 0.6)
        dummy.scale.setScalar(hot ? 0.07 * (1 - p) * (0.5 + (sim.temp - 62) / 8) : 0.0001)
        dummy.updateMatrix()
        steam.current.setMatrixAt(i, dummy.matrix)
      }
      steam.current.instanceMatrix.needsUpdate = true
    }
    lamp.current?.color.set(sim.ctrlAlarm ? '#ff5d6c' : '#3ddc97')
  })

  return (
    <>
      <ambientLight intensity={theme === 'light' ? 1.5 : 0.8} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <pointLight position={[0, 0.3, 0]} intensity={1.2} color="#ff7a3a" distance={4} />
      <gridHelper args={[14, 28, theme === 'light' ? '#b9c9df' : '#2a4468', theme === 'light' ? '#d6dfeb' : '#192e48']} position={[0, -0.06, 0]} />

      {/* tank shell */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.4, 48, 1, true]} />
        <meshStandardMaterial color="#a9bdd2" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} metalness={0.7} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.0, 0]}><cylinderGeometry args={[0.95, 0.95, 0.1, 48]} /><meshStandardMaterial color="#3a4a5e" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 2.43, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.9, 0.04, 8, 48]} /><meshStandardMaterial color="#8fa1b7" /></mesh>
      {/* liquid */}
      <mesh ref={liquid} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 1.9, 48]} />
        <meshStandardMaterial color="#3f78b8" transparent opacity={0.72} depthWrite={false} roughness={0.25} />
      </mesh>
      {/* heater coil */}
      <mesh ref={coil} position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusKnotGeometry args={[0.45, 0.05, 120, 8, 3, 4]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {/* steam */}
      <instancedMesh ref={steam} args={[undefined, undefined, STEAM]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={theme === 'light' ? '#7290b6' : '#d8e6f4'} transparent opacity={0.5} depthWrite={false} />
      </instancedMesh>
      {/* probe */}
      <mesh position={[0.55, 1.6, 0]}><cylinderGeometry args={[0.03, 0.03, 1.6, 12]} /><meshStandardMaterial color="#628aba" /></mesh>
      <mesh position={[0.55, 2.45, 0]}><boxGeometry args={[0.22, 0.16, 0.22]} /><meshStandardMaterial color="#274d80" /></mesh>
      {/* pipe + wire */}
      <mesh position={[1.9, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 2, 16]} /><meshStandardMaterial color="#6b7f95" metalness={0.6} roughness={0.3} /></mesh>
      {/* controller cabinet + SCADA screen */}
      <mesh position={[-2.6, 0.7, 0]}><boxGeometry args={[0.9, 1.4, 0.6]} /><meshStandardMaterial color="#1c2a3a" metalness={0.3} roughness={0.5} /></mesh>
      <mesh position={[-2.6, 1.05, 0.31]}><planeGeometry args={[0.6, 0.35]} /><meshBasicMaterial color="#04140d" /></mesh>
      <mesh position={[-2.6, 0.45, 0.31]}>
        <circleGeometry args={[0.07, 16]} /><meshBasicMaterial ref={lamp} color="#3ddc97" />
      </mesh>

      <OrbitControls enablePan={false} enableDamping={!reducedMotion} minDistance={5} maxDistance={12} maxPolarAngle={Math.PI / 2.05} target={[-0.5, 1.5, 0]} />
    </>
  )
}

interface Snap { t: number; truth: number; seen: number; q: string; setpoint: number; power: number }

export default function TankLab() {
  const { theme } = useTheme()
  const sim = useRef<TankSim>(null as unknown as TankSim)
  if (!sim.current) sim.current = new TankSim()
  const s = sim.current
  const [, force] = useState(0)
  const [hist, setHist] = useState<Snap[]>([])
  const [link, setLink] = useState(true)
  const [fault, setFault] = useState(false)
  const [dist, setDist] = useState(0)
  const [speed, setSpeed] = useState(4)
  const [mode, setMode] = useState<ControlMode>('On/off')
  const [setpoint, setSetpoint] = useState(60)
  const [kp, setKp] = useState(.08)
  const [ki, setKi] = useState(.008)
  const [deadband, setDeadband] = useState(1)
  const [paused, setPaused] = useState(false)
  const [viewKey, setViewKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const view = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReducedMotion(media.matches)
    const visibility = () => setPageVisible(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (view.current) observer.observe(view.current)
    media.addEventListener('change', change)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); media.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => { s.link = link }, [link, s])
  useEffect(() => { s.fault = fault }, [fault, s])
  useEffect(() => { s.disturbance = dist }, [dist, s])
  useEffect(() => { s.mode = mode; s.setpoint = setpoint; s.kp = kp; s.ki = ki; s.deadband = deadband }, [s, mode, setpoint, kp, ki, deadband])

  useEffect(() => {
    let previous = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      // The model is independent of WebGL. Do not catch up after a hidden tab.
      if (!paused && !document.hidden) s.step(Math.min((now - previous) / 1000, .5) * speed)
      previous = now
      if (paused || document.hidden) return
      setHist((h) => [...h.slice(-149), { t: s.t, truth: s.temp, seen: s.seen, q: s.quality, setpoint: s.setpoint, power: s.power }])
      force((f) => f + 1)
    }, 300)
    return () => window.clearInterval(id)
  }, [s, speed, paused])

  const W = 1000, H = 220, YMIN = 0, YMAX = 100
  const y = (v: number) => H - ((Math.max(YMIN, Math.min(YMAX, v)) - YMIN) / (YMAX - YMIN)) * H
  const x = (i: number) => (i / 149) * W
  const line = (k: 'truth' | 'seen' | 'setpoint') => hist.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join('')
  const q = s.quality
  const fallback = <div className="scene-loading"><Icon name="chip" size={42} /><p>3D view unavailable.<br />The simulation, controls and live chart still work.</p></div>

  return (
    <>
      <div className="canvas3d" ref={view} role="region" aria-label="Interactive heated tank simulation">
        <div className="hud">drag to orbit · scroll to zoom</div>
        <div className="tag-true"><span>TRUE PROCESS TEMPERATURE</span><b>{s.temp.toFixed(1)} °C</b></div>
        <div className="tag-scada" style={{ color: q === 'Good' ? 'var(--green)' : 'var(--red)' }}>
          <span>SUPERVISORY VIEW (SCADA)</span>
          <b>{s.seen.toFixed(1)} °C{q === 'Good' ? '' : q === 'Stale' ? ' · STALE' : ' · NO COMMS'}</b>
        </div>
        <SceneBoundary key={viewKey} fallback={fallback}>
          {contextLost ? fallback : <Canvas camera={{ position: [-0.5, 3.4, 8.4], fov: 42 }} dpr={[1, 1.5]} frameloop={!paused && !reducedMotion && visible && pageVisible ? 'always' : 'demand'} gl={{ antialias: true, powerPreference: 'low-power' }} fallback={fallback}>
            <ContextLossHandler onLost={() => setContextLost(true)} />
            <Scene sim={s} theme={theme} paused={paused} reducedMotion={reducedMotion} />
          </Canvas>}
        </SceneBoundary>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 18 }}><span className="lesson-hint">Controller</span><Seg label="Controller mode" value={mode} options={['On/off', 'P', 'PI'] as const} onChange={setMode} /></div><div className="controls">
          <Slider label="Setpoint (SP)" value={setpoint} min={35} max={80} unit=" °C" onChange={setSetpoint} />
          <Slider label="External heat load" value={dist} min={-4} max={4} step={.5} unit=" kW" onChange={setDist} />
          {mode === 'On/off' ? <Slider label="Control deadband" value={deadband} min={.2} max={6} step={.2} unit=" °C" onChange={setDeadband} /> : <Slider label="Proportional gain Kp" value={kp} min={.01} max={.3} step={.01} unit=" /°C" onChange={setKp} />}
          {mode === 'PI' && <Slider label="Integral gain Ki" value={ki} min={.001} max={.03} step={.001} unit=" /°C/s" onChange={setKi} />}
          <Slider label="Simulation speed" value={speed} min={1} max={10} unit="×" onChange={setSpeed} />
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn small ghost" onClick={() => setPaused(p => !p)} aria-pressed={paused}><Icon name={paused ? 'play' : 'pause'} size={14} />{paused ? 'Resume simulation' : 'Pause simulation'}</button>
          <button className="btn small ghost" onClick={() => { setContextLost(false); setViewKey(k => k + 1) }}><Icon name="reset" size={14} />Reset view</button>
          <button className={`btn small ${link ? 'on' : 'danger'}`} onClick={() => { s.link = !link; setLink(!link) }} aria-pressed={!link}>{link ? 'Link up: click to cut' : 'Link DOWN: click to restore'}</button>
          <button className={`btn small ${fault ? 'danger' : 'ghost'}`} onClick={() => { s.fault = !fault; setFault(!fault) }} aria-pressed={fault}>{fault ? 'Fault active: clear' : 'Trip heater fault'}</button>
          <button className="btn small ghost" onClick={() => { s.sup.acknowledge(s.t); force(f => f + 1) }}>Acknowledge alarm</button>
        </div>
      </div>

      <div className="stats">
        <Stat k="Process variable (PV)" n={`${s.temp.toFixed(1)} °C`} s={`SP ${setpoint} °C · error ${(setpoint - s.temp).toFixed(1)} °C`} /><Stat k="Heater output (MV)" n={`${(s.power * 100).toFixed(0)}%`} s={`${(s.power * s.maxPower).toFixed(1)} kW applied · ${mode} control`} />
        <Stat k="Supervisory value" n={`${s.seen.toFixed(1)} °C`} tone={q === 'Good' ? 'ok' : 'bad'} s={`quality ${q} · age ${s.age.toFixed(1)} s`} />
        <Stat k="Controller alarm" n={s.ctrlAlarm ? 'ACTIVE' : 'clear'} tone={s.ctrlAlarm ? 'bad' : 'ok'} s="on true value" />
        <Stat k="Supervisory alarm" n={s.sup.state} tone={s.sup.qualityBad ? 'warn' : s.sup.conditionActive ? 'bad' : 'ok'} s={s.sup.qualityBad ? 'evidence unreliable' : 'on received samples'} />
      </div>

      <div className="viz">
        <VizTitle title="Truth vs. what the dashboard knows" legend={[{ color: 'var(--accent)', label: 'True' }, { color: 'var(--green)', label: 'Supervisory' }, { color: 'var(--red)', label: 'Alarm 65 °C' }, { color: 'var(--violet)', label: 'Setpoint' }]} />
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="True temperature versus supervisory temperature">
          <line x1={0} x2={W} y1={y(65)} y2={y(65)} stroke="var(--red)" strokeDasharray="6 4" />
          <path d={line('setpoint')} fill="none" stroke="var(--violet)" strokeDasharray="6 4" strokeWidth="2" />
          <path d={line('truth')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
          <path d={line('seen')} fill="none" stroke="var(--green)" strokeWidth="2" strokeDasharray="1 0" opacity={0.95} />
          {hist.map((p, i) => p.q !== 'Good' ? <rect key={i} x={x(i)} y={H - 6} width={W / 149 + 0.5} height={6} fill="var(--red)" /> : null)}
        </svg>
      </div>
      <div className="viz"><VizTitle title="Applied heater output (0–100%)" /><svg viewBox="0 0 1000 100" role="img" aria-label="Heater power trend"><path d={hist.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${95 - p.power * 85}`).join('')} fill="none" stroke="var(--accent)" strokeWidth="2" /></svg></div>
      <div className="panel"><h3>The actual control loop</h3><div className="signal-chain"><span>SP − PV = error</span><b>→</b><span>{mode} controller</span><b>→</b><span>Heater 0–12 kW</span><b>→</b><span>Tank + heat loss</span></div><p className="lesson-hint">Heat capacity 12 kJ/°C; loss 0.2 kW/°C to 25 °C ambient. PI uses output limits and anti-windup. Mode changes clear the integrator; this is not a model of bumpless transfer.</p></div>
      <Prediction question="At a 60 °C setpoint, why can proportional-only control settle below 60 °C?" options={['It needs a persistent error to supply the heat being lost.', 'The SCADA link sets the temperature.', 'The heater cannot produce intermediate power.']} answer={0} explanation="With P control, zero error gives zero commanded heat. A nonzero error supplies the heat lost to ambient. Integral action can supply that steady output while bringing error toward zero. Compare P and PI after the tank settles." />
      <div className="callout">
        With the link cut, the equipment keeps moving but the supervisory value freezes. The red bar marks samples with bad quality. A dashboard must show quality and age, never just a number.
      </div>
    </>
  )
}


