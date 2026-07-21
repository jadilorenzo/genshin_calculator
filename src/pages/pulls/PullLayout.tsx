import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ClearPageButton } from '../../components/ClearPageButton.tsx'
import {
  WishPlannerInputsProvider,
  useWishPlannerInputs,
} from '../../hooks/useWishPlannerInputs.tsx'

function PullControls() {
  const {
    pity,
    setPity,
    savedPulls,
    setSavedPulls,
    primos,
    setPrimos,
    guaranteed,
    setGuaranteed,
    clampedPity,
    safeSaved,
    safePrimos,
    pullsFromSavedPrimos,
    remainingToHard,
    progress,
    primosPerPull,
  } = useWishPlannerInputs()

  return (
    <section className="controls" aria-label="Wish state">
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="pity">
            Current pity
          </label>
          <input
            id="pity"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pity}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) setPity(next)
            }}
            onBlur={() => setPity(String(clampedPity))}
          />
          <p className="field-note">
            {remainingToHard} to hard · {Math.round(progress * 100)}%
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="saved-pulls">
            Saved pulls
          </label>
          <input
            id="saved-pulls"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={savedPulls}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) setSavedPulls(next)
            }}
            onBlur={() => setSavedPulls(String(safeSaved))}
          />
          <p className="field-note">Intertwined Fates</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="primos">
            Primogems
          </label>
          <input
            id="primos"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={primos}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) setPrimos(next)
            }}
            onBlur={() => setPrimos(String(safePrimos))}
          />
          <p className="field-note">
            {pullsFromSavedPrimos > 0
              ? `= ${pullsFromSavedPrimos.toLocaleString()} pull${pullsFromSavedPrimos === 1 ? '' : 's'} (${primosPerPull}/pull)`
              : `${primosPerPull} per pull`}
          </p>
        </div>
      </div>

      <div className="field">
        <span className="label" id="guarantee-label">
          Featured guarantee
        </span>
        <div className="chip-row" role="group" aria-labelledby="guarantee-label">
          <button
            type="button"
            className={!guaranteed ? 'chip active' : 'chip'}
            aria-pressed={!guaranteed}
            onClick={() => setGuaranteed(false)}
          >
            50/50
          </button>
          <button
            type="button"
            className={guaranteed ? 'chip active' : 'chip'}
            aria-pressed={guaranteed}
            onClick={() => setGuaranteed(true)}
          >
            Guaranteed
          </button>
        </div>
        <p className="field-note">
          {guaranteed
            ? 'Next 5★ is the featured character.'
            : 'Next 5★ is 50/50 featured vs standard.'}
        </p>
      </div>
    </section>
  )
}

export default function PullLayout() {
  const location = useLocation()
  const isCountdown = location.pathname.includes('/countdown')
  const isPace = location.pathname.includes('/pace')
  const isPullingDay = location.pathname.includes('/day')

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Banners</h1>
          <ClearPageButton prefix="gc:pulls:" />
        </div>
        <p className="lede">
          {isCountdown
            ? 'Banner phase countdown by server region.'
            : isPace
              ? 'See how many pulls per day you need before the banner to reach likely — or guarantee if you’re already past likely.'
              : isPullingDay
                ? 'Pulling right now? Log each wish here to watch your pity move on the curve and see featured odds update live — without touching the saved numbers above.'
                : 'Check your featured 5★ odds from pity and saved fates.'}
        </p>
        <nav className="sub-tabs" aria-label="Banner tools">
          <NavLink
            to="odds"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            5★ Odds
          </NavLink>
          <NavLink
            to="day"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Pulling day
          </NavLink>
          <NavLink
            to="pace"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Daily pace
          </NavLink>
          <NavLink
            to="countdown"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Banner countdown
          </NavLink>
        </nav>
      </header>

      <main className="panel">
        <WishPlannerInputsProvider>
          {!isCountdown ? <PullControls /> : null}
          <Outlet />
        </WishPlannerInputsProvider>
      </main>
    </>
  )
}
