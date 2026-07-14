import { useMemo } from 'react'
import { useWishPlannerInputs } from '../../hooks/useWishPlannerInputs.ts'
import { HARD_PITY, SOFT_PITY_START, featuredSuccessChance } from '../../model/wishes.ts'
import { PityChart } from './PityChart.tsx'

function formatChance(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  if (value >= 0.9995) return '99.9%+'
  if (value >= 0.1) return `${(value * 100).toFixed(1)}%`
  return `${(value * 100).toFixed(2)}%`
}

export default function PullOddsPage() {
  const {
    clampedPity,
    totalPulls,
    guaranteed,
    safeSaved,
    pullsFromSavedPrimos,
  } = useWishPlannerInputs()

  const successChance = useMemo(
    () =>
      featuredSuccessChance({
        currentPity: clampedPity,
        pullsAvailable: totalPulls,
        guaranteed,
      }),
    [clampedPity, totalPulls, guaranteed],
  )

  const pullsBreakdown =
    pullsFromSavedPrimos > 0
      ? `${safeSaved.toLocaleString()} fates + ${pullsFromSavedPrimos.toLocaleString()} from primos`
      : 'Saved Intertwined Fates'

  return (
    <>
      <section className="results results-pull" aria-live="polite">
        <div className="stat-block">
          <p className="stat-label">Pulls available</p>
          <p className="stat-value">{totalPulls.toLocaleString()}</p>
          <p className="stat-note">{pullsBreakdown}</p>
        </div>
        <div className="stat-block accent">
          <p className="stat-label">Success chance</p>
          <p className="stat-value">{formatChance(successChance)}</p>
          <p className="stat-note">Featured 5★ at least once</p>
        </div>
      </section>

      <p className="odds">
        Soft pity from {SOFT_PITY_START}, hard pity at {HARD_PITY}. Capturing Radiance not included.
      </p>

      <PityChart currentPity={clampedPity} pullsAvailable={totalPulls} />
    </>
  )
}
