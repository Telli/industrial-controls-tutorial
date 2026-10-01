import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import { LABS, LAB_COUNT } from '../labs/registry'
import LabCard from '../components/LabCard'
import Icon from '../components/Icon'
import SceneBoundary from '../components/SceneBoundary'
import { HANDBOOK_URL, TUTORIALS } from '../tutorials/catalog'

const HeroScene = lazy(() => import('../components/HeroScene'))

export const STACK = [
  { lv: 'L0', name: 'Field devices', short: 'Field', text: 'Sensors measure the process (temperature, level, position). Actuators such as valves, heaters and motor drives change it.', protocol: 'Sensors · actuators · 4–20 mA and 24 V I/O', lab: '/labs/analog-scaling' },
  { lv: 'L1', name: 'Controllers and PLCs', short: 'Control', text: 'Rugged computers that read inputs, run logic and set outputs in a loop every few milliseconds. They keep the machine running even if everything above them fails.', protocol: 'Ladder logic · scan cycle · Modbus server', lab: '/labs/scan-cycle' },
  { lv: 'L2', name: 'SCADA and HMI', short: 'Supervision', text: 'Screens and servers that collect values from many controllers, show them to operators, raise alarms and pass operator requests back down.', protocol: 'OPC UA · alarms · operator screens', lab: '/labs/alarms' },
  { lv: 'L3', name: 'MES and historian', short: 'Operations', text: 'Systems that store process history and turn it into production records: batches, quality results, downtime.', protocol: 'Historian · batches · SQL', lab: '/labs/architecture' },
  { lv: 'L4', name: 'ERP and cloud', short: 'Enterprise', text: 'Business systems for orders, inventory and analytics. They consume summaries and never control equipment directly.', protocol: 'MQTT · analytics · ERP', lab: '/labs/architecture' },
]

function StackFallback() {
  return <div className="scene-fallback"><span className="eyebrow">The industrial data stack</span>{[...STACK].reverse().map(s => <div key={s.lv}><span>{s.lv}</span>{s.name}</div>)}<p>3D preview unavailable. The layers are described below.</p></div>
}

const CHAIN = [
  ['A sensor sees a bottle', 'A photoelectric sensor switches a 24 V signal on for a few milliseconds as each bottle passes.'],
  ['The PLC counts it', 'On its next scan the PLC sees the input, adds one to a counter and, if a camera flagged the bottle, fires a reject gate further down the line.'],
  ['The HMI shows it', 'A few times a second, SCADA software polls the PLC for the count and updates the operator’s screen.'],
  ['The historian records it', 'The count is stored with a timestamp, so the shift report can show output and rejects per hour.'],
  ['ERP plans with it', 'The business system uses the totals to reorder caps and labels.'],
]

const AUDIENCE = [
  ['Software developers', 'You know C#, Python or JavaScript and have been asked to connect to machines. You’ll learn what the controllers are doing and why their data behaves the way it does.'],
  ['Students and career changers', 'You want to understand industrial automation without buying hardware. Each lab starts from first principles and explains its terms.'],
  ['Technicians and engineers', 'You know the plant floor and want to understand the IT side: protocols, data quality, historians and store-and-forward.'],
]

const METHOD = [
  { n: '01', title: 'Predict', text: 'Each lab starts from a question. Decide what you expect to happen before you touch the controls.' },
  { n: '02', title: 'Change one thing', text: 'Slow down a poller, swap two bytes or cut a network link. The model reacts immediately, and the charts show why.' },
  { n: '03', title: 'Explain', text: 'The background section explains the concept, defines the terms and ends with a question to check your understanding.' },
]

