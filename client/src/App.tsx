import { useState } from 'react'
import FilmNotebook from './pages/FilmNotebook'
import RecoveryTracker from './pages/RecoveryTracker'
import './App.css'

type ActivePage = 'recovery' | 'film'

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('recovery')

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            setActivePage('recovery')
          }}
          aria-label="GridironPulse home"
        >
          <span className="brand-mark" aria-hidden="true">G</span>
          <span className="brand-copy">
            <strong>GRIDIRONPULSE</strong>
            <span>ATHLETE TRACKER</span>
          </span>
        </a>
        <nav className="primary-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={activePage === 'recovery' ? 'nav-tab is-active' : 'nav-tab'}
            aria-current={activePage === 'recovery' ? 'page' : undefined}
            onClick={() => setActivePage('recovery')}
          >
            Recovery &amp; Workouts
          </button>
          <button
            type="button"
            className={activePage === 'film' ? 'nav-tab is-active' : 'nav-tab'}
            aria-current={activePage === 'film' ? 'page' : undefined}
            onClick={() => setActivePage('film')}
          >
            Film Notebook
          </button>
        </nav>
      </header>
      <main className="main-content" key={activePage}>
        {activePage === 'recovery' ? <RecoveryTracker /> : <FilmNotebook />}
      </main>
      <footer className="site-footer">
        <span>GRIDIRONPULSE / STUDY THE DETAILS</span>
        <span>Train well. Play ready.</span>
      </footer>
    </div>
  )
}

export default App
