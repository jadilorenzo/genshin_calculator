import { useEffect, useMemo } from 'react'
import { useBannerSchedule } from '../hooks/useBannerSchedule.ts'
import { useLocalStorage } from '../hooks/useLocalStorage.ts'
import { ESTIMATED_CONFIDENCE, GUARANTEED_CONFIDENCE } from '../model/labels.ts'
import {
  TYPICAL_BANNER_PHASE_DAYS,
  type BannerSchedule,
} from '../model/bannerSchedule.ts'
import {
  HARD_PITY,
  PRIMOS_PER_DAILY,
  PRIMOS_PER_PULL,
  PULLS_FROM_DAILIES_PER_DAY,
  SOFT_PITY_START,
  dailiesContribution,
  featuredSuccessChance,
  nextFiveStarDistribution,
  pullsFromPrimos,
  pullsPerDay,
  pullsToReachChance,
  totalPullsAvailable,
} from '../model/wishes.ts'

type PullSubTab = 'odds' | 'pace'
type BannerHorizon = 'next' | 'afterNext'

function liveDaysForHorizon(schedule: BannerSchedule, horizon: BannerHorizon): number {
  return Math.max(
    1,
    horizon === 'afterNext' ? schedule.daysUntilAfterNext : schedule.daysUntilNext,
  )
}

function formatChance(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  if (value >= 0.9995) return '99.9%+'
  if (value >= 0.1) return `${(value * 100).toFixed(1)}%`
  return `${(value * 100).toFixed(2)}%`
}

interface PitySegment {
  start: number
  end: number
}

/** Worst-case path along the pity axis: always ride to hard pity, then loop. */
function budgetSegments(startPity: number, pulls: number): PitySegment[] {
  if (pulls <= 0) return []
  const segments: PitySegment[] = []
  let pity = startPity
  let left = pulls
  let guard = 0

  while (left > 0 && guard < 8) {
    const room = HARD_PITY - pity
    const take = Math.min(left, room)
    segments.push({ start: pity, end: pity + take })
    left -= take
    pity = 0
    guard += 1
  }

  return segments
}

function budgetEndPity(startPity: number, pulls: number): number {
  if (pulls <= 0) return startPity
  let pity = startPity
  let left = pulls
  let guard = 0

  while (left > 0 && guard < 8) {
    const room = HARD_PITY - pity
    if (left < room) return pity + left
    left -= room
    pity = 0
    guard += 1
    if (left === 0) return 0
  }

  return pity
}

function PityChart({
  currentPity,
  pullsAvailable,
}: {
  currentPity: number
  pullsAvailable: number
}) {
  const baseline = useMemo(() => nextFiveStarDistribution(0), [])
  const maxProb = Math.max(...baseline.map((p) => p.probability), 1e-9)
  const segments = useMemo(
    () => budgetSegments(currentPity, pullsAvailable),
    [currentPity, pullsAvailable],
  )
  const endPity = useMemo(
    () => budgetEndPity(currentPity, pullsAvailable),
    [currentPity, pullsAvailable],
  )
  const loopsPastFirst = segments.length > 1

  const width = 640
  const height = 220
  const pad = { top: 20, right: 12, bottom: 28, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const x = (pity: number) => pad.left + (pity / HARD_PITY) * innerW
  const y = (prob: number) => pad.top + innerH - (prob / maxProb) * innerH

  const areaPath = baseline
    .map((point, index) => {
      const cmd = index === 0 ? 'M' : 'L'
      return `${cmd}${x(point.pity).toFixed(2)} ${y(point.probability).toFixed(2)}`
    })
    .join(' ')
  const firstPity = baseline[0]?.pity ?? 1
  const areaClosed = `${areaPath} L${x(HARD_PITY).toFixed(2)} ${y(0).toFixed(2)} L${x(firstPity).toFixed(2)} ${y(0).toFixed(2)} Z`

  const youX = x(currentPity)
  const endX = x(endPity)
  const peak = baseline.reduce((best, p) => (p.probability > best.probability ? p : best))

  return (
    <figure className="pity-chart">
      <figcaption className="label">Pity distribution</figcaption>
      <svg
        className="pity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Five-star pity distribution. You are at pity ${currentPity}. Peak around pity ${peak.pity}.`}
      >
        <defs>
          <linearGradient id="pity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(226, 197, 122, 0.45)" />
            <stop offset="100%" stopColor="rgba(226, 197, 122, 0.04)" />
          </linearGradient>
        </defs>

        <rect
          x={x(SOFT_PITY_START)}
          y={pad.top}
          width={x(HARD_PITY) - x(SOFT_PITY_START)}
          height={innerH}
          fill="rgba(168, 196, 188, 0.08)"
        />

        {segments.map((segment, index) => {
          const left = x(segment.start)
          const right = x(segment.end)
          if (right <= left) return null
          return (
            <rect
              key={`${segment.start}-${segment.end}-${index}`}
              x={left}
              y={pad.top}
              width={right - left}
              height={innerH}
              fill={index === 0 ? 'rgba(226, 197, 122, 0.14)' : 'rgba(226, 197, 122, 0.22)'}
            />
          )
        })}

        <path d={areaClosed} fill="url(#pity-fill)" />
        <path
          d={areaPath}
          fill="none"
          stroke="var(--gold-bright)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <line
          x1={youX}
          x2={youX}
          y1={pad.top}
          y2={pad.top + innerH}
          stroke="var(--mist)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <circle cx={youX} cy={y(0)} r="4" fill="var(--mist)" />
        <text x={youX} y={pad.top + 11} textAnchor="middle" className="chart-marker-label">
          You · {currentPity}
        </text>

        {pullsAvailable > 0 && endPity !== currentPity && (
          <>
            <line
              x1={endX}
              x2={endX}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--gold-bright)"
              strokeWidth="2"
            />
            <circle cx={endX} cy={y(0)} r="4" fill="var(--gold-bright)" />
            <text
              x={endX}
              y={pad.top + (Math.abs(endX - youX) < 48 ? 24 : 11)}
              textAnchor="middle"
              className="chart-marker-label chart-marker-end"
            >
              {loopsPastFirst ? `Loop · ${endPity}` : `End · ${endPity}`}
            </text>
          </>
        )}

        <text x={x(0)} y={height - 8} className="chart-axis">
          0
        </text>
        <text x={x(SOFT_PITY_START)} y={height - 8} textAnchor="middle" className="chart-axis">
          Soft {SOFT_PITY_START}
        </text>
        <text x={x(HARD_PITY)} y={height - 8} textAnchor="end" className="chart-axis">
          {HARD_PITY}
        </text>
      </svg>
      <p className="field-note">
        {loopsPastFirst
          ? 'Saved pulls reach past hard pity, so the gold band loops into the next pity cycle.'
          : 'Gold band = saved pulls from your current pity toward hard pity.'}
      </p>
    </figure>
  )
}

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

