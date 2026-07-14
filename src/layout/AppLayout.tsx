import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/artifacts', label: 'Artifacts' },
  { to: '/pulls', label: 'Pulls' },
  { to: '/builds', label: 'Builds' },
]

const GITHUB_URL = 'https://github.com/jadilorenzo/genshin_calculator'

export function AppLayout() {
  return (
    <div className="app">
      <header className="site-header">
        <p className="brand">Genshin Calculator</p>
        <nav className="tabs" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
      <footer className="site-footnote">
        <p>
          Built by Jacob Di Lorenzo ·{' '}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
        <p>
          Estimates use community rate models and may not match live in-game odds or drop
          tables. Not affiliated with HoYoverse.
        </p>
      </footer>
    </div>
  )
}
