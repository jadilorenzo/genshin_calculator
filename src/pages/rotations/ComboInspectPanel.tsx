import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type SetStateAction,
} from 'react'
import { getCharacter } from './characters'
import {
  comboActionFamily,
  createComboStep,
  listPaletteActions,
  packComboSteps,
  seedComboStepsFromCasts,
} from './comboSequence'
import {
  getCharacterAnimationTimings,
} from './animationTimings'
import { kitHoldChannelSeconds } from './fieldTimings'
import { setOnFieldDuration } from './timelineContinuous'
import type { ComboStep, TimelinePlacement } from './types'

/** Use text/plain so every browser can read the payload on drop. */
const DRAG_PREFIX = 'fmr-combo:'

const DEFAULT_PX_PER_SEC = 56
const MIN_BLOCK_PX = 28

type DragPayload =
  | { type: 'palette'; actionId: string; stateId: string }
  | { type: 'step'; stepId: string; index: number }

const joinClassNames = (
  ...parts: Array<string | false | null | undefined>
) => parts.filter(Boolean).join(' ')

const encodeDrag = (payload: DragPayload) =>
  `${DRAG_PREFIX}${JSON.stringify(payload)}`

const decodeDrag = (raw: string): DragPayload | null => {
  if (!raw.startsWith(DRAG_PREFIX)) return null
  try {
    return JSON.parse(raw.slice(DRAG_PREFIX.length)) as DragPayload
  } catch {
    return null
  }
}

interface ComboInspectPanelProps {
  placement: TimelinePlacement
  switchBuffer: number
  onChange: (next: SetStateAction<TimelinePlacement[]>) => void
}

