import { useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.ts'
import {
  ALL_SUBSTATS,
  ESTIMATED_CONFIDENCE,
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
  type SubstatMode,
} from '../model'

/** Condensed-resin domain claim size. */
const RESIN_PER_RUN = 40
/** Assumed daily resin spend on artifacts. */
const RESIN_PER_DAY = 200

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

function ArtifactPage() {
  const [slot, setSlot] = useLocalStorage<Slot>('gc:artifacts:slot', 'circlet')
  const availableMains = mainStatsForSlot(slot)
  const [mainStat, setMainStat] = useLocalStorage<Stat>(
    'gc:artifacts:mainStat',
    availableMains[0] ?? 'critRate',
  )
  const [requiredSubstats, setRequiredSubstats] = useLocalStorage<Stat[]>(
    'gc:artifacts:requiredSubstats',
    [],
  )
  const [substatMode, setSubstatMode] = useLocalStorage<SubstatMode>(
    'gc:artifacts:substatMode',
    'all',
  )
  const [unit, setUnit] = useLocalStorage<DisplayUnit>('gc:artifacts:unit', 'runs')
  const [onSetOnly, setOnSetOnly] = useLocalStorage('gc:artifacts:onSetOnly', true)

  const resolvedMain = availableMains.includes(mainStat)
    ? mainStat
    : (availableMains[0] ?? 'hp')

  const target = useMemo(
    () => ({
      setChance: onSetOnly ? 0.5 : 1,
      slot,
      mainStat: resolvedMain,
      requiredSubstats,
      substatMode,
    }),
    [onSetOnly, slot, resolvedMain, requiredSubstats, substatMode],
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

  const estimatedResin = estimate.resinForConfidence(ESTIMATED_CONFIDENCE)
  const likelyResin = estimate.resinForConfidence(LIKELY_CONFIDENCE)
  const guaranteedResin = estimate.resinForConfidence(GUARANTEED_CONFIDENCE)

  return (
    <>
      <header className="hero">
        <h1>Artifact resin odds</h1>
        <p className="lede">
          Pick a piece and main stat to see estimated, likely, and near-guaranteed farming cost.
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
            <span className="label" id="set-label">
              Set
            </span>
            <div className="chip-row" role="group" aria-labelledby="set-label">
              <button
                type="button"
                className={onSetOnly ? 'chip active' : 'chip'}
                aria-pressed={onSetOnly}
                onClick={() => setOnSetOnly(true)}
              >
                On-set only
              </button>
              <button
                type="button"
                className={!onSetOnly ? 'chip active' : 'chip'}
                aria-pressed={!onSetOnly}
                onClick={() => setOnSetOnly(false)}
              >
                Any set
              </button>
            </div>
            <p className="field-note">
              {onSetOnly
                ? 'Domain is 50/50 between two sets — only the target set counts.'
                : 'Off-pieces count too (feather/flower/goblet often farmed this way).'}
            </p>
          </div>

          <div className="field">
            <span className="label" id="substat-label">
              Required substats
              <span className="hint">optional · up to 4</span>
            </span>
            <div className="chip-row" role="group" aria-label="Substat match mode">
              <button
                type="button"
                className={substatMode === 'all' ? 'chip active' : 'chip'}
                aria-pressed={substatMode === 'all'}
                onClick={() => setSubstatMode('all')}
              >
                All (AND)
              </button>
              <button
                type="button"
                className={substatMode === 'any' ? 'chip active' : 'chip'}
                aria-pressed={substatMode === 'any'}
                onClick={() => setSubstatMode('any')}
              >
                Any (OR)
              </button>
            </div>
            <p className="field-note">
              {substatMode === 'all'
                ? 'Need every selected substat on the piece.'
                : 'Need at least one of the selected substats.'}{' '}
              Main stat <strong>{STAT_LABELS[resolvedMain]}</strong> cannot appear as a substat.
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
            <p className="stat-label">Estimated</p>
            <p className="stat-value">{formatCost(estimatedResin, unit)}</p>
            <p className="stat-note">50% chance of ≥1</p>
          </div>
          <div className="stat-block">
            <p className="stat-label">Likely</p>
            <p className="stat-value">{formatCost(likelyResin, unit)}</p>
            <p className="stat-note">75% chance of ≥1</p>
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
          long-run average {formatCost(estimate.expectedResin, unit)}
          {' · '}
          {onSetOnly ? 'on-set only' : 'any set'}
        </p>
      </main>
    </>
  )
}

export default ArtifactPage
