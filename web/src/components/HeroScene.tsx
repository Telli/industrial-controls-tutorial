import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useTheme, type Theme } from './Theme'
import Icon from './Icon'
import ContextLossHandler from './ContextLossHandler'

const LEVELS = [-2.15, -1.1, -.05, 1, 2.05]
const PACKET_COUNT = 24
const PALETTES = {
  light: { plate: '#d2ddec', edge: '#8096b4', active: '#243f72', hardware: '#294676', detail: '#98acc7', signal: '#527dcc', floor: '#c4d0e2' },
  dark: { plate: '#263d60', edge: '#53749e', active: '#789fdf', hardware: '#7298c8', detail: '#b0c8e8', signal: '#b1d6ff', floor: '#293f5d' },
}

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.45} metalness={.2} /></mesh>
}

function Hardware({ level, theme }: { level: number; theme: Theme }) {
  const c = PALETTES[theme]
  if (level === 0) return <group>
    <mesh position={[-.64, .32, .1]}><cylinderGeometry args={[.34, .34, .55, 32]} /><meshStandardMaterial color={c.hardware} metalness={.45} roughness={.32} /></mesh>
    <mesh position={[-.64, .61, .1]}><cylinderGeometry args={[.28, .28, .025, 32]} /><meshStandardMaterial color={c.detail} /></mesh>
    <Box position={[.65, .2, .1]} size={[.55, .3, .55]} color={c.hardware} />
    <Box position={[.03, .12, .1]} size={[.95, .07, .09]} color={c.detail} />
    <Box position={[.67, .43, .1]} size={[.08, .22, .08]} color={c.detail} />
  </group>
  if (level === 1) return <group><Box position={[-.55, .27, .05]} size={[.57, .46, .62]} color={c.hardware} />{[0, 1, 2, 3].map(i => <group key={i}><Box position={[-.1 + i * .27, .25, .05]} size={[.22, .42, .62]} color={i % 2 ? c.detail : c.hardware} /><Box position={[-.1 + i * .27, .4, .37]} size={[.07, .04, .015]} color={c.signal} /></group>)}</group>
  if (level === 2) return <group><Box position={[0, .16, .1]} size={[.65, .1, .4]} color={c.hardware} /><Box position={[0, .35, 0]} size={[.12, .36, .12]} color={c.hardware} /><Box position={[0, .55, 0]} size={[1.22, .64, .12]} color={c.hardware} /><Box position={[0, .55, .071]} size={[1.04, .45, .012]} color={theme === 'light' ? '#b7cce5' : '#14263f'} />{[0, 1, 2, 3].map(i => <Box key={i} position={[-.36 + i * .24, .48 + i * .035, .085]} size={[.13, .09 + i * .07, .015]} color={c.signal} />)}</group>
  return <group>{[0, 1, 2].map(i => <group key={i}><Box position={[-.68 + i * .68, .27, 0]} size={[.53, .44, .65]} color={c.hardware} />{[0, 1, 2].map(j => <Box key={j} position={[-.68 + i * .68, .16 + j * .1, .332]} size={[.34, .026, .012]} color={c.detail} />)}</group>)}</group>
}

function Layer({ level, selected, theme, onSelect }: { level: number; selected: number; theme: Theme; onSelect: (level: number) => void }) {
  const c = PALETTES[theme]
  const active = level === selected
  return <group position={[0, LEVELS[level], 0]} onClick={e => { e.stopPropagation(); onSelect(level) }}>
    <mesh><boxGeometry args={[3.2, .1, 1.9]} /><meshStandardMaterial color={active ? c.active : c.plate} roughness={.5} metalness={.15} /><Edges color={active ? c.signal : c.edge} /></mesh>
    <Box position={[-1.1, .06, .76]} size={[.48, .015, .04]} color={active ? c.detail : c.edge} />
    <Hardware level={level} theme={theme} />
  </group>
}

function Packets({ running, theme }: { running: boolean; theme: Theme }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const elapsed = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, delta) => {
    if (running) elapsed.current += Math.min(delta, .05)
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < PACKET_COUNT; i++) {
      const phase = (elapsed.current * .13 + i / PACKET_COUNT) % 1
      dummy.position.set(i % 2 ? 1.43 : -1.43, -2.1 + phase * 4.55, i % 3 ? .78 : -.78)
      dummy.scale.setScalar(.035 + Math.sin(phase * Math.PI) * .025)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[undefined, undefined, PACKET_COUNT]} frustumCulled={false}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color={PALETTES[theme].signal} toneMapped={false} /></instancedMesh>
}

function Plant({ selected, onSelect, running, theme }: { selected: number; onSelect: (level: number) => void; running: boolean; theme: Theme }) {
  const c = PALETTES[theme]
  return <>
    <ambientLight intensity={theme === 'light' ? 1.7 : 1.1} />
    <directionalLight position={[3, 8, 5]} intensity={2.3} color="#e5eeff" />
    <directionalLight position={[-4, 3, -3]} intensity={1.3} color="#809ecb" />
    <group position={[0, -.3, 0]}>
      {LEVELS.map((_, i) => <Layer key={i} level={i} selected={selected} onSelect={onSelect} theme={theme} />)}
      {[-1.43, 1.43].map(x => <mesh position={[x, 0, -.78]} key={x}><cylinderGeometry args={[.008, .008, 4.3, 6]} /><meshBasicMaterial color={c.edge} transparent opacity={.55} /></mesh>)}
      <Packets running={running} theme={theme} />
      <gridHelper args={[9, 18, c.floor, c.floor]} position={[0, -2.32, 0]} />
    </group>
    <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping={false} minPolarAngle={Math.PI / 3.3} maxPolarAngle={Math.PI / 2.3} minAzimuthAngle={-.8} maxAzimuthAngle={.9} target={[0, .1, 0]} />
  </>
}

export default function HeroScene({ selected, onSelect }: { selected: number; onSelect: (level: number) => void }) {
  const { theme } = useTheme()
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const [cameraKey, setCameraKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => setPaused(media.matches)
    const visibility = () => setPageVisible(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' })
    if (container.current) observer.observe(container.current)
    media.addEventListener('change', reduce)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); media.removeEventListener('change', reduce); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  const running = !paused && visible && pageVisible
  const unavailable = <div className="scene-loading"><Icon name="chip" size={48} /><p>The 3D view is unavailable.<br />Use the layer buttons to explore the system.</p></div>
  return <div ref={container} className="scene-container">
    {contextLost ? unavailable : <Canvas key={cameraKey} orthographic camera={{ position: [6, 4.5, 8], zoom: 64, near: .1, far: 40 }} dpr={[1, 1.5]} frameloop={running ? 'always' : 'demand'} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={unavailable} onCreated={({ gl }) => gl.domElement.setAttribute('aria-label', 'Five layers from field devices to enterprise systems')}>
      <ContextLossHandler onLost={() => setContextLost(true)} />
      <Plant selected={selected} onSelect={onSelect} running={running} theme={theme} />
    </Canvas>}
    <div className="scene-controls"><span>DRAG TO EXPLORE</span><div><button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play data flow' : 'Pause data flow'} aria-pressed={paused} title={paused ? 'Play data flow' : 'Pause data flow'}><Icon name={paused ? 'play' : 'pause'} size={14} /></button><button onClick={() => { setContextLost(false); setCameraKey(k => k + 1) }} aria-label="Reset 3D view" title="Reset 3D view"><Icon name="reset" size={14} /></button></div></div>
  </div>
}
