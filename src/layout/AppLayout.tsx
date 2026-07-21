import { NavLink, Outlet } from 'react-router-dom'
import { BannerPullingDayNotice } from '../components/BannerPullingDayNotice.tsx'
import { BrandMoonLogo, MoonIcon, SunIcon } from '../components/icons.tsx'
import { BannerRegionProvider } from '../hooks/useBannerRegion.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { THEME_LABEL } from '../theme'

const links = [
  { to: '/rotations', label: 'Rotations' },
  { to: '/builds', label: 'Builds' },
  { to: '/artifacts', label: 'Artifacts' },
  { to: '/characters', label: 'Characters' },
  { to: '/pulls', label: 'Pulls' },
]

const GITHUB_URL = 'https://github.com/jadilorenzo/genshin_calculator'

export function AppLayout() {
  const { toggleTheme, nextTheme } = useTheme()
  const ThemeIcon = nextTheme === 'light' ? SunIcon : MoonIcon

  return (
    <div className="app">
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
                <p className="brand-tagline">
                  Wish pity, artifact odds, build pacing, and rotation sketches — estimated
                  from community rate models.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${THEME_LABEL[nextTheme].toLowerCase()} mode`}
              title={`Switch to ${THEME_LABEL[nextTheme].toLowerCase()} mode`}
            >
              <ThemeIcon />
              <span>{THEME_LABEL[nextTheme]}</span>
            </button>
          </div>

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
        </div>
      </header>

      <div className="app-body">
        <BannerRegionProvider>
          <BannerPullingDayNotice />
          <Outlet />
        </BannerRegionProvider>
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
    </div>
  )
}