export function ComboInspectPanel({
  placement,
  switchBuffer,
  onChange,
}: ComboInspectPanelProps) {
  const character = getCharacter(placement.characterId)
  const timings = getCharacterAnimationTimings(placement.characterId)
  const [paletteStateId, setPaletteStateId] = useState(
    () => timings?.states[0]?.id ?? 'default',
  )
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragMovedRef = useRef(false)
  const dragKindRef = useRef<'palette' | 'step' | null>(null)

  const steps = placement.comboSteps ?? []
  const packed = useMemo(
    () => packComboSteps(placement.characterId, steps),
    [placement.characterId, steps],
  )

  const paletteActions = useMemo(
    () => listPaletteActions(placement.characterId, paletteStateId),
    [placement.characterId, paletteStateId],
  )

  const states = timings?.states ?? []

  const updateSteps = (nextSteps: ComboStep[], syncDuration = true) => {
    onChange((prev) => {
      const current = prev.find((p) => p.id === placement.id)
      if (!current) return prev
      const patched: TimelinePlacement = {
        ...current,
        comboSteps: nextSteps,
      }
      if (!syncDuration) {
        return prev.map((p) => (p.id === placement.id ? patched : p))
      }
      const total = packComboSteps(patched.characterId, nextSteps).totalSeconds
      const duration = Math.max(0.5, total || current.duration)
      return setOnFieldDuration(
        prev.map((p) => (p.id === placement.id ? patched : p)),
        placement.id,
        duration,
        switchBuffer,
      )
    })
  }

  const appendAction = (actionId: string, stateId = paletteStateId) => {
    updateSteps([...steps, createComboStep(actionId, stateId)])
  }

  const insertActionAt = (
    index: number,
    actionId: string,
    stateId = paletteStateId,
  ) => {
    const next = [...steps]
    const at = Math.max(0, Math.min(index, next.length))
    next.splice(at, 0, createComboStep(actionId, stateId))
    updateSteps(next)
  }

  const moveStep = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= steps.length) return
    if (to === from || to === from + 1) return
    const next = [...steps]
    const [item] = next.splice(from, 1)
    const insertAt = to > from ? to - 1 : to
    next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, item)
    updateSteps(next)
  }

  const removeStep = (id: string) => {
    updateSteps(steps.filter((s) => s.id !== id))
  }

  const setGapAfter = (id: string, gapAfter: number) => {
    updateSteps(
      steps.map((s) =>
        s.id === id
          ? {
              ...s,
              gapAfter: gapAfter > 0 ? Math.min(10, gapAfter) : undefined,
            }
          : s,
      ),
    )
  }

  const setStepDuration = (id: string, seconds: number | null) => {
    updateSteps(
      steps.map((s) => {
        if (s.id !== id) return s
        if (seconds == null || !(seconds > 0)) {
          const { durationSeconds: _drop, ...rest } = s
          return rest
        }
        return {
          ...s,
          durationSeconds: Math.min(30, Math.round(seconds * 1000) / 1000),
        }
      }),
    )
  }

  const clearSteps = () => updateSteps([])

  const seedFromCasts = () => {
    const kitHold = kitHoldChannelSeconds(
      character?.kit.elementalSkill ?? null,
    )
    const seeded = seedComboStepsFromCasts(placement.characterId, {
      skill: placement.castSkill ?? true,
      burst: placement.castBurst ?? true,
      castOrder: placement.castOrder,
      skillVariant: placement.skillVariant,
      skillCasts: placement.skillCasts,
      kitHoldSeconds: kitHold,
    })
    updateSteps(seeded)
  }

  /** Insert index from pointer X across the track (0..steps.length). */
  const indexFromClientX = (clientX: number): number => {
    const track = trackRef.current
    if (!track || steps.length === 0) return steps.length
    const wraps = track.querySelectorAll<HTMLElement>('[data-step-index]')
    for (const el of wraps) {
      const rect = el.getBoundingClientRect()
      const mid = rect.left + rect.width / 2
      const index = Number(el.dataset.stepIndex)
      if (clientX < mid) return index
    }
    return steps.length
  }

  const onPaletteDragStart = (e: DragEvent, actionId: string) => {
    dragMovedRef.current = true
    dragKindRef.current = 'palette'
    const payload = encodeDrag({
      type: 'palette',
      actionId,
      stateId: paletteStateId,
    })
    e.dataTransfer.setData('text/plain', payload)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onStepDragStart = (e: DragEvent, stepId: string, index: number) => {
    dragMovedRef.current = true
    dragKindRef.current = 'step'
    e.dataTransfer.setData(
      'text/plain',
      encodeDrag({ type: 'step', stepId, index }),
    )
    e.dataTransfer.effectAllowed = 'move'
  }

  const applyDrop = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDropIndex(null)
    dragKindRef.current = null
    const payload = decodeDrag(e.dataTransfer.getData('text/plain'))
    if (!payload) return
    if (payload.type === 'step') {
      moveStep(payload.index, index)
      return
    }
    insertActionAt(index, payload.actionId, payload.stateId || paletteStateId)
  }

  const onTrackDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect =
      dragKindRef.current === 'step' ? 'move' : 'copy'
    setDropIndex(indexFromClientX(e.clientX))
  }

  const onTrackDrop = (e: DragEvent) => {
    applyDrop(e, indexFromClientX(e.clientX))
  }

  const onTrackDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setDropIndex(null)
  }

  if (!character) return null

  const scale =
    packed.totalSeconds > 0
      ? Math.max(
          DEFAULT_PX_PER_SEC,
          Math.min(120, 480 / Math.max(packed.totalSeconds, 1)),
        )
      : DEFAULT_PX_PER_SEC

  return (
    <section
      className="combo-inspect"
      aria-label={`${character.name} combo inspect`}
    >
      <div className="combo-inspect-head">
        <div className="combo-inspect-titles">
          <h2 className="rotation-section-title">Inspect · {character.name}</h2>
          <p className="field-note">
            Click or drag actions into the sequence. Drop anywhere on the lane
            to append or insert.
          </p>
        </div>
        <div className="combo-inspect-meta">
          <span className="combo-inspect-total">
            {packed.totalSeconds > 0
              ? `${packed.totalSeconds.toFixed(2)}s packed`
              : 'Empty sequence'}
          </span>
          <button
            type="button"
            className="chip compact"
            onClick={seedFromCasts}
            title="Fill from Skill/Burst cast presets"
          >
            Seed from casts
          </button>
          <button
            type="button"
            className="chip compact"
            disabled={steps.length === 0}
            onClick={clearSteps}
          >
            Clear
          </button>
        </div>
      </div>

      {states.length > 1 ? (
        <div
          className="chip-row wrap combo-inspect-states"
          role="group"
          aria-label="Animation state for palette"
        >
          {states.map((state) => (
            <button
              key={state.id}
              type="button"
              className={joinClassNames(
                'chip compact',
                paletteStateId === state.id && 'active',
              )}
              onClick={() => setPaletteStateId(state.id)}
            >
              {state.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="combo-inspect-palette" aria-label="Available actions">
        {paletteActions.length === 0 ? (
          <p className="field-note">No timed actions for this state yet.</p>
        ) : (
          paletteActions.map((action) => {
            const family = comboActionFamily(action.kind || action.id)
            const secs =
              action.seconds ??
              (action.frames != null ? action.frames / 60 : null)
            return (
              <button
                key={`${paletteStateId}-${action.id}`}
                type="button"
                className={`combo-inspect-chip kind-${family}`}
                draggable
                onDragStart={(e) => onPaletteDragStart(e, action.id)}
                onDragEnd={() => {
                  dragKindRef.current = null
                  // Allow the next click; suppress only the ghost click after drag.
                  window.setTimeout(() => {
                    dragMovedRef.current = false
                  }, 0)
                }}
                onClick={() => {
                  if (dragMovedRef.current) {
                    dragMovedRef.current = false
                    return
                  }
                  appendAction(action.id)
                }}
                title={
                  secs != null
                    ? `${action.label} · ${secs.toFixed(2)}s — click or drag`
                    : `${action.label} · untimed — click or drag`
                }
              >
                <span>{action.label}</span>
                <span className="combo-inspect-chip-secs">
                  {secs != null ? `${secs.toFixed(2)}s` : '—'}
                </span>
              </button>
            )
          })
        )}
      </div>

      <div
        className="combo-inspect-lane"
        aria-label="Combo sequence"
        onDragOver={onTrackDragOver}
        onDrop={onTrackDrop}
        onDragLeave={onTrackDragLeave}
      >
        {steps.length === 0 ? (
          <div
            className={joinClassNames(
              'combo-inspect-empty',
              dropIndex != null && 'drop-target',
            )}
          >
            Drop actions here, click palette chips, or use Seed from casts
          </div>
        ) : (
          <div className="combo-inspect-track" ref={trackRef}>
            {packed.segments.map((seg, index) => {
              const width = Math.max(seg.duration * scale, MIN_BLOCK_PX)
              const gapWidth =
                seg.gapAfter > 0 ? Math.max(seg.gapAfter * scale, 12) : 0
              const family = comboActionFamily(seg.kind)
              const showInsertBefore = dropIndex === index
              return (
                <div
                  key={seg.stepId}
                  className="combo-inspect-step-wrap"
                  data-step-index={index}
                >
                  <div
                    className={joinClassNames(
                      'combo-inspect-drop',
                      showInsertBefore && 'active',
                    )}
                    aria-hidden
                  />
                  <div
                    className={joinClassNames(
                      'combo-inspect-step',
                      `kind-${family}`,
                      seg.incomplete && 'incomplete',
                    )}
                    style={{ width }}
                    draggable
                    onDragStart={(e) =>
                      onStepDragStart(e, seg.stepId, index)
                    }
                    onDragEnd={() => {
                      dragKindRef.current = null
                      setDropIndex(null)
                    }}
                    title={`${seg.label} · ${seg.duration.toFixed(2)}s${
                      seg.durationOverridden ? ' (custom)' : ''
                    }`}
                  >
                    <span className="combo-inspect-step-label">{seg.label}</span>
                    <label
                      className={joinClassNames(
                        'combo-inspect-step-time',
                        seg.durationOverridden && 'overridden',
                      )}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="visually-hidden">
                        Duration for {seg.label}
                      </span>
                      <input
                        type="number"
                        min={0.05}
                        max={30}
                        step={0.05}
                        value={seg.duration}
                        title={
                          seg.durationOverridden
                            ? 'Custom duration (seconds) — double-click to reset'
                            : 'Action duration (seconds)'
                        }
                        onChange={(e) => {
                          const raw = Number(e.target.value)
                          if (!Number.isFinite(raw)) return
                          setStepDuration(seg.stepId, Math.max(0.05, raw))
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setStepDuration(seg.stepId, null)
                        }}
                      />
                      <span aria-hidden>s</span>
                    </label>
                    <button
                      type="button"
                      className="combo-inspect-step-remove"
                      aria-label={`Remove ${seg.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeStep(seg.stepId)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <label className="combo-inspect-gap">
                    <span className="visually-hidden">
                      Gap after {seg.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.05}
                      value={seg.gapAfter || 0}
                      title="Idle gap after this action (seconds)"
                      style={
                        gapWidth > 0
                          ? { width: Math.max(gapWidth, 48) }
                          : undefined
                      }
                      onChange={(e) =>
                        setGapAfter(seg.stepId, Number(e.target.value) || 0)
                      }
                    />
                  </label>
                </div>
              )
            })}
            <div
              className={joinClassNames(
                'combo-inspect-drop end',
                dropIndex === steps.length && 'active',
              )}
              aria-hidden
            />
          </div>
        )}
      </div>
    </section>
  )
}
