import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ClearPageButton } from '../../components/ClearPageButton.tsx'
import { SlotIcon } from '../../components/icons.tsx'
import {
  ArtifactTargetProvider,
  useArtifactTarget,
} from '../../hooks/useArtifactTarget.tsx'
import {
  ALL_SUBSTATS,
  SLOTS,
  SLOT_LABELS,
  STAT_LABELS,
} from '../../model'

function ArtifactSummary() {
  const { slot, mainStat, requiredSubstats, substatMode, onSetOnly } = useArtifactTarget()
  const join = substatMode === 'all' ? ' + ' : ' / '
  const subs =
    requiredSubstats.length === 0
      ? 'Any substats'
      : requiredSubstats.map((s) => STAT_LABELS[s]).join(join)

  return (
    <aside className="artifact-summary" aria-label="Selected piece">
      <p className="stat-label">Your piece</p>
      <dl className="artifact-summary-list">
        <div>
          <dt>Slot</dt>
          <dd className="slot-label-with-icon">
            <SlotIcon slot={slot} />
            <span>{SLOT_LABELS[slot]}</span>
          </dd>
        </div>
        <div>
          <dt>Main</dt>
          <dd>{STAT_LABELS[mainStat]}</dd>
        </div>
        <div>
          <dt>Subs</dt>
          <dd>{subs}</dd>
        </div>
        <div>
          <dt>Set</dt>
          <dd>{onSetOnly ? 'On-set' : 'Any set'}</dd>
        </div>
      </dl>
    </aside>
  )
}

function ArtifactControls() {
  const {
    slot,
    mainStat,
    availableMains,
    requiredSubstats,
    substatMode,
    setSubstatMode,
    onSetOnly,
    setOnSetOnly,
    handleSlotChange,
    handleMainChange,
    toggleSubstat,
  } = useArtifactTarget()

  const availableSubstats = ALL_SUBSTATS.filter((stat) => stat !== mainStat)

  return (
    <section className="artifact-workspace" aria-label="Artifact target">
      <ArtifactSummary />

      <div className="field">
        <span className="label" id="slot-label">
          Slot
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="slot-label">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              className={slot === s ? 'chip compact active chip-with-icon' : 'chip compact chip-with-icon'}
              onClick={() => handleSlotChange(s)}
            >
              <SlotIcon slot={s} />
              <span>{SLOT_LABELS[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="main-stat">
          Main stat
        </label>
        <select
          id="main-stat"
          value={mainStat}
          onChange={(e) => handleMainChange(e.target.value as typeof mainStat)}
        >
          {availableMains.map((stat) => (
            <option key={stat} value={stat}>
              {STAT_LABELS[stat]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="label" id="set-label">
          Set
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="set-label">
          <button
            type="button"
            className={onSetOnly ? 'chip compact active' : 'chip compact'}
            aria-pressed={onSetOnly}
            onClick={() => setOnSetOnly(true)}
          >
            On-set
          </button>
          <button
            type="button"
            className={!onSetOnly ? 'chip compact active' : 'chip compact'}
            aria-pressed={!onSetOnly}
            onClick={() => setOnSetOnly(false)}
          >
            Any set
          </button>
        </div>
      </div>

      <div className="field field-wide">
        <span className="label" id="substat-label">
          Required substats
          <span className="hint">optional · up to 4</span>
        </span>
        <div className="chip-row wrap" role="group" aria-label="Substat match mode">
          <button
            type="button"
            className={substatMode === 'all' ? 'chip compact active' : 'chip compact'}
            aria-pressed={substatMode === 'all'}
            onClick={() => setSubstatMode('all')}
          >
            All (AND)
          </button>
          <button
            type="button"
            className={substatMode === 'any' ? 'chip compact active' : 'chip compact'}
            aria-pressed={substatMode === 'any'}
            onClick={() => setSubstatMode('any')}
          >
            Any (OR)
          </button>
        </div>
        <div className="chip-row wrap" role="group" aria-labelledby="substat-label">
          {availableSubstats.map((stat) => {
            const selected = requiredSubstats.includes(stat)
            const disabled = !selected && requiredSubstats.length >= 4
            return (
              <button
                key={stat}
                type="button"
                className={selected ? 'chip compact active' : 'chip compact'}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleSubstat(stat)}
              >
                {STAT_LABELS[stat]}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default function ArtifactLayout() {
  const location = useLocation()
  const isCompare = location.pathname.includes('/compare')

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Artifact resin odds</h1>
          <ClearPageButton prefix="gc:artifacts:" />
        </div>
        <p className="lede">
          {isCompare
            ? 'See how common your piece is per 5★ drop next to everyday farm targets — easiest fills 80%.'
            : 'Estimated, likely, and near-guaranteed farming cost for your selected piece.'}
        </p>
        <nav className="sub-tabs" aria-label="Artifact tools">
          <NavLink
            to="compare"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Compare
          </NavLink>
          <NavLink
            to="expectations"
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            Farming expectations
          </NavLink>
        </nav>
      </header>

      <main className="panel">
        <ArtifactTargetProvider>
          <ArtifactControls />
          <Outlet />
        </ArtifactTargetProvider>
      </main>
    </>
  )
}
