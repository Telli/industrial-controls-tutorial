import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LABS, labById } from '../labs/registry'
import { LAB_CONTENT } from '../labs/content'
import { HANDBOOK_URL, tutorialsForLab } from '../tutorials/catalog'

const html = (s: string) => ({ __html: s })

export default function LabPage() {
  const { id = '' } = useParams()
  const lab = labById(id)

  if (!lab) {
    return (
      <div className="wrap lab-head">
        <h1>Lab not found</h1>
        <p><Link to="/labs">Back to all labs</Link></p>
      </div>
    )
  }
  const i = LABS.indexOf(lab)
  const prev = LABS[i - 1]
  const next = LABS[i + 1]
  const content = LAB_CONTENT[lab.id]
  const { Component } = lab
  return (
    <div className="wrap">
      <header className="lab-head">
        <div className="crumbs"><Link to="/labs">Labs</Link> / Lab {lab.n}</div>
        <h1>{lab.title}</h1>
        {content && <p className="lead" dangerouslySetInnerHTML={html(content.intro)} />}
        <p className="lab-goal"><b>In this lab:</b> {lab.goal}{content && <> <a href="#background" onClick={e => { e.preventDefault(); document.getElementById('background')?.scrollIntoView() }}>Read the background first ↓</a></>}</p>
      </header>
      <div className="lab-grid">
        <div className="stage">
          <Suspense fallback={<div className="skeleton">Loading lab…</div>}>
            <Component />
          </Suspense>
        </div>
        <aside className="side">
          <div className="panel try">
            <h3>Try this</h3>
            <ul>{lab.tryThis.map((t) => <li key={t} dangerouslySetInnerHTML={html(t)} />)}</ul>
          </div>
          <div className="panel real">
            <h3>In the real world</h3>
            <p>{lab.real}</p>
          </div>
          <div className="panel tutorial-links">
            <h3>Read the tutorial</h3>
            <ul>{tutorialsForLab(lab.id).map(article => <li key={article.id}><a href={article.href}>{article.title}</a></li>)}</ul>
            <a href={HANDBOOK_URL}>Complete course handbook →</a>
          </div>
          {lab.reading && (
            <div className="panel book-connection">
              <h3>Book connection</h3>
              <p><b>Petruzella, <i>Programmable Logic Controllers</i></b><br />Sixth edition, McGraw Hill, 2023</p>
              <p>{lab.reading}</p>
              <span className="lesson-hint">The exercises here are original; page numbers refer to the printed book.</span>
            </div>
          )}
          <div className="panel">
            <h3>Companion material</h3>
            <p className="mono" style={{ margin: 0 }}>{lab.companion}</p>
          </div>
        </aside>
      </div>

      {content && (
        <section className="lab-background" id="background" aria-labelledby="background-title">
          <div className="lab-background-text">
            <div className="eyebrow">Background</div>
            <h2 id="background-title">How it works</h2>
            {content.background.map(p => <p key={p} dangerouslySetInnerHTML={html(p)} />)}
            <details className="check">
              <summary>Check your understanding</summary>
              <p className="check-q">{content.check.q}</p>
              <p className="check-a"><b>Answer.</b> {content.check.a}</p>
            </details>
          </div>
          <dl className="lab-terms">
            <div className="eyebrow">Key terms</div>
            {content.terms.map(([term, definition]) => (
              <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>
            ))}
          </dl>
        </section>
      )}

      <nav className="lab-foot" aria-label="Lab navigation">
        {prev ? <Link to={`/labs/${prev.id}`}>← Lab {prev.n}: {prev.title}</Link> : <span />}
        {next ? <Link to={`/labs/${next.id}`}>Lab {next.n}: {next.title} →</Link> : <span />}
      </nav>
    </div>
  )
}