/** Offline fallback if the live calendar cannot be reached. */
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

function PullPage() {
  const [subTab, setSubTab] = useLocalStorage<PullSubTab>('gc:pulls:subTab', 'odds')
  const [pity, setPity] = useLocalStorage('gc:pulls:pity', '0')
  const [savedPulls, setSavedPulls] = useLocalStorage('gc:pulls:savedPulls', '0')
  const [primos, setPrimos] = useLocalStorage('gc:pulls:primos', '0')
  const [bannerHorizon, setBannerHorizon] = useLocalStorage<BannerHorizon>(
    'gc:pulls:bannerHorizon',
    'next',
  )
  const [daysUntilBanner, setDaysUntilBanner] = useLocalStorage(
    'gc:pulls:daysUntilNextBanner',
    FALLBACK_DAYS_UNTIL_BANNER,
  )
  const [daysManual, setDaysManual] = useLocalStorage('gc:pulls:daysManual', false)
  const [guaranteed, setGuaranteed] = useLocalStorage('gc:pulls:guaranteed', false)
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

  const clampedPity = Math.min(HARD_PITY - 1, parseNonNegInt(pity))
  const safeSaved = parseNonNegInt(savedPulls)
  const safePrimos = parseNonNegInt(primos)
  const pullsFromSavedPrimos = pullsFromPrimos(safePrimos)
  const totalPulls = totalPullsAvailable(safeSaved, safePrimos)
  const safeDays = Math.max(1, parseNonNegInt(daysUntilBanner, 1))

  const successChance = useMemo(
    () =>
      featuredSuccessChance({
        currentPity: clampedPity,
        pullsAvailable: totalPulls,
        guaranteed,
      }),
    [clampedPity, totalPulls, guaranteed],
  )

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

  /** Past likely → plan for 95% “guaranteed”; otherwise plan for likely. */
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

  const remainingToHard = HARD_PITY - clampedPity
  const progress = clampedPity / HARD_PITY

  const pullsBreakdown =
    pullsFromSavedPrimos > 0
      ? `${safeSaved.toLocaleString()} fates + ${pullsFromSavedPrimos.toLocaleString()} from primos`
      : 'Saved Intertwined Fates'

  return (
    <>
      <header className="hero">
        <h1>Wish planner</h1>
        <p className="lede">
          {subTab === 'odds'
            ? 'Check your featured 5★ odds from pity and saved fates.'
            : 'See how many pulls per day you need before the banner to reach likely — or guarantee if you’re already past likely.'}
        </p>
        <div className="sub-tabs" role="tablist" aria-label="Pull tools">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'odds'}
            className={subTab === 'odds' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setSubTab('odds')}
          >
            Odds
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'pace'}
            className={subTab === 'pace' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setSubTab('pace')}
          >
            Daily pace
          </button>
        </div>
      </header>

      <main className="panel">
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
                  ? `= ${pullsFromSavedPrimos.toLocaleString()} pull${pullsFromSavedPrimos === 1 ? '' : 's'} (${PRIMOS_PER_PULL}/pull)`
                  : `${PRIMOS_PER_PULL} per pull`}
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

        {subTab === 'odds' ? (
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
              Soft pity from {SOFT_PITY_START}, hard pity at {HARD_PITY}. Capturing Radiance not
              included.
            </p>

            <PityChart currentPity={clampedPity} pullsAvailable={totalPulls} />
          </>
        ) : (
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
                          · +{schedule.phaseLengthDays}d next phase →{' '}
                          {schedule.daysUntilAfterNext} days
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
                              setDaysUntilBanner(
                                String(liveDaysForHorizon(schedule, bannerHorizon)),
                              )
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
        )}
      </main>
    </>
  )
}

export default PullPage
