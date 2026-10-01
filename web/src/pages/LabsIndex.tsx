import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LABS, LAB_COUNT, LEARNING_PATH } from '../labs/registry'
import LabCard, { LAB_TOPICS, LabArtwork } from '../components/LabCard'
import Icon from '../components/Icon'

const FILTERS = ['All labs', 'Signals & timing', 'Data & protocols', 'Control & systems', 'PLC foundations']

export default function LabsIndex() {
  const [filter, setFilter] = useState('All labs')
  const [query, setQuery] = useState('')
  const labs = LABS.filter(l => (filter === 'All labs' || LAB_TOPICS[l.id] === filter) && `${l.title} ${l.blurb} ${LAB_TOPICS[l.id]}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="wrap catalog">
    <header className="catalog-head"><div><div className="eyebrow">THE LABS / {LAB_COUNT} EXPERIMENTS</div><h1>All labs</h1><p>Each lab is a working model of one problem from real industrial systems, with controls to change it, a background explanation and a question to check your understanding. Work through them in the recommended order below, or filter by topic.</p></div></header>
    <p className="catalog-reading">Prefer to read first? <Link to="/tutorials">Browse the tutorials and handbook <Icon name="arrow" size={15} /></Link></p>
    <Link to="/labs/scan-cycle" className="featured-lab"><div><span className="eyebrow">NEW HERE? START WITH LAB 01</span><h2>A snapshot of a snapshot</h2><p>Follow a field pulse through a PLC scan and discover why a poller can miss it entirely.</p><span className="inline-link">Open the scan cycle lab <Icon name="arrow" size={18} /></span></div><LabArtwork id="scan-cycle" /></Link>
    <nav className="learning-path" aria-label="Recommended learning path"><span>RECOMMENDED ORDER</span>{LEARNING_PATH.map(id => { const lab = LABS.find(l => l.id === id)!; return <Link key={id} to={`/labs/${id}`}><b>{lab.n}</b>{lab.title}</Link> })}</nav>
    <div className="catalog-toolbar"><div className="filter-tabs" role="group" aria-label="Filter labs by topic">{FILTERS.map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}{f === 'All labs' && <span>{LAB_COUNT}</span>}</button>)}</div><label className="search"><Icon name="search" size={17} /><input type="search" aria-label="Search labs" placeholder="Find a lab…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <div className="catalog-count" role="status">{labs.length} of {LABS.length} labs</div>
    <div className="cards">{labs.map(l => <LabCard lab={l} key={l.id} />)}</div>
    {labs.length === 0 && <div className="empty-state"><Icon name="search" size={32} /><h2>No matching labs</h2><p>Try another search term or show every lab.</p><button className="btn" onClick={() => { setQuery(''); setFilter('All labs') }}>Show all labs <Icon name="arrow" size={17} /></button></div>}
  </div>
}

