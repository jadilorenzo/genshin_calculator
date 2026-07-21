import { useMemo } from 'react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { useLocalStorage } from '../../hooks/useLocalStorage.ts'
import { useArtifactTarget } from '../../hooks/useArtifactTarget.tsx'
import {
  ESTIMATED_CONFIDENCE,
  GUARANTEED_CONFIDENCE,
  LIKELY_CONFIDENCE,
  artifactProbability,
  estimateResin,
} from '../../model'

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

export default function ArtifactChancesPage() {
  useDocumentTitle(PAGE_TITLES.artifactExpectations)
  const { target, onSetOnly } = useArtifactTarget()
  const [unit, setUnit] = useLocalStorage<DisplayUnit>('gc:artifacts:unit', 'runs')

  const probability = useMemo(() => artifactProbability(target), [target])
  const estimate = useMemo(() => estimateResin(target), [target])

  const estimatedResin = estimate.resinForConfidence(ESTIMATED_CONFIDENCE)
  const likelyResin = estimate.resinForConfidence(LIKELY_CONFIDENCE)
  const guaranteedResin = estimate.resinForConfidence(GUARANTEED_CONFIDENCE)

  return (
    <>
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
        Match chance per 5★ drop: <strong>{formatPercent(probability.total)}</strong>
        {' · '}
        long-run average {formatCost(estimate.expectedResin, unit)}
        {' · '}
        {onSetOnly ? 'on-set only' : 'any set'}
      </p>
    </>
  )
}
