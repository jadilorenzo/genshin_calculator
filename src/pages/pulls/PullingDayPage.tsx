import { useMemo, useState } from 'react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { useWishPlannerInputs } from '../../hooks/useWishPlannerInputs.tsx'
import {
  HARD_PITY,
  featuredSuccessChance,
  fiveStarRate,
} from '../../model/wishes.ts'
import { PityChart } from './PityChart.tsx'

type PullOutcome = 'miss' | 'standard' | 'featured' | 'hard-pity'
type PullSize = 1 | 10
type OutcomeChoice = 'miss' | 'standard' | 'featured'

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
  useDocumentTitle(PAGE_TITLES.pullingDay)
  const { clampedPity, guaranteed, totalPulls } = useWishPlannerInputs()

  const [session, setSession] = useState<SessionState | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [pullSize, setPullSize] = useState<PullSize>(1)
  const [outcomeChoice, setOutcomeChoice] = useState<OutcomeChoice>('miss')
  const [fiveStarAtRaw, setFiveStarAtRaw] = useState('1')
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
    setOutcomeChoice('miss')
    setFiveStarAtRaw('1')
  }

  function endSession() {
    setSession(null)
    setHistory([])
    setSessionPullsDraft(null)
    setOutcomeChoice('miss')
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
    const at = atOverride ?? (pullSize === 1 ? 1 : resolveFiveStarAt(requested, session.pity))
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
    setFiveStarAtRaw('1')
  }

  function logSelected() {
    if (outcomeChoice === 'miss') {
      logMiss()
      return
    }
    const outcome =
      session?.guaranteed && outcomeChoice === 'standard' ? 'featured' : outcomeChoice
    logFiveStar(outcome)
    setOutcomeChoice('miss')
  }

  function chooseOutcome(choice: OutcomeChoice) {
    setOutcomeChoice(choice)
    if (choice !== 'miss') setFiveStarAtRaw('1')
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

        <PityChart currentPity={clampedPity} showProjection={false} />
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

      <PityChart currentPity={session.pity} showProjection={false} />

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
            onClick={() => setPullSize(1)}
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

      <div className="field pulling-day-actions-block">
        <span className="label" id="pull-outcome-label">
          What happened
        </span>
        <div className="pulling-day-log-row">
          <div className="switch-group" role="radiogroup" aria-labelledby="pull-outcome-label">
            <button
              type="button"
              role="radio"
              className={outcomeChoice === 'miss' ? 'switch-option on' : 'switch-option'}
              aria-checked={outcomeChoice === 'miss'}
              onClick={() => chooseOutcome('miss')}
            >
              No 5★
            </button>
            {!session.guaranteed && (
              <button
                type="button"
                role="radio"
                className={outcomeChoice === 'standard' ? 'switch-option on' : 'switch-option'}
                aria-checked={outcomeChoice === 'standard'}
                onClick={() => chooseOutcome('standard')}
              >
                Lost 50/50
              </button>
            )}
            <button
              type="button"
              role="radio"
              className={
                outcomeChoice === 'featured' || (session.guaranteed && outcomeChoice === 'standard')
                  ? 'switch-option on'
                  : 'switch-option'
              }
              aria-checked={
                outcomeChoice === 'featured' || (session.guaranteed && outcomeChoice === 'standard')
              }
              onClick={() => chooseOutcome('featured')}
            >
              {session.guaranteed ? 'Got featured' : 'Won 50/50'}
            </button>
          </div>
          <button type="button" className="chip filled log-outcome-button" onClick={logSelected}>
            Log
          </button>
        </div>

        {outcomeChoice !== 'miss' && pullSize === 10 && (
          <div className="five-star-at-row">
            <label className="label" htmlFor="five-star-at">
              5★ on pull #
            </label>
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
          </div>
        )}

        <p className="field-note">
          {outcomeChoice !== 'miss' && pullSize === 10
            ? `5★ on pull # within the 10-pull (1–${maxFiveStarAt}${maxFiveStarAt < 10 ? `, hard pity by #${maxFiveStarAt}` : ''}).`
            : pullsToHardStar <= pullSize && outcomeChoice === 'miss'
              ? `Hitting hard pity without picking featured assumes ${session.guaranteed ? 'featured (already guaranteed)' : 'not featured → guarantee'}; leftover pulls continue for the next featured.`
              : outcomeChoice === 'miss'
                ? 'Advances pity and spends from the session budget.'
                : 'Resets pity; leftover pulls in a 10-pull continue after the 5★.'}
        </p>
      </div>

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
