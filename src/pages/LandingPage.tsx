import { Link } from 'react-router-dom'
import { PAGE_TITLES } from '../documentTitles'
import { prefetchDesk } from '../layout/routePrefetch'
import type { DeskId } from '../layout/siteNav'

const PATHS = [
  {
    to: '/rotations',
    desk: 'rotations' as const satisfies DeskId,
    label: 'Rotation Visualizer',
    detail:
      'Browse shared team timelines, or build one in the editor.',
  },
  {
    to: '/artifacts/lineup',
    desk: 'farm' as const satisfies DeskId,
    label: 'Artifact Expectations',
    detail:
      'Plan a five-piece artifact set, check resin for one piece, and compare drop odds.',
  },
  {
    to: '/farming',
    desk: 'goals' as const satisfies DeskId,
    label: 'Character Goals',
    detail:
      'Track levels, talents, and material farming for each character you’re building.',
  },
  {
    to: '/banners/countdown',
    desk: 'wish' as const satisfies DeskId,
    label: 'Wish Planning',
    detail:
      'Banner countdown, 5★ pity odds, daily pull pace, and a live pulling-day tracker.',
  },
  {
    to: '/testing',
    desk: 'testing' as const satisfies DeskId,
    label: 'DPS Test Dashboard',
    detail:
      'Upload combat-result screenshots, correct the OCR, and compare DPS across main DPS options.',
  },
  {
    to: '/characters',
    desk: 'data' as const satisfies DeskId,
    label: 'Data',
    detail:
      'Character kits with talents, passives, constellations, and animation timings.',
  },
] as const

export function LandingPage() {
  return (
    <div className="landing">
      <title>{PAGE_TITLES.home}</title>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-shell landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Genshin Impact tools</p>
            <h1 id="landing-title" className="landing-title">
              False Moon&apos;s Reckoning
            </h1>
            <p className="landing-lede">
              Rotation Visualizer · Artifact Expectations · Character Goals · Wish
              Planning · DPS Test Dashboard · Data
            </p>
            <div className="landing-cta">
              <Link
                to="/rotations"
                className="chip filled"
                onMouseEnter={() => prefetchDesk('rotations')}
                onFocus={() => prefetchDesk('rotations')}
              >
                Browse rotations
              </Link>
              <Link
                to="/rotations/editor"
                className="chip"
                onMouseEnter={() => import('./rotations/RotationsPage.tsx')}
                onFocus={() => import('./rotations/RotationsPage.tsx')}
              >
                Open editor
              </Link>
            </div>
          </div>
          <Link
            to="/rotations/editor"
            className="landing-hero-preview"
            aria-label="Open the rotation editor"
            onMouseEnter={() => import('./rotations/RotationsPage.tsx')}
            onFocus={() => import('./rotations/RotationsPage.tsx')}
          >
            <img
              src="/landing-editor.png"
              alt="Rotation editor timeline with buff bars and enemy aura markers for a sample team"
              width={1855}
              height={997}
              decoding="async"
            />
          </Link>
        </div>
      </section>

      <section className="landing-paths" aria-labelledby="landing-paths-title">
        <div className="landing-shell">
          <div className="landing-paths-head">
            <h2 id="landing-paths-title" className="landing-paths-title">
              Tools
            </h2>
          </div>
          <ul className="landing-path-list">
            {PATHS.map((path, index) => (
              <li key={path.to}>
                <Link
                  to={path.to}
                  className="landing-path"
                  onMouseEnter={() => prefetchDesk(path.desk)}
                  onFocus={() => prefetchDesk(path.desk)}
                >
                  <span className="landing-path-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="landing-path-body">
                    <span className="landing-path-label">{path.label}</span>
                    <span className="landing-path-detail">{path.detail}</span>
                  </span>
                  <span className="landing-path-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
