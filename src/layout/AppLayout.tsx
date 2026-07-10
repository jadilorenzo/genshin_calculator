import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/artifacts', label: 'Artifacts' },
  { to: '/pulls', label: 'Pulls' },
]

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
    </div>
  )
}
