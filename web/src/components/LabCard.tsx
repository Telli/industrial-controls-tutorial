import { Link } from 'react-router-dom'
import type { LabMeta } from '../labs/registry'
import Icon from './Icon'

export const LAB_TOPICS: Record<string, string> = {
  'scan-cycle': 'Signals & timing', 'byte-order': 'Data & protocols', 'packed-bits': 'Data & protocols',
  'tcp-framing': 'Data & protocols', 'tank-3d': 'Control & systems', alarms: 'Signals & timing',
  architecture: 'Control & systems', 'protocol-picker': 'Data & protocols',
  'ladder-logic': 'PLC foundations', 'timers-counters': 'PLC foundations', 'analog-scaling': 'PLC foundations',
  sequencing: 'Control & systems', troubleshooting: 'Control & systems',
}

export function LabArtwork({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 320 130" fill="none" className="lab-art" aria-hidden="true">
      {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${i * 24} 0v130`} stroke="currentColor" opacity=".045" />)}
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M0 ${i * 24}h320`} stroke="currentColor" opacity=".045" />)}
      {id === 'scan-cycle' && <g stroke="currentColor" strokeWidth="2"><path d="M28 48h35V24h43v24h55V24h43v24h72" /><path d="M28 96h63V72h43v24h55V72h43v24h44" opacity=".4" />{[63, 106, 161, 204].map(x => <path key={x} d={`M${x} 18v94`} strokeDasharray="2 4" opacity=".18" />)}</g>}
      {['byte-order', 'packed-bits', 'tcp-framing'].includes(id) && <g>{[0, 1, 2, 3].map(i => <g key={i}><rect x={40 + i * 62} y="34" width="52" height="48" rx="6" fill="currentColor" fillOpacity={i === 0 ? '.12' : '.04'} stroke="currentColor" strokeOpacity=".3" /><text x={66 + i * 62} y="64" textAnchor="middle" fill="currentColor" fontSize={id === 'packed-bits' ? 12 : 16} fontFamily="monospace">{id === 'byte-order' ? ['41', 'CC', '00', '00'][i] : id === 'packed-bits' ? ['0010', '1100', '0001', '0100'][i] : ['ID', 'LEN', 'FC', 'DATA'][i]}</text><path d={`M${66 + i * 62} 88v10h${i % 2 ? -62 : 62}`} stroke="currentColor" opacity=".35" /></g>)}</g>}
      {id === 'tank-3d' && <g stroke="currentColor" strokeWidth="1.5"><path d="M124 28v65c0 18 72 18 72 0V28" fill="currentColor" fillOpacity=".05" /><ellipse cx="160" cy="28" rx="36" ry="12" /><path d="M124 62c0 17 72 17 72 0v31c0 18-72 18-72 0Z" fill="currentColor" fillOpacity=".15" /><path d="M196 84h39V55h28M124 84H89V55H60M174 16v62" /><circle cx="89" cy="84" r="5" fill="var(--panel)" /><path d="m85 84 4-3 4 3-4 3Z" /></g>}
      {id === 'alarms' && <g stroke="currentColor"><path d="M25 40h270M25 87h270" strokeDasharray="4 5" opacity=".25" /><path d="m26 92 20-5 17 7 20-18 16 8 20-26 13 5 15-34 13 12 14-22 15 11 20-7 14 29 16-8 19 32 20 4" strokeWidth="2" /><rect x="140" y="18" width="72" height="96" fill="currentColor" fillOpacity=".05" stroke="none" /></g>}
      {id === 'architecture' && <g stroke="currentColor" strokeWidth="1.5"><path d="M78 64h52m60 0h52M160 42V22h82M160 86v24H78" opacity=".4" />{[[34, 44], [130, 44], [242, 44], [242, 8], [34, 92]].map(([x, y], i) => <rect key={i} x={x} y={y} width={i === 1 ? 60 : 44} height={i > 2 ? 26 : 40} rx="5" fill="currentColor" fillOpacity={i === 1 ? '.14' : '.04'} strokeOpacity=".55" />)}<path d="M144 57h32m-32 7h20m-20 7h26" /></g>}
      {id === 'protocol-picker' && <g fill="currentColor">{[150, 205, 116].map((w, i) => <g key={w}><rect x="53" y={25 + i * 30} width="216" height="13" rx="3" opacity=".06" /><rect x="53" y={25 + i * 30} width={w} height="13" rx="3" opacity={.25 + i * .25} /></g>)}</g>}
      {id === 'ladder-logic' && <g stroke="currentColor" strokeWidth="2"><path d="M36 20v94M284 20v94M36 51h30m22 0h70m22 0h54m22 0h28M126 51v47h32m22 0h26V51" opacity=".55" />{[[66, 51], [158, 51], [158, 98]].map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y - 11}v22m22-22v22`} />)}<path d="M238 38q-12 13 0 26m14-26q12 13 0 26" /><g fill="currentColor" stroke="none" fontFamily="monospace" fontSize="10"><text x="58" y="27">STOP</text><text x="150" y="27">START</text><text x="229" y="27">MOTOR</text></g></g>}
      {id === 'timers-counters' && <g stroke="currentColor" strokeWidth="2"><circle cx="89" cy="61" r="35" fill="currentColor" fillOpacity=".04" /><path d="M89 38v24l17 12M77 17h24M89 17v9" /><path d="M151 42h22V25h33v17h28V25h33v17h20" opacity=".65" /><path d="M151 71h55V54h60v17h21" opacity=".3" /><text x="151" y="104" fill="currentColor" stroke="none" fontSize="12" fontFamily="monospace">ACC  02 / 05</text></g>}
      {id === 'analog-scaling' && <g stroke="currentColor" strokeWidth="1.5"><path d="M49 20v81h225" opacity=".4" /><path d="M50 96 265 27" strokeWidth="2.5" /><path d="M156 62v39m-107-39h107" strokeDasharray="4 4" opacity=".5" /><circle cx="156" cy="62" r="5" fill="var(--panel)" strokeWidth="2" /><g fill="currentColor" stroke="none" fontFamily="monospace" fontSize="10"><text x="43" y="117">4 mA</text><text x="235" y="117">20 mA</text><text x="166" y="59">12 mA → 50 °C</text></g></g>}
      {id === 'sequencing' && <g stroke="currentColor" strokeWidth="1.5">{['FILL', 'MIX', 'DRAIN'].map((s, i) => <g key={s}><rect x={32 + i * 91} y="43" width="70" height="41" rx="6" fill="currentColor" fillOpacity={i === 1 ? '.14' : '.03'} /><text x={67 + i * 91} y="68" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="monospace" fontSize="11">{s}</text>{i < 2 && <path d={`M${104 + i * 91} 64h15m-5-4 5 4-5 4`} />}</g>)}<path d="M249 85v20H67V86m-4 5 4-5 4 5" opacity=".4" /><text x="158" y="28" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="monospace" fontSize="10">001 → 010 → 100</text></g>}
      {id === 'troubleshooting' && <g stroke="currentColor" strokeWidth="1.5"><rect x="52" y="25" width="147" height="81" rx="7" fill="currentColor" fillOpacity=".03" />{[0, 1, 2].map(i => <g key={i}><circle cx="71" cy={44 + i * 22} r="4" fill="currentColor" fillOpacity={i === 1 ? '.08' : '.6'} /><path d={`M85 ${44 + i * 22}h${i === 1 ? 28 : 73}`} opacity=".5" /></g>)}<circle cx="224" cy="58" r="25" fill="var(--panel)" strokeWidth="2.5" /><path d="m241 77 23 25M213 58h7l4-8 5 16 4-8h6" strokeWidth="2.5" /></g>}
    </svg>
  )
}

export default function LabCard({ lab }: { lab: LabMeta }) {
  return (
    <Link className="card lab-card" to={`/labs/${lab.id}`}>
      <div className="card-art"><span className="card-number">LAB {lab.n}</span><LabArtwork id={lab.id} /></div>
      <div className="card-body">
        <span className="card-topic">{LAB_TOPICS[lab.id]}</span>
        <h3>{lab.title}</h3><p>{lab.blurb}</p>
        <div className="card-bottom"><span>{lab.tags.includes('three.js') ? 'Interactive 3D lab' : lab.id === 'architecture' ? 'Interactive system map' : 'Interactive experiment'}</span><Icon name="diagonal" size={17} /></div>
      </div>
    </Link>
  )
}
