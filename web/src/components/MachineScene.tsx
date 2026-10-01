import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { TrackedPart } from '../lib/plc'
import { useTheme } from './Theme'
import SceneBoundary from './SceneBoundary'
import ContextLossHandler from './ContextLossHandler'
import Icon from './Icon'

type MachineProps = { kind: 'motor' | 'batch' | 'conveyor'; active?: boolean; level?: number; slots?: (TrackedPart | null)[]; paused?: boolean }
function Equipment({ kind, active = false, level = 0, slots = [], moving }: MachineProps & { moving: boolean }) {
  const { theme } = useTheme()
  const rotor = useRef<THREE.Group>(null)
  const navy = theme === 'light' ? '#294d80' : '#799ecc'
  const metal = theme === 'light' ? '#8c9db4' : '#536c8e'
  useFrame((_, dt) => { if (rotor.current && moving && active) rotor.current.rotation.z += Math.min(dt, .05) * 5 })
  return <>
    <ambientLight intensity={1.6} /><directionalLight position={[3, 6, 4]} intensity={2.4} /><directionalLight position={[-4, 2, 1]} intensity={1.2} />
    <gridHelper args={[12, 24, theme === 'light' ? '#becde0' : '#2c4669', theme === 'light' ? '#d7e1ed' : '#1e3451']} position={[0, -.05, 0]} />
    {kind === 'motor' && <group>
      <mesh position={[0, .17, 0]}><boxGeometry args={[2.5, .25, 1.4]} /><meshStandardMaterial color={metal} /></mesh>
      <mesh position={[0, .85, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.6, .6, 1.7, 32]} /><meshStandardMaterial color={navy} roughness={.4} metalness={.3} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, .85, -.65 + i * .18]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.6, .025, 8, 32]} /><meshStandardMaterial color={metal} /></mesh>)}
      <mesh position={[0, 1.5, -.2]}><boxGeometry args={[.5, .25, .55]} /><meshStandardMaterial color={navy} /></mesh>
      <mesh position={[0, .85, 1.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.13, .13, .6, 24]} /><meshStandardMaterial color={metal} metalness={.5} roughness={.3} /></mesh>
      <group ref={rotor} position={[0, .85, 1.36]}>{[0, 1, 2, 3].map(i => <mesh key={i} rotation={[0, 0, i * Math.PI / 2]} position={[0, 0, 0]}><boxGeometry args={[.85, .09, .04]} /><meshStandardMaterial color={navy} /></mesh>)}</group>
      <mesh position={[-1.25, .55, .65]}><sphereGeometry args={[.09, 16, 16]} /><meshBasicMaterial color={active ? '#43b992' : '#8c9db4'} /></mesh>
    </group>}
    {kind === 'batch' && <group>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[.85, .85, 2.2, 40, 1, true]} /><meshStandardMaterial color={metal} transparent opacity={.16} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, .06, 0]}><cylinderGeometry args={[.9, .9, .12, 40]} /><meshStandardMaterial color={navy} /></mesh>
      <mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.86, .045, 8, 40]} /><meshStandardMaterial color={metal} /></mesh>
      <mesh position={[0, .12 + level / 100, 0]}><cylinderGeometry args={[.81, .81, Math.max(.01, level / 50), 40]} /><meshStandardMaterial color={navy} transparent opacity={.65} depthWrite={false} /></mesh>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[.04, .04, 2.4, 12]} /><meshStandardMaterial color={metal} /></mesh>
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 1, 0]}><group ref={rotor}><mesh><boxGeometry args={[1.15, .1, .07]} /><meshStandardMaterial color={metal} /></mesh><mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[1.15, .1, .07]} /><meshStandardMaterial color={metal} /></mesh></group></group>
      <mesh position={[-1.25, 2.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.07, .07, 1, 12]} /><meshStandardMaterial color={metal} /></mesh>
      <mesh position={[1.25, .3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.07, .07, 1, 12]} /><meshStandardMaterial color={metal} /></mesh>
    </group>}
    {kind === 'conveyor' && <group>
      <mesh position={[0, .55, 0]}><boxGeometry args={[5.8, .22, 1.3]} /><meshStandardMaterial color={navy} /></mesh>
      {[-2.2, 2.2].map(x => <mesh key={x} position={[x, .2, 0]}><boxGeometry args={[.14, .6, 1.2]} /><meshStandardMaterial color={metal} /></mesh>)}
      {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[-2.65 + i * .31, .68, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.07, .07, 1.2, 12]} /><meshStandardMaterial color={metal} /></mesh>)}
      {slots.map((part, i) => part && <mesh key={part.id} position={[-2.4 + i * .95, .98, 0]}><boxGeometry args={[.48, .48, .55]} /><meshStandardMaterial color={part.reject ? '#ce647b' : navy} /></mesh>)}
      <mesh position={[2.35, .9, -.95]}><boxGeometry args={[.35, .6, .35]} /><meshStandardMaterial color={metal} /></mesh>
    </group>}
    <OrbitControls enablePan={false} enableZoom={false} enableDamping={false} target={[0, 1, 0]} minPolarAngle={.6} maxPolarAngle={1.5} />
  </>
}

export default function MachineScene(props: MachineProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [hidden, setHidden] = useState(document.hidden)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [lost, setLost] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    if (ref.current) observer.observe(ref.current)
    const visibility = () => setHidden(document.hidden)
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches)
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion) }
  }, [])
  const moving = visible && !hidden && !reduced && !props.paused
  const fallback = <div className="scene-loading"><Icon name="chip" size={40} /><p>3D preview unavailable.<br />The diagrams, readings and controls still work.</p></div>
  return <div className="canvas3d machine-scene" ref={ref}><div className="hud">{props.kind.toUpperCase()} · drag to orbit</div><button className="machine-reset" onClick={() => { setLost(false); setVersion(v => v + 1) }} aria-label="Reset machine view"><Icon name="reset" size={15} /></button><SceneBoundary key={version} fallback={fallback}>{lost ? fallback : <Canvas camera={{ position: props.kind === 'conveyor' ? [6, 5, 8] : [3.6, 3.1, 5.5], fov: 45 }} frameloop={moving && props.active ? 'always' : 'demand'} dpr={[1, 1.5]} gl={{ powerPreference: 'low-power', antialias: true }} fallback={fallback}><ContextLossHandler onLost={() => setLost(true)} /><Equipment {...props} moving={moving} /></Canvas>}</SceneBoundary></div>
}
