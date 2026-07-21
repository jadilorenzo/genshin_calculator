import { NavLink, Outlet, useLocation } from 'react-router-dom'

export default function ArtifactsHubLayout() {
  const location = useLocation()
  const isSingle = location.pathname.includes('/single')

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Artifacts</h1>
        </div>
        <p className="lede">
          {isSingle
            ? 'Odds and resin cost for one selected piece.'
            : 'Plan a five-piece set. Parallel farming fills any empty slot, so the full lineup often finishes sooner than each piece alone.'}
        </p>
        <nav className="sub-tabs" aria-label="Artifact tools">
          <NavLink
            to="lineup"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Build lineup
          </NavLink>
          <NavLink
            to="single"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Single artifact
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </>
  )
}
