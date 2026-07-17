import { useMemo, useState } from 'react'
import { useWishPlannerInputs } from '../../hooks/useWishPlannerInputs.tsx'
import {
  HARD_PITY,
  featuredSuccessChance,
  fiveStarRate,
} from '../../model/wishes.ts'
import { PityChart } from './PityChart.tsx'

type PullOutcome = 'miss' | 'standard' | 'featured' | 'hard-pity'
type PullSize = 1 | 10

interface SessionState {
  pity: number
  guaranteed: boolean
  pullsLeft: number
  sessionPulls: number
  startingPulls: number
  startingPity: number
  featuredObtained: number
}

interface Snapshot extends SessionState {
  outcome: PullOutcome
  count: number
  /** 1-based index of the 5★ within a multi-pull, when applicable. */
  fiveStarAt?: number
}

function formatChance(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  if (value >= 0.9995) return '99.9%+'
  if (value >= 0.1) return `${(value * 100).toFixed(1)}%`
  return `${(value * 100).toFixed(2)}%`
}

function clampPity(pity: number): number {
  return Math.min(HARD_PITY - 1, Math.max(0, Math.floor(pity)))
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function outcomeLabel(
  outcome: PullOutcome,
  count: number,
  wasGuaranteed: boolean,
  fiveStarAt?: number,
): string {
  const pulls = count === 1 ? '1 pull' : `${count} pulls`
  const at =
    fiveStarAt !== undefined && count > 1 ? ` · 5★ on #${fiveStarAt}` : ''
  if (outcome === 'miss') return `${pulls} · no 5★`
  if (outcome === 'hard-pity') {
    return wasGuaranteed
      ? `${pulls} · hard pity (featured)${at}`
      : `${pulls} · hard pity (not featured)${at}`
  }
  if (outcome === 'standard') return `${pulls} · lost 50/50${at}`
  return wasGuaranteed
    ? `${pulls} · featured (guaranteed)${at}`
    : `${pulls} · won 50/50${at}`
}

export default function PullingDayPage() {
  const { clampedPity, guaranteed, totalPulls } = useWishPlannerInputs()

  const [session, setSession] = useState<SessionState | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [pullSize, setPullSize] = useState<PullSize>(1)
  const [fiveStarAtRaw, setFiveStarAtRaw] = useState('1')
  const [pendingFiveStar, setPendingFiveStar] = useState<'standard' | 'featured' | null>(null)
  const [sessionPullsDraft, setSessionPullsDraft] = useState<string | null>(null)

  const baselineChance = useMemo(
    () =>
      featuredSuccessChance({
        currentPity: clampedPity,
        pullsAvailable: totalPulls,
        guaranteed,
      }),
    [clampedPity, totalPulls, guaranteed],
  )

  function startSession() {
    setSession({
      pity: clampedPity,
      guaranteed,
      pullsLeft: totalPulls,
      sessionPulls: 0,
      startingPulls: totalPulls,
      startingPity: clampedPity,
      featuredObtained: 0,
    })
    setHistory([])
    setSessionPullsDraft(null)
    setPendingFiveStar(null)
    setFiveStarAtRaw('1')
  }

  function endSession() {
    setSession(null)
    setHistory([])
    setSessionPullsDraft(null)
    setPendingFiveStar(null)
  }

  function applySpend(
    count: number,
    next: Omit<SessionState, 'pullsLeft' | 'sessionPulls' | 'startingPulls' | 'startingPity'>,
  ) {
    if (!session) return
    const sessionPulls = session.sessionPulls + count
    setSession({
      ...next,
      startingPulls: session.startingPulls,
      startingPity: session.startingPity,
      sessionPulls,
      pullsLeft: Math.max(0, session.startingPulls - sessionPulls),
    })
    setSessionPullsDraft(null)
  }

  function commitSessionPulls(raw: string) {
    if (!session) return
    const sessionPulls = raw.trim() === '' ? 0 : Math.max(0, Math.floor(Number(raw)))
    setSession({
      ...session,
      sessionPulls,
      pullsLeft: Math.max(0, session.startingPulls - sessionPulls),
    })
    setSessionPullsDraft(null)
  }

  function onSessionPullsChange(raw: string) {
    if (!session) return
    if (raw !== '' && !/^\d+$/.test(raw)) return
    setSessionPullsDraft(raw)
    if (raw === '') return
    const sessionPulls = Math.max(0, Math.floor(Number(raw)))
    setSession({
      ...session,
      sessionPulls,
      pullsLeft: Math.max(0, session.startingPulls - sessionPulls),
    })
  }

  function resolveFiveStarAt(batchSize: number, pity: number): number {
    const maxAt = Math.min(batchSize, HARD_PITY - pity)
    const parsed = Number(fiveStarAtRaw)
    if (!Number.isFinite(parsed)) return 1
    return clampInt(parsed, 1, Math.max(1, maxAt))
  }

  function logMiss() {
    if (!session) return
    setPendingFiveStar(null)
    const requested = pullSize
    const pullsToHardStar = HARD_PITY - session.pity

    if (requested < pullsToHardStar) {
      setHistory((prev) => [...prev, { ...session, outcome: 'miss', count: requested }])
      applySpend(requested, {
        pity: clampPity(session.pity + requested),
        guaranteed: session.guaranteed,
        featuredObtained: session.featuredObtained,
      })
      return
    }

    // Hard pity is forced on this pull of the batch; leftovers continue after.
    const at = pullsToHardStar
    const remainingAfter = requested - at
    const gotFeatured = session.guaranteed

    setHistory((prev) => [
      ...prev,
      { ...session, outcome: 'hard-pity', count: requested, fiveStarAt: at },
    ])
    applySpend(requested, {
      pity: clampPity(remainingAfter),
      guaranteed: gotFeatured ? false : true,
      featuredObtained: session.featuredObtained + (gotFeatured ? 1 : 0),
    })
  }

  function logFiveStar(outcome: 'standard' | 'featured', atOverride?: number) {
    if (!session) return
    const requested = pullSize
    const at = atOverride ?? resolveFiveStarAt(requested, session.pity)
    const remainingAfter = requested - at
    const gotFeatured = outcome === 'featured'

    setHistory((prev) => [
      ...prev,
      { ...session, outcome, count: requested, fiveStarAt: at },
    ])
    applySpend(requested, {
      pity: clampPity(remainingAfter),
      guaranteed: outcome === 'standard',
      featuredObtained: session.featuredObtained + (gotFeatured ? 1 : 0),
    })
    setPendingFiveStar(null)
    setFiveStarAtRaw('1')
  }

  function beginFiveStar(outcome: 'standard' | 'featured') {
    if (!session) return
    if (pullSize === 1) {
      logFiveStar(outcome, 1)
      return
    }
    setFiveStarAtRaw('1')
    setPendingFiveStar(outcome)
  }

  function confirmPendingFiveStar() {
    if (!session || !pendingFiveStar) return
    logFiveStar(pendingFiveStar)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setSession({
      pity: last.pity,
      guaranteed: last.guaranteed,
      pullsLeft: last.pullsLeft,
      sessionPulls: last.sessionPulls,
      startingPulls: last.startingPulls,
      startingPity: last.startingPity,
      featuredObtained: last.featuredObtained,
    })
    setHistory((prev) => prev.slice(0, -1))
    setSessionPullsDraft(null)
    setPendingFiveStar(null)
  }

  if (!session) {
    return (
      <section className="pace-panel pace-panel-tab pulling-day" aria-label="Pulling day">
        <div className="pulling-day-purpose">
          <p className="pulling-day-purpose-title">Live pull tracker</p>
          <p className="pulling-day-purpose-body">
            Use this while you wish. Each log moves your marker on the pity curve and
            recalculates featured chance with what’s left — so you can see how odds change
            mid-session. Your saved pity, fates, and primos above stay frozen as the
            before-day baseline.
          </p>
        </div>

        <div className="field">
          <button type="button" className="chip" onClick={startSession}>
            Start session
          </button>
          <p className="field-note">
            Copies pity {clampedPity} · {totalPulls.toLocaleString()} pull
            {totalPulls === 1 ? '' : 's'} · {guaranteed ? 'guaranteed' : '50/50'} (
            {formatChance(baselineChance)} featured) into a temporary session.
          </p>
        </div>

        <PityChart currentPity={clampedPity} pullsAvailable={totalPulls} />
      </section>
    )
  }

  const nextPullRate = fiveStarRate(session.pity + 1)
  const pullsToHardStar = HARD_PITY - session.pity
  const maxFiveStarAt = Math.min(pullSize, pullsToHardStar)
  const nextFeaturedChance = featuredSuccessChance({
    currentPity: session.pity,
    pullsAvailable: session.pullsLeft,
    guaranteed: session.guaranteed,
  })
  const lastOutcome = history[history.length - 1]
  const projectingNext = session.featuredObtained > 0

  return (
    <section className="pace-panel pace-panel-tab pulling-day" aria-label="Pulling day">
      <div className="pulling-day-purpose">
        <p className="pulling-day-purpose-title">Session in progress</p>
        <p className="pulling-day-purpose-body">
          Chart and odds below are live. Planner inputs above stay at your before-day
          baseline ({formatChance(baselineChance)} featured).
        </p>
      </div>

      <PityChart
        currentPity={session.pity}
        pullsAvailable={session.pullsLeft}
        startPity={session.startingPity}
      />

      <div className="results results-pulling" aria-live="polite">
        <div className="stat-block">
          <p className="stat-label">This pull 5★</p>
          <p className="stat-value">{formatChance(nextPullRate)}</p>
          <p className="stat-note">
            Pity {session.pity} → {Math.min(HARD_PITY, session.pity + 1)}
          </p>
        </div>
        <div className="stat-block accent">
          <p className="stat-label">
            {projectingNext ? 'Next featured odds' : 'Featured odds left'}
          </p>
          <p className="stat-value">{formatChance(nextFeaturedChance)}</p>
          <p className="stat-note">
            {session.pullsLeft.toLocaleString()} pull{session.pullsLeft === 1 ? '' : 's'} ·{' '}
            {session.guaranteed ? 'guaranteed' : '50/50'}
            {projectingNext ? ` · ${session.featuredObtained} obtained` : ''}
          </p>
        </div>
        <div className="stat-block">
          <label className="stat-label" htmlFor="session-pulls">
            Session
          </label>
          <input
            id="session-pulls"
            className="stat-value-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={sessionPullsDraft ?? String(session.sessionPulls)}
            onChange={(e) => onSessionPullsChange(e.target.value)}
            onBlur={() => commitSessionPulls(sessionPullsDraft ?? String(session.sessionPulls))}
            aria-describedby="session-pulls-note"
          />
          <p className="stat-note" id="session-pulls-note">
            {lastOutcome
              ? `Last: ${outcomeLabel(lastOutcome.outcome, lastOutcome.count, lastOutcome.guaranteed, lastOutcome.fiveStarAt)}`
              : 'Editable if you mistype a log'}
          </p>
        </div>
      </div>

      <div className="field">
        <span className="label" id="pull-size-label">
          Log as
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="pull-size-label">
          <button
            type="button"
            className={pullSize === 1 ? 'chip active' : 'chip'}
            aria-pressed={pullSize === 1}
            onClick={() => {
              setPullSize(1)
              setPendingFiveStar(null)
            }}
          >
            1 pull
          </button>
          <button
            type="button"
            className={pullSize === 10 ? 'chip active' : 'chip'}
            aria-pressed={pullSize === 10}
            onClick={() => setPullSize(10)}
          >
            10 pulls
          </button>
        </div>
      </div>

      <div className="field">
        <span className="label" id="miss-label">
          No 5★ / keep pulling
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="miss-label">
          <button
            type="button"
            className="chip"
            disabled={pendingFiveStar !== null}
            onClick={logMiss}
          >
            No 5★
          </button>
        </div>
        <p className="field-note">
          {pullsToHardStar <= pullSize
            ? `Hitting hard pity without picking featured assumes ${session.guaranteed ? 'featured (already guaranteed)' : 'not featured → guarantee'}; leftover pulls continue for the next featured.`
            : 'Advances pity and spends from the session budget.'}
        </p>
      </div>

      <div className="field">
        <span className="label" id="five-star-label">
          Got a 5★
        </span>
        <div className="chip-row wrap" role="group" aria-labelledby="five-star-label">
          {!session.guaranteed && (
            <button
              type="button"
              className={pendingFiveStar === 'standard' ? 'chip active' : 'chip'}
              aria-pressed={pendingFiveStar === 'standard'}
              onClick={() => beginFiveStar('standard')}
            >
              Lost 50/50
            </button>
          )}
          <button
            type="button"
            className={pendingFiveStar === 'featured' ? 'chip active' : 'chip'}
            aria-pressed={pendingFiveStar === 'featured'}
            onClick={() => beginFiveStar('featured')}
          >
            {session.guaranteed ? 'Got featured' : 'Won 50/50'}
          </button>
        </div>
        <p className="field-note">
          {pullSize === 10
            ? 'On a 10-pull, you’ll set which wish the 5★ was on before confirming.'
            : 'Counts as 1 pull, then pity resets.'}
        </p>
      </div>

      {pendingFiveStar !== null && pullSize === 10 && (
        <div className="field five-star-at-panel">
          <label className="label" htmlFor="five-star-at">
            5★ on pull #
          </label>
          <div className="field-row">
            <div className="field">
              <input
                id="five-star-at"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={fiveStarAtRaw}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === '' || /^\d+$/.test(next)) setFiveStarAtRaw(next)
                }}
                onBlur={() => setFiveStarAtRaw(String(resolveFiveStarAt(10, session.pity)))}
              />
              <p className="field-note">
                Within the 10-pull (1–{maxFiveStarAt}
                {maxFiveStarAt < 10 ? `, hard pity by #${maxFiveStarAt}` : ''}). Misses before /
                leftovers after update pity.
              </p>
            </div>
            <div className="field">
              <span className="label">Confirm</span>
              <div className="chip-row wrap">
                <button type="button" className="chip active" onClick={confirmPendingFiveStar}>
                  Log 5★
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setPendingFiveStar(null)
                    setFiveStarAtRaw('1')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="pulling-day-actions">
        {history.length > 0 && (
          <button type="button" className="text-button" onClick={undo}>
            Undo last
          </button>
        )}
        <button type="button" className="text-button" onClick={startSession}>
          Restart from planner
        </button>
        <button type="button" className="text-button" onClick={endSession}>
          End session
        </button>
      </p>
    </section>
  )
}
