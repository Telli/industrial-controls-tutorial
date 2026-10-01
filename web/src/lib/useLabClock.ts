import { useEffect, useRef, useState } from 'react'

/** Simulation clocks pause in hidden tabs and avoid catch-up bursts. */
export function useLabClock(step: (dt: number) => void, running: boolean, interval = 100) {
  const action = useRef(step)
  const [, render] = useState(0)
  action.current = step
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      action.current(interval / 1000)
      render(n => n + 1)
    }, interval)
    return () => window.clearInterval(id)
  }, [running, interval])
  return () => render(n => n + 1)
}
