import { Link } from 'react-router-dom'
import { PAGE_TITLES } from '../documentTitles'

const PATHS = [
  {
    to: '/rotations',
    label: 'Rotations',
    detail:
      'Aura and buff timelines, community shares, and an editor for sequencing skills, swaps, and off-field apps.',
  },
  {
    to: '/banners/countdown',
    label: 'Banners',
    detail:
      'Live banner countdowns, 5★ pity odds, daily pull pace, and a pulling-day tracker for your region.',
  },
  {
    to: '/artifacts/expectations',
    label: 'Artifacts',
    detail:
      'Expected resin to land a target piece, single-artifact compare, and lineup planning for your builds.',
  },
  {
    to: '/characters',
    label: 'Characters',
    detail:
      'Kit reference with talents, passives, and constellation notes so you can check numbers while you theorycraft.',
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
              Buff Visualizations · Artifact Farming Expectations · Banner Countdowns
            </p>
            <div className="landing-cta">
              <Link to="/rotations" className="chip filled">
                Browse rotations
              </Link>
              <Link to="/rotations/editor" className="chip">
                Open editor
              </Link>
            </div>
          </div>
          <Link
            to="/rotations/editor"
            className="landing-hero-preview"
            aria-label="Open the rotation editor"
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
              Choose a tool
            </h2>
            <p className="landing-paths-lede">
              Four desks for theorycraft — pick a lane and start from there.
            </p>
          </div>
          <ul className="landing-path-list">
            {PATHS.map((path, index) => (
              <li key={path.to}>
                <Link to={path.to} className="landing-path">
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
