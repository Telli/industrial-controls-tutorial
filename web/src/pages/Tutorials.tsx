import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import {
  HANDBOOK_URL, PRIMARY_REFERENCES, READING_EDITION_URL, SOURCES_CHECKED_ON, SOURCE_ARTICLES, STUDY_PACK_URL, TUTORIALS,
} from '../tutorials/catalog'

const FILTERS = ['All tutorials', 'Foundations', 'Protocols & data', 'Architecture & operations']

export default function Tutorials() {
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('All tutorials')
  const location = useLocation()
  const scrollTarget = (location.state as { scrollTo?: string } | null)?.scrollTo

  useEffect(() => {
    if (!scrollTarget) return
    const id = window.setTimeout(() => document.getElementById(scrollTarget)?.scrollIntoView(), 0)
    return () => window.clearTimeout(id)
  }, [scrollTarget])

  const tutorials = TUTORIALS.filter(t => (topic === 'All tutorials' || t.topic === topic) && `${t.title} ${t.description} ${t.topic}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="wrap catalog tutorial-catalog">
    <header className="catalog-head">
      <div>
        <div className="eyebrow">THE WRITTEN COURSE / {TUTORIALS.length} TUTORIALS</div>
        <h1>Tutorials and handbook</h1>
        <p>Each tutorial explains one topic with a worked example, an exercise and a model answer, and links to the lab where you can try it. The handbook ties them together into a complete course.</p>
        <p className="credit-note">Adapted from Wackysoft’s .NET industrial-controls series, with original examples and exercises. <a href="#references" onClick={e => { e.preventDefault(); document.getElementById('references')?.scrollIntoView() }}>Sources and references</a></p>
      </div>
    </header>

    <section className="handbook-feature" aria-labelledby="handbook-title"><div><div className="eyebrow">START HERE · THE COMPLETE HANDBOOK</div><h2 id="handbook-title">Industrial controls with C#, from first signal to complete system</h2><p>Seventeen chapters for developers who know basic C# but are new to industrial systems: timing, protocols, decoding, data collection, storage, alarms, operator screens and AI tools with safeguards. Includes worked examples, model answers and an eight-week study plan.</p><div className="cta"><a className="btn" href={HANDBOOK_URL}>Read the handbook <Icon name="arrow" size={18} /></a><a className="inline-link" href={`${HANDBOOK_URL}#workbook`}>Guided C# lab workbook <Icon name="arrow" size={16} /></a></div></div><div className="handbook-numbers"><div><strong>17</strong><span>chapters</span></div><div><strong>14</strong><span>guided C# exercises</span></div><div><strong>8</strong><span>week study plan</span></div></div></section>

    <section aria-labelledby="articles-title"><div className="tutorial-section-head"><div><h2 id="articles-title">Tutorials by topic</h2><p>Each is a 6–18 minute read plus practice. Read them in order or pick the one you need.</p></div><a className="inline-link" href={READING_EDITION_URL}>Read all tutorials as one document <Icon name="arrow" size={16} /></a></div>
      <div className="catalog-toolbar"><div className="filter-tabs" role="group" aria-label="Filter tutorials by topic">{FILTERS.map(f => <button key={f} aria-pressed={topic === f} onClick={() => setTopic(f)}>{f}</button>)}</div><label className="search"><Icon name="search" size={17} /><input type="search" aria-label="Search tutorials" placeholder="Find a tutorial…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="catalog-count" role="status">{tutorials.length} of {TUTORIALS.length} tutorials</div>
      <div className="tutorial-grid">{tutorials.map(t => <a className="tutorial-card" href={t.href} key={t.id}><div className="tutorial-meta"><span>TUTORIAL {t.n}</span><span>{t.minutes} MIN READ</span></div><span className="tutorial-topic">{t.topic}</span><h3>{t.title}</h3><p>{t.description}</p><span className="tutorial-open">Read tutorial <Icon name="arrow" size={17} /></span></a>)}</div>
      {!tutorials.length && <div className="empty-state"><Icon name="search" size={32} /><h2>No matching tutorials</h2><p>Try a different term or show the full list.</p><button className="btn" onClick={() => { setQuery(''); setTopic('All tutorials') }}>Show all tutorials</button></div>}
    </section>

    <section className="tutorial-download"><Icon name="book" size={28} /><div><h2>Download the course</h2><p>The handbook, all {TUTORIALS.length} tutorials, plain-text editions and the runnable C# lab source in one ZIP file. Reading works offline; running the C# labs requires the .NET 10 SDK.</p></div><a className="btn ghost" href={STUDY_PACK_URL} download>Download study pack <Icon name="arrow" size={16} /></a></section>

    <section className="credits" id="references" aria-labelledby="references-title">
      <h2 id="references-title">Sources and references</h2>
      <p>The written course is an original English adaptation of <b>Wackysoft’s .NET industrial-controls series</b>, published in Chinese on CNBlogs: nine articles in the original series (S1–S9) and three later troubleshooting posts (S10–S12). Thanks to the author for a practical, well-organized series. The tutorials are not translations; each one summarizes its source in its own References section.</p>
      <ol className="source-list">{SOURCE_ARTICLES.map(s => <li key={s.id}><b>{s.id}</b> · {s.edition?.title ?? 'Source article'} <span>· {s.date} ·</span> <a href={s.url} lang="zh">{s.title}</a></li>)}</ol>
      <h3>Book</h3>
      <p>Frank D. Petruzella, <i>Programmable Logic Controllers</i>, sixth edition, McGraw Hill, 2023 (ISBN 978-1-265-15049-5). Labs 05 and 09–13 are original exercises informed by the chapters cited on each lab page. No book content is reproduced.</p>
      <h3>Technical references</h3>
      <ol>{PRIMARY_REFERENCES.map(r => <li key={r.id}><a href={r.url}>{r.title}</a> <span>— {r.supports}</span></li>)}</ol>
      <p className="credit-note">Links checked {SOURCES_CHECKED_ON}.</p>
    </section>
  </div>
}
