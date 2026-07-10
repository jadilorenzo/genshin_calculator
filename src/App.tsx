import { useMemo, useState } from 'react'
import {
  ALL_SUBSTATS,
  GUARANTEED_CONFIDENCE,
  LIKELY_CONFIDENCE,
  MAIN_STAT_RATES,
  SLOTS,
  SLOT_LABELS,
  STAT_LABELS,
  artifactProbability,
  estimateResin,
  type Slot,
  type Stat,
} from './model'
import './App.css'

/** Condensed-resin domain claim size. */
const RESIN_PER_RUN = 40
/** Assumed daily resin spend on artifacts. */
const RESIN_PER_DAY = 120

type DisplayUnit = 'days' | 'runs' | 'resin'

const UNIT_OPTIONS: { id: DisplayUnit; label: string }[] = [
  { id: 'days', label: 'Days' },
  { id: 'runs', label: 'Runs' },
  { id: 'resin', label: 'Resin' },
]

function mainStatsForSlot(slot: Slot): Stat[] {
  return Object.keys(MAIN_STAT_RATES[slot]) as Stat[]
}

function formatCost(resin: number, unit: DisplayUnit): string {
  if (!Number.isFinite(resin)) return '—'
  switch (unit) {
    case 'days': {
      const days = resin / RESIN_PER_DAY
      const rounded = days >= 10 ? Math.ceil(days) : Math.ceil(days * 10) / 10
      return `${rounded.toLocaleString()}${rounded === 1 ? ' day' : ' days'}`
    }
    case 'runs': {
      const runs = Math.ceil(resin / RESIN_PER_RUN)
      return `${runs.toLocaleString()}×${RESIN_PER_RUN}`
    }
    case 'resin':
      return Math.ceil(resin).toLocaleString()
  }
}

function unitNote(unit: DisplayUnit): string {
  switch (unit) {
    case 'days':
      return `${RESIN_PER_DAY} resin / day`
    case 'runs':
      return `${RESIN_PER_RUN} resin / run`
    case 'resin':
      return 'total Original Resin'
  }
}

function formatPercent(value: number): string {
  if (value >= 0.01) return `${(value * 100).toFixed(2)}%`
  if (value >= 0.0001) return `${(value * 100).toFixed(4)}%`
  return `${(value * 100).toExponential(2)}%`
}

function App() {
  const [slot, setSlot] = useState<Slot>('circlet')
  const availableMains = mainStatsForSlot(slot)
  const [mainStat, setMainStat] = useState<Stat>(availableMains[0] ?? 'critRate')
  const [requiredSubstats, setRequiredSubstats] = useState<Stat[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('runs')

  const resolvedMain = availableMains.includes(mainStat)
    ? mainStat
    : (availableMains[0] ?? 'hp')

  const target = useMemo(
    () => ({
      slot,
      mainStat: resolvedMain,
      requiredSubstats,
    }),
    [slot, resolvedMain, requiredSubstats],
  )

  const probability = useMemo(() => artifactProbability(target), [target])
  const estimate = useMemo(() => estimateResin(target), [target])

  const availableSubstats = ALL_SUBSTATS.filter((stat) => stat !== resolvedMain)

  function handleSlotChange(next: Slot) {
    setSlot(next)
    const mains = mainStatsForSlot(next)
    const nextMain = mains.includes(mainStat) ? mainStat : mains[0]
    setMainStat(nextMain)
    setRequiredSubstats((prev) => prev.filter((s) => s !== nextMain))
  }

  function handleMainChange(next: Stat) {
    setMainStat(next)
    setRequiredSubstats((prev) => prev.filter((s) => s !== next))
  }

  function toggleSubstat(stat: Stat) {
    setRequiredSubstats((prev) => {
      if (prev.includes(stat)) return prev.filter((s) => s !== stat)
      if (prev.length >= 4) return prev
      return [...prev, stat]
    })
  }

  const likelyResin = estimate.resinForConfidence(LIKELY_CONFIDENCE)
  const guaranteedResin = estimate.resinForConfidence(GUARANTEED_CONFIDENCE)

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">Genshin Calculator</p>
        <h1>Artifact resin odds</h1>
        <p className="lede">
          Pick a piece and main stat to see likely, estimated, and near-guaranteed farming cost.
        </p>
      </header>

      <main className="panel">
        <section className="controls" aria-label="Artifact target">
          <div className="field">
            <span className="label" id="slot-label">
              Slot
            </span>
            <div className="chip-row" role="group" aria-labelledby="slot-label">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={slot === s ? 'chip active' : 'chip'}
                  onClick={() => handleSlotChange(s)}
                >
                  {SLOT_LABELS[s]}
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
              value={resolvedMain}
              onChange={(e) => handleMainChange(e.target.value as Stat)}
            >
              {availableMains.map((stat) => (
                <option key={stat} value={stat}>
                  {STAT_LABELS[stat]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label" id="substat-label">
              Required substats
              <span className="hint">optional · up to 4</span>
            </span>
            <p className="field-note">
              An artifact cannot roll its main stat as a substat —{' '}
              <strong>{STAT_LABELS[resolvedMain]}</strong> is excluded from this list and from the
              odds.
            </p>
            <div className="chip-row wrap" role="group" aria-labelledby="substat-label">
              {availableSubstats.map((stat) => {
                const selected = requiredSubstats.includes(stat)
                const disabled = !selected && requiredSubstats.length >= 4
                return (
                  <button
                    key={stat}
                    type="button"
                    className={selected ? 'chip active' : 'chip'}
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

        <div className="unit-bar">
          <span className="label" id="unit-label">
            Show as
          </span>
          <div className="chip-row" role="group" aria-labelledby="unit-label">
            {UNIT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={unit === option.id ? 'chip active' : 'chip'}
                aria-pressed={unit === option.id}
                onClick={() => setUnit(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="unit-note">{unitNote(unit)}</p>
        </div>

        <section className="results" aria-live="polite">
          <div className="stat-block accent">
            <p className="stat-label">Likely</p>
            <p className="stat-value">{formatCost(likelyResin, unit)}</p>
            <p className="stat-note">50% chance of ≥1</p>
          </div>
          <div className="stat-block">
            <p className="stat-label">Estimated</p>
            <p className="stat-value">{formatCost(estimate.expectedResin, unit)}</p>
            <p className="stat-note">Average to one match</p>
          </div>
          <div className="stat-block">
            <p className="stat-label">Guaranteed</p>
            <p className="stat-value">{formatCost(guaranteedResin, unit)}</p>
            <p className="stat-note">95% chance of ≥1</p>
          </div>
        </section>

        <p className="odds">
          Match chance per 5★ drop:{' '}
          <strong>{formatPercent(probability.total)}</strong>
          {' · '}
          on-set domain assumed (50/50)
        </p>
      </main>
    </div>
  )
}

export default App
