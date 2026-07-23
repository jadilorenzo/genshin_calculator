import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuthControls } from '../components/AuthControls.tsx'
import { BannerPullingDayNotice } from '../components/BannerPullingDayNotice.tsx'
import { BrandMoonLogo } from '../components/icons.tsx'
import { SiteSettingsMenu } from '../components/SiteSettingsMenu.tsx'
import { BannerRegionProvider } from '../hooks/useBannerRegion.tsx'

const links = [
  { to: '/rotations', label: 'Rotations' },
  { to: '/banners', label: 'Banners' },
  { to: '/artifacts', label: 'Artifacts' },
  { to: '/characters', label: 'Characters' },
]

const GITHUB_URL = 'https://github.com/jadilorenzo/genshin_calculator'

export function AppLayout() {
  const { pathname } = useLocation()
  const isRotationEditor = pathname.startsWith('/rotations/editor')

  return (
    <div className={isRotationEditor ? 'app app--rotation-editor' : 'app'}>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-masthead">
            <div className="brand-block">
              <div className="brand-mark" aria-hidden="true">
                <BrandMoonLogo />
              </div>
              <div className="brand-copy">
                <p className="brand-eyebrow">Genshin Impact tools</p>
                <h1 className="brand">False Moon's Reckoning</h1>
              </div>
            </div>
            <div className="site-masthead-actions">
              <AuthControls />
              <SiteSettingsMenu />
            </div>
          </div>

          {isRotationEditor ? null : (
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
          )}
        </div>
      </header>

      <div className="app-body">
        <BannerRegionProvider>
          <BannerPullingDayNotice />
          <Outlet />
        </BannerRegionProvider>
        {isRotationEditor ? null : (
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
        )}
      </div>
    </div>
  )
}
