import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

export default function ContextLossHandler({ onLost }: { onLost: () => void }) {
  const gl = useThree(state => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => { event.preventDefault(); onLost() }
    canvas.addEventListener('webglcontextlost', lost)
    // R3F deliberately loses the old context after unmounting. Remove our
    // listener first so resetting the camera cannot invalidate its replacement.
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}
