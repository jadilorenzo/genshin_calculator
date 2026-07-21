import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react'
import { getCharacter } from './characters'
import {
  NORMALS_ACTION_ID,
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
const MIN_GAP_HANDLE_PX = 10

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
  const gapDragRef = useRef<{
    stepId: string
    originX: number
    originGap: number
    scale: number
  } | null>(null)
  const setGapAfterRef = useRef<(id: string, gap: number) => void>(() => {})

  const steps = placement.comboSteps ?? []
  const packed = useMemo(
    () => packComboSteps(placement.characterId, steps),
    [placement.characterId, steps],
  )

  const paletteActions = useMemo(
    () => listPaletteActions(placement.characterId, paletteStateId),
    [placement.characterId, paletteStateId],
  )
  const normalsActions = paletteActions.filter(
    (a) => a.id === NORMALS_ACTION_ID,
  )
  const abilityActions = paletteActions.filter(
    (a) => a.id !== NORMALS_ACTION_ID,
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
    const rounded =
      gapAfter > 0.02 ? Math.min(10, Math.round(gapAfter * 100) / 100) : 0
    updateSteps(
      steps.map((s) =>
        s.id === id
          ? {
              ...s,
              gapAfter: rounded > 0 ? rounded : undefined,
            }
          : s,
      ),
    )
  }
  setGapAfterRef.current = setGapAfter

  const setStepDuration = (id: string, seconds: number | null) => {
    updateSteps(
      steps.map((s) => {
        if (s.id !== id) return s
        if (seconds == null || !(seconds > 0)) {
          if (s.actionId === NORMALS_ACTION_ID) {
            return { ...s, durationSeconds: undefined }
          }
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = gapDragRef.current
      if (!drag) return
      const dx = e.clientX - drag.originX
      const nextGap = Math.max(0, drag.originGap + dx / drag.scale)
      setGapAfterRef.current(drag.stepId, nextGap)
    }
    const onUp = () => {
      gapDragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const clearSteps = () => updateSteps([])

  const seedFromCasts = () => {
    const kitHold = kitHoldChannelSeconds(
      character?.kit.elementalSkill ?? null,
    )
    const seeded = seedComboStepsFromCasts(placement.characterId, {
      skill: placement.castSkill,
      burst: placement.castBurst,
      castOrder: placement.castOrder,
      skillVariant: placement.skillVariant,
      skillCasts: placement.skillCasts,
      kitHoldSeconds: kitHold,
    })
    updateSteps(seeded)
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

  const indexFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track || packed.segments.length === 0) return steps.length
    const wraps = track.querySelectorAll<HTMLElement>('[data-step-index]')
    for (const el of wraps) {
      const rect = el.getBoundingClientRect()
      const mid = rect.left + rect.width / 2
      const index = Number(el.dataset.stepIndex)
      if (clientX < mid) return index
    }
    return steps.length
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

  const beginGapDrag = (
    e: ReactPointerEvent,
    stepId: string,
    originGap: number,
    scale: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    gapDragRef.current = {
      stepId,
      originX: e.clientX,
      originGap,
      scale,
    }
  }

  if (!character) return null

  const scale =
    packed.totalSeconds > 0
      ? Math.max(
          DEFAULT_PX_PER_SEC,
          Math.min(120, 480 / Math.max(packed.totalSeconds, 1)),
        )
      : DEFAULT_PX_PER_SEC

  const renderPaletteChip = (
    action: (typeof paletteActions)[number],
    opts?: { emphasize?: boolean },
  ) => {
    const family = comboActionFamily(action.kind || action.id)
    const secs =
      action.seconds ??
      (action.frames != null ? action.frames / 60 : null)
    return (
      <button
        key={`${paletteStateId}-${action.id}`}
        type="button"
        className={joinClassNames(
          'combo-inspect-chip',
          `kind-${family}`,
          opts?.emphasize && 'emphasize',
        )}
        draggable
        onDragStart={(e) => onPaletteDragStart(e, action.id)}
        onDragEnd={() => {
          dragKindRef.current = null
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
          action.id === NORMALS_ACTION_ID
            ? 'General normal-attack filler — edit duration in the sequence'
            : secs != null
              ? `${action.label} · ${secs.toFixed(2)}s — click or drag`
              : `${action.label} · untimed — click or drag`
        }
      >
        <span>{action.label}</span>
        <span className="combo-inspect-chip-secs">
          {action.id === NORMALS_ACTION_ID
            ? 'edit'
            : secs != null
              ? `${secs.toFixed(2)}s`
              : '—'}
        </span>
      </button>
    )
  }

  return (
    <section
      className="combo-inspect"
      aria-label={`${character.name} combo inspect`}
    >
      <div className="combo-inspect-head">
        <div className="combo-inspect-titles">
          <h2 className="rotation-section-title">Inspect · {character.name}</h2>
          <p className="field-note">
            Drag actions into the sequence. Drag the gap handles between steps
            to space them. Normals are a filler block — edit their duration.
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

      <div className="combo-inspect-palette-stack">
        <div
          className="combo-inspect-palette-section"
          aria-label="Normals filler"
        >
          <span className="combo-inspect-palette-label">Normals</span>
          <div className="combo-inspect-palette">
            {normalsActions.map((action) =>
              renderPaletteChip(action, { emphasize: true }),
            )}
          </div>
        </div>
        <div
          className="combo-inspect-palette-section"
          aria-label="Abilities"
        >
          <span className="combo-inspect-palette-label">Abilities</span>
          <div className="combo-inspect-palette">
            {abilityActions.length === 0 ? (
              <p className="field-note">No timed abilities for this state yet.</p>
            ) : (
              abilityActions.map((action) => renderPaletteChip(action))
            )}
          </div>
        </div>
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
              const gapPx = Math.max(
                MIN_GAP_HANDLE_PX,
                (seg.gapAfter || 0) * scale,
              )
              const family = comboActionFamily(seg.kind)
              const showInsertBefore = dropIndex === index
              const isNormals = seg.actionId === NORMALS_ACTION_ID
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
                      isNormals && 'normals',
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
                        (seg.durationOverridden || isNormals) && 'overridden',
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
                          isNormals
                            ? 'Normals filler duration (seconds)'
                            : seg.durationOverridden
                              ? 'Custom duration — double-click to reset'
                              : 'Action duration (seconds)'
                        }
                        onChange={(e) => {
                          const raw = Number(e.target.value)
                          if (!Number.isFinite(raw)) return
                          setStepDuration(seg.stepId, Math.max(0.05, raw))
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (!isNormals) setStepDuration(seg.stepId, null)
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
                  <button
                    type="button"
                    className={joinClassNames(
                      'combo-inspect-gap-handle',
                      (seg.gapAfter || 0) > 0.02 && 'active',
                    )}
                    style={{ width: gapPx }}
                    title={
                      (seg.gapAfter || 0) > 0.02
                        ? `Gap ${seg.gapAfter.toFixed(2)}s — drag to resize`
                        : 'Drag to add idle gap'
                    }
                    aria-label={`Idle gap after ${seg.label}`}
                    onPointerDown={(e) =>
                      beginGapDrag(e, seg.stepId, seg.gapAfter || 0, scale)
                    }
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setGapAfter(seg.stepId, 0)
                    }}
                  >
                    {(seg.gapAfter || 0) > 0.15 ? (
                      <span className="combo-inspect-gap-label">
                        {seg.gapAfter.toFixed(2)}s
                      </span>
                    ) : null}
                  </button>
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