export default function Landing() {
  const [layer, setLayer] = useState(1)
  return <>
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> A free, hands-on course in industrial controls</div>
          <h1>How machines turn signals into <em>decisions.</em></h1>
          <p className="lead">Factories, water plants and warehouses run on small dedicated computers that read sensors and switch motors many times a second. Software above them watches, records and reports. Learn how that data moves, and where it goes wrong, with {LABS.length} browser labs and a written course.</p>
          <div className="cta"><Link className="btn" to="/labs/scan-cycle">Start with lab 01 <Icon name="arrow" size={18} /></Link><button className="text-button" onClick={() => document.getElementById('intro')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>New to this? Read the introduction <span>↓</span></button></div>
          <div className="hero-note"><span><Icon name="check" size={14} /> Runs in your browser</span><span><Icon name="check" size={14} /> No hardware needed</span><span><Icon name="check" size={14} /> Optional C# exercises</span></div>
        </div>
        <div className="hero-visual">
          <div className="scene-heading"><span><span className="status-dot" /> THE FIVE LAYERS OF A PLANT</span><span>SELECT A LAYER</span></div>
          <div className="hero-canvas" role="region" aria-label="Interactive 3D plant stack. Select a layer using the buttons below.">
            <SceneBoundary fallback={<StackFallback />}><Suspense fallback={<div className="scene-loading"><span className="loading-stack">▱<br />▱<br />▱</span>Loading 3D view…</div>}><HeroScene selected={layer} onSelect={setLayer} /></Suspense></SceneBoundary>
          </div>
          <div className="layer-selector" aria-label="Plant layers">{STACK.map((s, i) => <button key={s.lv} onClick={() => setLayer(i)} aria-pressed={layer === i}><span>{s.lv}</span>{s.short}</button>)}</div>
          <div className="scene-caption" aria-live="polite"><div><span className="caption-level">{STACK[layer].lv}</span><strong>{STACK[layer].name}</strong></div><p>{STACK[layer].text}</p></div>
        </div>
      </div>
      <div className="wrap hero-bottom"><span>WHAT’S INCLUDED</span><div><b>{LAB_COUNT}</b> interactive labs</div><div><b>{TUTORIALS.length}</b> tutorials</div><div><b>17</b> handbook chapters</div><div><b>14</b> C# exercises</div></div>
    </section>

    <section className="block" id="intro" style={{ scrollMarginTop: 70 }}><div className="wrap">
      <div className="section-head"><div className="eyebrow">NEW TO INDUSTRIAL CONTROLS?</div><h2>One bottle, five systems</h2><p>Industrial control means using computers to run physical equipment. Follow a single bottle on a packaging line and you meet every part of it.</p></div>
      <div className="intro-grid">
        <ol className="intro-chain">{CHAIN.map(([title, text]) => <li key={title}><div><b>{title}</b><span>{text}</span></div></li>)}</ol>
        <div>
          <p>Each of those hand-offs takes time, and each can lose or distort information. The PLC samples its input only once per scan, so a fast enough pulse can slip between two samples. The HMI polls even less often. A number decoded with the wrong byte order looks perfectly plausible. A network outage freezes a screen that still looks live.</p>
          <p>Engineers who build these systems spend much of their time on exactly these problems. The labs here let you cause each of them on purpose, watch what happens and learn the standard fix, without wiring anything.</p>
          <p>The written course goes further. It covers how to build a reliable C# data-collection service, store measurements and production records, design honest operator screens, and give an AI assistant read-only access to plant data with proper safeguards.</p>
          <Link className="inline-link" to="/labs/scan-cycle">See the first hand-off in lab 01 <Icon name="arrow" size={17} /></Link>
        </div>
      </div>
      <div className="audience">{AUDIENCE.map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>
    </div></section>

    <section className="wrap"><div className="reading-banner"><Icon name="book" size={32} /><div><div className="eyebrow">THE WRITTEN COURSE</div><h2>Read the explanations behind each lab</h2><p>{TUTORIALS.length} tutorials, a 17-chapter handbook with an eight-week study plan, and 14 guided C# exercises that run against a simulated tank and Modbus device.</p></div><div className="reading-actions"><Link className="btn" to="/tutorials">Browse tutorials <Icon name="arrow" size={17} /></Link><a className="inline-link" href={HANDBOOK_URL}>Open the handbook <Icon name="arrow" size={16} /></a></div></div></section>

    <section className="block" id="labs"><div className="wrap">
      <div className="section-head split"><div><div className="eyebrow">THE LABS</div><h2>{LABS.length} experiments, from a single input to a whole plant</h2></div><div><p>Each lab is a small working model of one problem you’ll meet on real equipment. The recommended order follows a signal from the sensor upward.</p><Link className="inline-link" to="/labs">Filter and search the labs <Icon name="arrow" size={17} /></Link></div></div>
      <div className="cards">{LABS.map(l => <LabCard lab={l} key={l.id} />)}</div>
    </div></section>

    <section className="block alt" id="stack"><div className="wrap stack-grid"><div className="section-head"><div className="eyebrow">THE BIG PICTURE</div><h2>Five layers, from sensor to spreadsheet</h2><p>Lower layers react in milliseconds and keep running on their own. Upper layers work in seconds to days and depend on everything below. Most integration bugs appear at the boundaries between layers.</p><Link className="inline-link" to="/labs/architecture">Explore the plant architecture lab <Icon name="arrow" size={18} /></Link><div className="stack-note"><span className="mono">FIELD → ENTERPRISE</span><p>Milliseconds at the bottom.<br />Hours and days at the top.</p></div></div><div className="layers">{[...STACK].reverse().map(s => <Link to={s.lab} className="layer" key={s.lv}><span className="lv">{s.lv}</span><div><h3>{s.name}</h3><span>{s.protocol}</span></div><Icon name="diagonal" size={18} /></Link>)}</div></div></section>

    <section className="block"><div className="wrap"><div className="section-head"><div className="eyebrow">HOW EACH LAB WORKS</div><h2>Predict, experiment, explain</h2></div><div className="uses">{METHOD.map(u => <div className="use" key={u.n}><span className="use-number">{u.n}</span><h3>{u.title}</h3><p>{u.text}</p></div>)}</div></div></section>

    <section className="wrap"><div className="start-banner"><div><div className="eyebrow">WHERE TO START</div><h2>Lab 01: why a value you read may already be out of date</h2><p>Follow a 15 ms pulse through a PLC scan and a 100 ms poll, and see which events survive.</p></div><Link className="btn" to="/labs/scan-cycle">Open lab 01 <Icon name="arrow" size={18} /></Link></div></section>

    <section className="wrap credits" aria-labelledby="credits-title"><h2 id="credits-title">Credits</h2><p>The written course builds on Wackysoft’s .NET industrial-controls article series. The labs draw on Frank D. Petruzella’s <i>Programmable Logic Controllers</i>, Tony R. Kuphaldt’s openly licensed <i>Lessons in Industrial Instrumentation</i>, and free primary sources including the Modbus specifications, NIST SP 800-82, NUREG-0700 and public incident investigations. All lessons, labs and simulations are original. <Link to="/tutorials" state={{ scrollTo: 'references' }}>Full sources and references</Link>.</p></section>
  </>
}
