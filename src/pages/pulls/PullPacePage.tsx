import { useEffect, useMemo } from 'react'
import { useBannerSchedule } from '../../hooks/useBannerSchedule.ts'
import { useLocalStorage } from '../../hooks/useLocalStorage.ts'
import { useWishPlannerInputs } from '../../hooks/useWishPlannerInputs.ts'
import { ESTIMATED_CONFIDENCE, GUARANTEED_CONFIDENCE } from '../../model/labels.ts'
import {
  TYPICAL_BANNER_PHASE_DAYS,
  type BannerSchedule,
} from '../../model/bannerSchedule.ts'
import {
  PRIMOS_PER_DAILY,
  PULLS_FROM_DAILIES_PER_DAY,
  dailiesContribution,
  pullsPerDay,
  pullsToReachChance,
} from '../../model/wishes.ts'

type BannerHorizon = 'next' | 'afterNext'

function parseNonNegInt(raw: string, fallback = 0): number {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

function daysUntilDate(target: Date, from = new Date()): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)))
}

function liveDaysForHorizon(schedule: BannerSchedule, horizon: BannerHorizon): number {
  return Math.max(
    1,
    horizon === 'afterNext' ? schedule.daysUntilAfterNext : schedule.daysUntilNext,
  )
}

const FALLBACK_NEXT_BANNER_DATE = new Date(2026, 6, 21)
const FALLBACK_DAYS_UNTIL_BANNER = String(daysUntilDate(FALLBACK_NEXT_BANNER_DATE))
const FALLBACK_DAYS_UNTIL_AFTER_NEXT = String(
  daysUntilDate(FALLBACK_NEXT_BANNER_DATE) + TYPICAL_BANNER_PHASE_DAYS,
)

