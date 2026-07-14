import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  estimateLineupResin,
  type LineupSetMode,
  type Slot,
  type Stat,
  type SubstatMode,
} from '../model'

const RESIN_PER_DAY = 200
const RESIN_PER_RUN_CLAIM = 40

type DisplayUnit = 'days' | 'runs' | 'resin'

const UNIT_OPTIONS: { id: DisplayUnit; label: string }[] = [
  { id: 'days', label: 'Days' },
  { id: 'runs', label: 'Runs' },
  { id: 'resin', label: 'Resin' },
]

const SET_OPTIONS: { id: LineupSetMode; label: string; note: string }[] = [
  { id: 'onSet', label: 'On-set only', note: 'All five pieces must be the target set.' },
  {
    id: 'oneOff',
    label: '1 off-piece',
    note: 'Four on-set + one off-piece — which slot is off doesn’t matter.',
  },
  { id: 'anySet', label: 'Any set', note: 'Set bonus doesn’t matter for this lineup.' },
]

const DEFAULT_MAINS: Record<Slot, Stat> = {
  flower: 'hp',
  plume: 'atk',
  sands: 'atkPercent',
  goblet: 'anemoDamage',
  circlet: 'critRate',
}

const EMPTY_SUBS: Record<Slot, Stat[]> = {
  flower: [],
  plume: [],
  sands: [],
  goblet: [],
  circlet: [],
}

const DEFAULT_SUB_MODES: Record<Slot, SubstatMode> = {
  flower: 'all',
  plume: 'all',
  sands: 'all',
  goblet: 'all',
  circlet: 'all',
}

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
      const runs = Math.ceil(resin / RESIN_PER_RUN_CLAIM)
      return `${runs.toLocaleString()}×${RESIN_PER_RUN_CLAIM}`
    }
    case 'resin':
      return Math.ceil(resin).toLocaleString()
  }
}

function formatPercent(value: number): string {
  if (value >= 0.01) return `${(value * 100).toFixed(2)}%`
  if (value >= 0.0001) return `${(value * 100).toFixed(4)}%`
  return `${(value * 100).toExponential(2)}%`
}

function substatSummary(subs: Stat[], mode: SubstatMode): string {
  if (subs.length === 0) return 'Any'
  const join = mode === 'all' ? ' + ' : ' / '
  return subs.map((s) => STAT_LABELS[s]).join(join)
}

function OutsideCloseDetails({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const rootRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <details
      ref={rootRef}
      className="build-subs"
      open={open}
      onToggle={(e) => {
        setOpen((e.target as HTMLDetailsElement).open)
      }}
    >
      <summary className="build-subs-summary">{summary}</summary>
      <div className="build-subs-body">{children}</div>
    </details>
  )
}

