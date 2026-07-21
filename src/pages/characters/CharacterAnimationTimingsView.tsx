import { useMemo, useState } from 'react'
import {
  getCharacterAnimationTimings,
  listCoreTimingGaps,
} from '../rotations/animationTimings'
import type {
  AnimationAction,
  AnimationState,
} from '../rotations/animationTimingsTypes'

function actionFamily(kind: string): string {
  if (/^na\d+$/i.test(kind)) return 'na'
  if (/^ca|aim/i.test(kind)) return 'ca'
  if (/^skill/i.test(kind)) return 'skill'
  if (/^burst/i.test(kind)) return 'burst'
  if (/^dash/i.test(kind)) return 'dash'
  if (/^plunge|^jump/i.test(kind)) return 'move'
  return 'other'
}

function formatSeconds(seconds: number | null, frames: number | null): string {
  if (seconds != null) {
    const s = seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)
    return frames != null ? `${s}s · ${frames}f` : `${s}s`
  }
  if (frames != null) return `${frames}f`
  return '—'
}

function sortActions(actions: AnimationAction[]): AnimationAction[] {
  const rank = (a: AnimationAction) => {
    const fam = actionFamily(a.kind)
    const famOrder: Record<string, number> = {
      na: 0,
      ca: 1,
      skill: 2,
      burst: 3,
      dash: 4,
      move: 5,
      other: 6,
    }
    const naN = /^na(\d+)$/i.exec(a.kind)
    return (famOrder[fam] ?? 9) * 100 + (naN ? Number(naN[1]) : 0)
  }
  return [...actions].sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    return a.label.localeCompare(b.label)
  })
}

function StateTimingBars({
  state,
  maxSeconds,
}: {
  state: AnimationState
  maxSeconds: number
}) {
  const actions = useMemo(
    () => sortActions(state.actions.filter((a) => a.frames != null && a.frames > 0)),
    [state.actions],
  )

  if (!actions.length) {
    return (
      <p className="field-note anim-timings-empty">
        No timed actions in this state yet.
      </p>
    )
  }

  const scale = maxSeconds > 0 ? maxSeconds : 1

  return (
    <ul className="anim-timings-bars" aria-label={`${state.label} action lengths`}>
      {actions.map((action) => {
        const seconds = action.seconds ?? (action.frames ?? 0) / 60
        const widthPct = Math.max(2, Math.min(100, (seconds / scale) * 100))
        const family = actionFamily(action.kind)
        return (
          <li key={`${state.id}-${action.id}`} className="anim-timings-row">
            <span className="anim-timings-label" title={action.notes ?? action.gcsimVar}>
              {action.label}
            </span>
            <div className="anim-timings-track" aria-hidden="true">
              <div
                className={`anim-timings-bar fam-${family}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="anim-timings-value">
              {formatSeconds(action.seconds, action.frames)}
              {action.framesMax != null ? (
                <span className="anim-timings-range">
                  {' '}
                  – {formatSeconds(action.secondsMax ?? null, action.framesMax)}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

interface CharacterAnimationTimingsViewProps {
  characterId: string
  weapon?: string
  defaultOpen?: boolean
}

/** Horizontal bar comparison of animation lengths for a character. */
export function CharacterAnimationTimingsView({
  characterId,
  weapon,
  defaultOpen = true,
}: CharacterAnimationTimingsViewProps) {
  const data = getCharacterAnimationTimings(characterId)
  const [stateId, setStateId] = useState<string | null>(null)

  const coreGaps = useMemo(
    () => listCoreTimingGaps(characterId, weapon),
    [characterId, weapon],
  )
  const showGapWarning = !data || coreGaps.length > 0

  const activeStateId = useMemo(() => {
    if (!data?.states.length) return null
    if (stateId && data.states.some((s) => s.id === stateId)) return stateId
    return data.states[0]?.id ?? null
  }, [data, stateId])

  const activeState = data?.states.find((s) => s.id === activeStateId) ?? null

  const maxSeconds = useMemo(() => {
    if (!data) return 1
    let max = 0
    for (const state of data.states) {
      for (const action of state.actions) {
        if (action.frames == null || action.frames <= 0) continue
        const hi = action.secondsMax ?? action.seconds ?? action.frames / 60
        const lo = action.seconds ?? action.frames / 60
        max = Math.max(max, hi, lo)
      }
    }
    return max > 0 ? max : 1
  }, [data])

  const gapLabels = useMemo(() => {
    if (!data) return 'No timing data yet'
    const labels = [
      ...new Set(
        coreGaps.map((g) =>
          g.stateId === 'default' ? g.label : `${g.stateId}: ${g.label}`,
        ),
      ),
    ]
    if (labels.length <= 4) return labels.join(', ')
    return `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more`
  }, [coreGaps, data])

  if (!data) {
    return (
      <details className="rotation-kit-details anim-timings" open={defaultOpen}>
        <summary>
          Animation timings
          <span className="anim-timings-warn" title="No timing data yet">
            {' '}
            Incomplete
          </span>
        </summary>
        <p className="field-note">No timing data for this character yet.</p>
      </details>
    )
  }

  return (
    <details className="rotation-kit-details anim-timings" open={defaultOpen}>
      <summary>
        Animation timings
        {showGapWarning ? (
          <span
            className="anim-timings-warn"
            title={`Missing frame data: ${gapLabels}`}
          >
            {' '}
            Incomplete
          </span>
        ) : null}
      </summary>
      <p className="field-note anim-timings-lede">
        Action lengths compared side-by-side (60 FPS). Longer bar = longer
        animation lock.
      </p>

      {showGapWarning ? (
        <p className="field-note anim-timings-gap" role="status">
          Some core actions are still missing frame data
          {gapLabels ? ` (${gapLabels})` : ''}.
        </p>
      ) : null}

      {data.states.length > 1 ? (
        <div
          className="chip-row wrap anim-timings-states"
          role="group"
          aria-label="Animation state"
        >
          {data.states.map((state) => (
            <button
              key={state.id}
              type="button"
              className={
                activeStateId === state.id
                  ? 'chip compact active'
                  : 'chip compact'
              }
              onClick={() => setStateId(state.id)}
            >
              {state.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeState ? (
        <StateTimingBars state={activeState} maxSeconds={maxSeconds} />
      ) : null}
    </details>
  )
}
