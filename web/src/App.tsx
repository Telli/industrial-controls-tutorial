import { useEffect } from 'react'
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import LabsIndex from './pages/LabsIndex'
import LabPage from './pages/LabPage'
import Tutorials from './pages/Tutorials'
import { ThemeProvider, useTheme } from './components/Theme'
import Icon from './components/Icon'
import { LABS, LAB_COUNT, labById } from './labs/registry'

function RoutePosition() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (pathname === '/') document.title = 'Industrial Controls Lab — interactive course'
    if (pathname === '/labs') document.title = 'Explore the labs · Industrial Controls Lab'
    if (pathname === '/tutorials') document.title = 'Tutorials & handbook · Industrial Controls Lab'
    const lab = pathname.startsWith('/labs/') ? labById(pathname.split('/')[2]) : undefined
    if (lab) document.title = `${lab.title} · Industrial Controls Lab`
    window.dispatchEvent(new CustomEvent('course:pageview', { detail: {
      path: pathname, title: document.title,
      group: lab ? 'Labs' : pathname === '/tutorials' ? 'Tutorials' : pathname === '/labs' ? 'Lab directory' : 'Overview',
    } }))
  }, [pathname])
  return null
}

function Brand() {
  return <Link to="/" className="brand" aria-label="Industrial Controls Lab home"><span className="brand-mark"><Icon name="chip" size={22} /></span><span>Industrial Controls<span className="brand-sub">THE INTERACTIVE LAB</span></span></Link>
}

function Nav() {
  const { theme, toggleTheme } = useTheme()
  return (
    <header className="nav"><div className="wrap">
      <Brand />
      <nav className="links" aria-label="Main"><NavLink to="/" end>Overview</NavLink><NavLink to="/tutorials">Tutorials</NavLink><NavLink to="/labs">Explore labs <span className="nav-count">{LAB_COUNT}</span></NavLink></nav>
      <div className="nav-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /><span>{theme === 'light' ? 'Dark' : 'Light'}</span></button><Link to="/labs/scan-cycle" className="btn small nav-start">Start learning <Icon name="arrow" size={16} /></Link></div>
    </div></header>
  )
}

export default function App() {
  return <ThemeProvider><HashRouter>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <RoutePosition /><Nav />
    <main id="main-content" tabIndex={-1}><Routes><Route path="/" element={<Landing />} /><Route path="/tutorials" element={<Tutorials />} /><Route path="/labs" element={<LabsIndex />} /><Route path="/labs/:id" element={<LabPage />} /><Route path="*" element={<LabsIndex />} /></Routes></main>
    <footer className="footer"><div className="wrap footer-top"><Brand /><p>A hands-on course in industrial controls<br />and the software around them.</p><nav className="footer-reading" aria-label="Learning resources"><Link to="/tutorials">Tutorials & handbook <Icon name="arrow" size={16} /></Link><Link to="/labs">Explore all {LABS.length} labs <Icon name="arrow" size={16} /></Link></nav></div><div className="wrap footer-bottom"><span>Written course adapted from Wackysoft’s .NET industrial-controls series. <Link to="/tutorials" state={{ scrollTo: 'references' }}>Sources</Link></span><span>Teaching models. Not certified control or safety software.</span></div></footer>
  </HashRouter></ThemeProvider>
}

