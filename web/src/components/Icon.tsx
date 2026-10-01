import type { CSSProperties } from 'react'

const paths = {
  book: 'M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  diagonal: 'M6 18 18 6M6 6h12v12',
  sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20.7 13a9 9 0 0 1-9.7-9.7A9 9 0 1 0 20.7 13Z',
  search: 'M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 5 11 7-11 7V5Z',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  chip: 'M7 7h10v10H7ZM9 1v6m6-6v6M9 17v6m6-6v6M1 9h6m-6 6h6m10-6h6m-6 6h6',
  check: 'm5 12 4 4L19 6',
} as const

export default function Icon({ name, size = 20, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>
}