function formatBannerEnd(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PullPacePage() {
  const { clampedPity, totalPulls, guaranteed } = useWishPlannerInputs()
  const [bannerHorizon, setBannerHorizon] = useLocalStorage<BannerHorizon>(
    'gc:pulls:bannerHorizon',
    'next',
  )
  const [daysUntilBanner, setDaysUntilBanner] = useLocalStorage(
    'gc:pulls:daysUntilNextBanner',
    FALLBACK_DAYS_UNTIL_BANNER,
  )
  const [daysManual, setDaysManual] = useLocalStorage('gc:pulls:daysManual', false)
  const { schedule, status, error, refresh } = useBannerSchedule()

  useEffect(() => {
    if (daysManual || !schedule) return
    setDaysUntilBanner(String(liveDaysForHorizon(schedule, bannerHorizon)))
  }, [schedule, daysManual, bannerHorizon, setDaysUntilBanner])

  const applyHorizon = (horizon: BannerHorizon) => {
    setBannerHorizon(horizon)
    setDaysManual(false)
    if (schedule) {
      setDaysUntilBanner(String(liveDaysForHorizon(schedule, horizon)))
      return
    }
    setDaysUntilBanner(
      horizon === 'afterNext' ? FALLBACK_DAYS_UNTIL_AFTER_NEXT : FALLBACK_DAYS_UNTIL_BANNER,
    )
  }

  const safeDays = Math.max(1, parseNonNegInt(daysUntilBanner, 1))

  const likelyPlan = useMemo(
    () =>
      pullsToReachChance({
        currentPity: clampedPity,
        guaranteed,
        targetChance: ESTIMATED_CONFIDENCE,
        alreadyHave: totalPulls,
      }),
    [clampedPity, guaranteed, totalPulls],
  )

  const guaranteePlan = useMemo(
    () =>
      pullsToReachChance({
        currentPity: clampedPity,
        guaranteed,
        targetChance: GUARANTEED_CONFIDENCE,
        alreadyHave: totalPulls,
      }),
    [clampedPity, guaranteed, totalPulls],
  )

  const pacePlan = likelyPlan.alreadyMet ? guaranteePlan : likelyPlan
  const paceTarget = likelyPlan.alreadyMet ? GUARANTEED_CONFIDENCE : ESTIMATED_CONFIDENCE
  const paceTargetLabel = likelyPlan.alreadyMet ? 'guarantee' : 'likely'

  const dailyPulls = pullsPerDay(pacePlan.pullsShort, safeDays)
  const dailies = dailiesContribution(pacePlan.pullsShort, safeDays)
  const dailyLabel = !Number.isFinite(dailyPulls)
    ? '—'
    : dailyPulls === 0
      ? '0'
      : dailyPulls < 0.1
        ? dailyPulls.toFixed(2)
        : dailyPulls < 10
          ? dailyPulls.toFixed(1)
          : String(Math.ceil(dailyPulls))

  const dailiesPercentLabel = `${dailies.percentOfGoal >= 10 ? Math.round(dailies.percentOfGoal) : dailies.percentOfGoal.toFixed(1)}%`
  const pacePct = (paceTarget * 100).toFixed(0)

  return (
    <section className="pace-panel pace-panel-tab" aria-label="Daily pace to likely">
      <div className="field">
        <span className="label" id="horizon-label">
          Plan until
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="horizon-label">
          <button
            type="button"
            className={bannerHorizon === 'next' ? 'chip active' : 'chip'}
            aria-pressed={bannerHorizon === 'next'}
            onClick={() => applyHorizon('next')}
          >
            Next banner
          </button>
          <button
            type="button"
            className={bannerHorizon === 'afterNext' ? 'chip active' : 'chip'}
            aria-pressed={bannerHorizon === 'afterNext'}
            onClick={() => applyHorizon('afterNext')}
          >
            Banner after next
          </button>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="banner-days">
            {bannerHorizon === 'afterNext'
              ? 'Days until banner after next'
              : 'Days until next banner'}
          </label>
          <input
            id="banner-days"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={daysUntilBanner}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) {
                setDaysManual(true)
                setDaysUntilBanner(next)
              }
            }}
            onBlur={() => setDaysUntilBanner(String(safeDays))}
          />
          <p className="field-note">
            {status === 'loading' && 'Loading live banner schedule…'}
            {status === 'ready' && schedule && (
              <>
                Live: {schedule.featuredFiveStars.join(' / ') || 'character banners'} through{' '}
                {formatBannerEnd(schedule.nextChangeAt)}
                {bannerHorizon === 'afterNext' && (
                  <>
                    {' '}
                    · +{schedule.phaseLengthDays}d next phase → {schedule.daysUntilAfterNext}{' '}
                    days
                  </>
                )}{' '}
                · {schedule.source}
                {daysManual && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setDaysManual(false)
                        setDaysUntilBanner(String(liveDaysForHorizon(schedule, bannerHorizon)))
                      }}
                    >
                      Reset to live
                    </button>
                  </>
                )}
              </>
            )}
            {status === 'error' && (
              <>
                Live schedule unavailable{error ? ` (${error})` : ''}. Using fallback / manual
                value.{' '}
                <button type="button" className="text-button" onClick={refresh}>
                  Retry
                </button>
              </>
            )}
          </p>
        </div>
        <div className="field pace-result">
          <p className="label">Pulls / day for {paceTargetLabel}</p>
          <p className="stat-value pace-value">{dailyLabel}</p>
          <p className="field-note">
            {pacePlan.alreadyMet
              ? `Already at ${pacePct}%+ with what you have`
              : likelyPlan.alreadyMet
                ? `Past likely · ${pacePlan.pullsShort.toLocaleString()} more pulls to ${pacePct}% over ${safeDays} day${safeDays === 1 ? '' : 's'}`
                : `${pacePlan.pullsShort.toLocaleString()} more pulls to ${pacePct}% over ${safeDays} day${safeDays === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {!pacePlan.alreadyMet && (
        <div className="dailies-callout" aria-live="polite">
          <p className="stat-label">Dailies cover</p>
          <p className="stat-value pace-value">{dailiesPercentLabel}</p>
          <p className="field-note">
            {PRIMOS_PER_DAILY} primos/day ≈ {PULLS_FROM_DAILIES_PER_DAY} pulls/day ·{' '}
            {dailies.pullsFromDailies < 10
              ? dailies.pullsFromDailies.toFixed(1)
              : Math.round(dailies.pullsFromDailies).toLocaleString()}{' '}
            pulls over {safeDays} day{safeDays === 1 ? '' : 's'}
          </p>
        </div>
      )}

      <p className="odds">
        {likelyPlan.alreadyMet
          ? `You’re past likely (${(ESTIMATED_CONFIDENCE * 100).toFixed(0)}%), so this plans for guarantee — ${(GUARANTEED_CONFIDENCE * 100).toFixed(0)}% chance of the featured 5★.`
          : `Likely means ${(ESTIMATED_CONFIDENCE * 100).toFixed(0)}% chance of the featured 5★. Once you’re there, pace switches to guarantee (${(GUARANTEED_CONFIDENCE * 100).toFixed(0)}%).`}
      </p>
    </section>
  )
}