export default function BuildsPage() {
  const [mains, setMains] = useLocalStorage<Record<Slot, Stat>>(
    'gc:builds:mains',
    DEFAULT_MAINS,
  )
  const [subs, setSubs] = useLocalStorage<Record<Slot, Stat[]>>('gc:builds:subs', EMPTY_SUBS)
  const [subModes, setSubModes] = useLocalStorage<Record<Slot, SubstatMode>>(
    'gc:builds:subModes',
    DEFAULT_SUB_MODES,
  )
  const [setMode, setSetMode] = useLocalStorage<LineupSetMode>('gc:builds:setMode', 'oneOff')
  const [unit, setUnit] = useLocalStorage<DisplayUnit>('gc:builds:unit', 'days')

  const pieces = useMemo(
    () =>
      SLOTS.map((slot) => {
        const options = mainStatsForSlot(slot)
        const mainStat = options.includes(mains[slot]) ? mains[slot] : options[0]
        const requiredSubstats = (subs[slot] ?? []).filter((s) => s !== mainStat)
        return {
          slot,
          mainStat,
          requiredSubstats,
          substatMode: subModes[slot] ?? 'all',
        }
      }),
    [mains, subs, subModes],
  )

  const estimate = useMemo(() => estimateLineupResin(pieces, setMode), [pieces, setMode])

  const estimated = estimate.resinForConfidence(ESTIMATED_CONFIDENCE)
  const likely = estimate.resinForConfidence(LIKELY_CONFIDENCE)
  const guaranteed = estimate.resinForConfidence(GUARANTEED_CONFIDENCE)

  const savings =
    Number.isFinite(estimate.naiveSumResin) &&
    Number.isFinite(estimate.expectedResin) &&
    estimate.naiveSumResin > 0
      ? 1 - estimate.expectedResin / estimate.naiveSumResin
      : 0

  const setNote = SET_OPTIONS.find((option) => option.id === setMode)?.note ?? ''

  function setMain(slot: Slot, mainStat: Stat) {
    setMains((prev) => ({ ...prev, [slot]: mainStat }))
    setSubs((prev) => ({
      ...prev,
      [slot]: (prev[slot] ?? []).filter((s) => s !== mainStat),
    }))
  }

  function toggleSubstat(slot: Slot, mainStat: Stat, stat: Stat) {
    setSubs((prev) => {
      const current = prev[slot] ?? []
      if (current.includes(stat)) {
        return { ...prev, [slot]: current.filter((s) => s !== stat) }
      }
      if (stat === mainStat || current.length >= 4) return prev
      return { ...prev, [slot]: [...current, stat] }
    })
  }

  return (
    <>
      <header className="hero">
        <h1>Build lineup</h1>
        <p className="lede">
          Set main stats for all five pieces. Projected time accounts for parallel
          progress — early drops can fill any empty slot, so the full set finishes sooner
          than farming each piece alone.
        </p>
      </header>

      <main className="panel">
        <section className="controls" aria-label="Build lineup">
          <div className="field">
            <span className="label" id="build-set-label">
              Set
            </span>
            <div className="chip-row wrap" role="group" aria-labelledby="build-set-label">
              {SET_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={setMode === option.id ? 'chip active' : 'chip'}
                  aria-pressed={setMode === option.id}
                  onClick={() => setSetMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="field-note">{setNote}</p>
          </div>

          <ul className="build-lineup">
            {pieces.map((piece, index) => {
              const options = mainStatsForSlot(piece.slot)
              const locked = options.length === 1
              const p = estimate.probabilities[index] ?? 0
              const pieceSubs = piece.requiredSubstats ?? []
              const mode = piece.substatMode ?? 'all'
              const availableSubs = ALL_SUBSTATS.filter((stat) => stat !== piece.mainStat)

              return (
                <li key={piece.slot} className="build-piece">
                  <div className="build-piece-head">
                    <span className="build-slot">{SLOT_LABELS[piece.slot]}</span>
                    <span className="build-piece-rate">{formatPercent(p)} / 5★</span>
                  </div>
                  {locked ? (
                    <p className="field-note">{STAT_LABELS[piece.mainStat]} (fixed)</p>
                  ) : (
                    <select
                      aria-label={`${SLOT_LABELS[piece.slot]} main stat`}
                      value={piece.mainStat}
                      onChange={(e) => setMain(piece.slot, e.target.value as Stat)}
                    >
                      {options.map((stat) => (
                        <option key={stat} value={stat}>
                          {STAT_LABELS[stat]}
                        </option>
                      ))}
                    </select>
                  )}

                  <OutsideCloseDetails
                    summary={
                      <>
                        Substats
                        <span className="hint">{substatSummary(pieceSubs, mode)}</span>
                      </>
                    }
                  >
                    <div className="chip-row wrap" role="group" aria-label="Substat match mode">
                      <button
                        type="button"
                        className={mode === 'all' ? 'chip compact active' : 'chip compact'}
                        aria-pressed={mode === 'all'}
                        onClick={() =>
                          setSubModes((prev) => ({ ...prev, [piece.slot]: 'all' }))
                        }
                      >
                        All (AND)
                      </button>
                      <button
                        type="button"
                        className={mode === 'any' ? 'chip compact active' : 'chip compact'}
                        aria-pressed={mode === 'any'}
                        onClick={() =>
                          setSubModes((prev) => ({ ...prev, [piece.slot]: 'any' }))
                        }
                      >
                        Any (OR)
                      </button>
                    </div>
                    <div
                      className="chip-row wrap"
                      role="group"
                      aria-label={`${SLOT_LABELS[piece.slot]} required substats`}
                    >
                      {availableSubs.map((stat) => {
                        const selected = pieceSubs.includes(stat)
                        const disabled = !selected && pieceSubs.length >= 4
                        return (
                          <button
                            key={stat}
                            type="button"
                            className={selected ? 'chip compact active' : 'chip compact'}
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() => toggleSubstat(piece.slot, piece.mainStat, stat)}
                          >
                            {STAT_LABELS[stat]}
                          </button>
                        )
                      })}
                    </div>
                  </OutsideCloseDetails>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="unit-bar">
          <span className="label" id="build-unit-label">
            Show as
          </span>
          <div className="chip-row" role="group" aria-labelledby="build-unit-label">
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
        </div>

        <section className="results" aria-live="polite">
          <div className="stat-block accent">
            <p className="stat-label">Estimated</p>
            <p className="stat-value">{formatCost(estimated, unit)}</p>
            <p className="stat-note">50% to fill all 5</p>
          </div>
          <div className="stat-block">
            <p className="stat-label">Likely</p>
            <p className="stat-value">{formatCost(likely, unit)}</p>
            <p className="stat-note">75% to fill all 5</p>
          </div>
          <div className="stat-block">
            <p className="stat-label">Guaranteed</p>
            <p className="stat-value">{formatCost(guaranteed, unit)}</p>
            <p className="stat-note">95% to fill all 5</p>
          </div>
        </section>

        <p className="odds">
          Average {formatCost(estimate.expectedResin, unit)} farming in parallel
          {Number.isFinite(estimate.naiveSumResin) && (
            <>
              {' · '}
              {formatCost(estimate.naiveSumResin, unit)} if you farmed each solo
              {savings > 0.01 && <> (~{Math.round(savings * 100)}% less)</>}
            </>
          )}
        </p>
      </main>
    </>
  )
}
