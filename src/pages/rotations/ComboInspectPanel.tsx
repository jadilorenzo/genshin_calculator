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
import { DeferredNumberInput } from './DeferredNumberInput'
import {
  NORMALS_ACTION_ID,
  comboActionFamily,
  createComboStep,
  isActionUnlockedByPriorSteps,
  isAttackStringAction,
  listPaletteEntries,
  prerequisiteShortLabel,
  shortActionLabel,
  packComboSteps,
  seedComboStepsFromCasts,
  type PaletteActionEntry,
} from './comboSequence'
import {
  getCharacterAnimationTimings,
} from './animationTimings'
import { kitHoldChannelSeconds } from './fieldTimings'
import {
  hasNightsoulResource,
  nightsoulFillGradient,
  nightsoulSummaryLabel,
  sampleNightsoulForPlacement,
} from './nightsoulSim'
import { setOnFieldDuration } from './timelineContinuous'
import type { ComboStep, TimelinePlacement } from './types'

/** Use text/plain so every browser can read the payload on drop. */
const DRAG_PREFIX = 'fmr-combo:'

const DEFAULT_PX_PER_SEC = 56
const MIN_PX_PER_SEC = 24
const MAX_PX_PER_SEC = 160
const MIN_BLOCK_PX = 28
const MIN_GAP_HANDLE_PX = 10

const clampZoom = (n: number) =>
  Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, n))

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
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const laneRef = useRef<HTMLDivElement | null>(null)
  const pxPerSecRef = useRef(pxPerSec)
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

  const showNightsoulFill = placement.showNightsoulFill === true
  const nightsoulCapable = hasNightsoulResource(placement.characterId)
  const nightsoulSamples = useMemo(() => {
    if (!nightsoulCapable || !showNightsoulFill) return null
    return sampleNightsoulForPlacement(placement, 0.15)
  }, [nightsoulCapable, showNightsoulFill, placement])

  const nightsoulSpan = useMemo(() => {
    if (!nightsoulSamples?.length) return 0
    return Math.max(
      nightsoulSamples[nightsoulSamples.length - 1]?.time ?? 0,
      packed.totalSeconds,
      0.5,
    )
  }, [nightsoulSamples, packed.totalSeconds])

  const nightsoulGradient = useMemo(() => {
    if (!nightsoulSamples?.length || nightsoulSpan <= 0) return null
    return nightsoulFillGradient(
      nightsoulSamples,
      nightsoulSpan,
      character?.element,
    )
  }, [nightsoulSamples, nightsoulSpan, character?.element])

  const nightsoulSummary = nightsoulSamples?.length
    ? nightsoulSummaryLabel(nightsoulSamples)
    : null

  const paletteEntries = useMemo(
    () =>
      listPaletteEntries(placement.characterId, paletteStateId, steps),
    [placement.characterId, paletteStateId, steps],
  )
  const normalsEntries = paletteEntries.filter(
    (e) => e.action.id === NORMALS_ACTION_ID,
  )
  const attackStringEntries = paletteEntries.filter((e) =>
    isAttackStringAction(e.action),
  )
  const abilityEntries = paletteEntries.filter(
    (e) =>
      e.action.id !== NORMALS_ACTION_ID && !isAttackStringAction(e.action),
  )

  const attackFoldLabel = (() => {
    const nas = attackStringEntries.filter((e) =>
      /^na_?\d/i.test(e.action.id),
    )
    const specials = attackStringEntries.filter(
      (e) => !/^na_?\d/i.test(e.action.id),
    )
    const naMax = nas.reduce((max, e) => {
      const m = e.action.id.match(/^na_?(\d+)/i)
      return m ? Math.max(max, Number(m[1])) : max
    }, 0)
    const naPart = naMax > 0 ? `N1–N${naMax}` : 'Normals'
    if (specials.length === 0) return naPart
    return `${naPart} · special CA`
  })()

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
    if (!isActionUnlockedByPriorSteps(placement.characterId, actionId, steps)) {
      return
    }
    updateSteps([...steps, createComboStep(actionId, stateId)])
  }

  const insertActionAt = (
    index: number,
    actionId: string,
    stateId = paletteStateId,
  ) => {
    const at = Math.max(0, Math.min(index, steps.length))
    const prior = steps.slice(0, at)
    if (!isActionUnlockedByPriorSteps(placement.characterId, actionId, prior)) {
      return
    }
    const next = [...steps]
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

  const setStepCancelMode = (id: string, mode: 'auto' | 'full') => {
    updateSteps(
      steps.map((s) => {
        if (s.id !== id) return s
        if (mode === 'auto') {
          const { cancelMode: _drop, ...rest } = s
          return rest
        }
        return { ...s, cancelMode: 'full' }
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

  const fitDurationToActions = () => {
    if (packed.totalSeconds <= 0) return
    onChange((prev) =>
      setOnFieldDuration(
        prev,
        placement.id,
        Math.max(0.5, packed.totalSeconds),
        switchBuffer,
      ),
    )
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

  useEffect(() => {
    pxPerSecRef.current = pxPerSec
  }, [pxPerSec])

  useEffect(() => {
    const el = laneRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      if (e.shiftKey || absX > absY) {
        if (e.shiftKey && absY > 0 && absX === 0) {
          e.preventDefault()
          el.scrollLeft += e.deltaY
        }
        return
      }

      if (absY === 0) return

      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05
      const prev = pxPerSecRef.current
      const next = clampZoom(prev * factor)
      if (next === prev) return

      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const timeUnderMouse = (el.scrollLeft + mouseX) / prev

      pxPerSecRef.current = next
      setPxPerSec(next)
      requestAnimationFrame(() => {
        el.scrollLeft = timeUnderMouse * next - mouseX
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [placement.characterId, placement.id])

  if (!character) return null

  const scale = pxPerSec

  const trackWidthPx = packed.segments.reduce((sum, seg) => {
    const width = Math.max(seg.duration * scale, MIN_BLOCK_PX)
    const gapPx = Math.max(MIN_GAP_HANDLE_PX, (seg.gapAfter || 0) * scale)
    return sum + width + gapPx
  }, 0)

  const setZoom = (next: number) => {
    const zoom = clampZoom(next)
    pxPerSecRef.current = zoom
    setPxPerSec(zoom)
  }

  const zoomOut = () => setZoom(pxPerSec / 1.2)
  const zoomIn = () => setZoom(pxPerSec * 1.2)
  const fitZoom = () => {
    const lane = laneRef.current
    const viewW = lane?.clientWidth ?? 480
    const span = Math.max(packed.totalSeconds, 0.25)
    setZoom(viewW / span)
  }

  const renderPaletteChip = (
    entry: PaletteActionEntry,
    opts?: { emphasize?: boolean },
  ) => {
    const action = entry.action
    const family = comboActionFamily(action.kind || action.id)
    const secs =
      action.seconds ??
      (action.frames != null ? action.frames / 60 : null)
    const requiresLabel =
      entry.locked && entry.requiresAny?.length
        ? entry.requiresAny
            .map((id) =>
              prerequisiteShortLabel(
                placement.characterId,
                id,
                paletteStateId,
              ),
            )
            .join(' / ')
        : null
    const unlocksLabel =
      !entry.locked && entry.unlocks.length
        ? entry.unlocks
            .map((a) => shortActionLabel(a.label, a.kind || a.id))
            .join(', ')
        : null
    const title = entry.locked
      ? `${action.label} — requires ${requiresLabel ?? 'a prior action'} in the sequence first`
      : action.id === NORMALS_ACTION_ID
        ? 'General normal-attack filler — edit duration in the sequence'
        : [
            secs != null
              ? `${action.label} · ${secs.toFixed(2)}s — click or drag`
              : `${action.label} · untimed — click or drag`,
            unlocksLabel ? `Unlocks ${unlocksLabel}` : null,
          ]
            .filter(Boolean)
            .join(' · ')

    return (
      <button
        key={`${paletteStateId}-${action.id}`}
        type="button"
        className={joinClassNames(
          'combo-inspect-chip',
          `kind-${family}`,
          opts?.emphasize && 'emphasize',
          entry.locked && 'locked',
          unlocksLabel && 'gates',
        )}
        disabled={entry.locked}
        draggable={!entry.locked}
        aria-disabled={entry.locked}
        onDragStart={
          entry.locked
            ? undefined
            : (e) => onPaletteDragStart(e, action.id)
        }
        onDragEnd={
          entry.locked
            ? undefined
            : () => {
                dragKindRef.current = null
                window.setTimeout(() => {
                  dragMovedRef.current = false
                }, 0)
              }
        }
        onClick={() => {
          if (entry.locked) return
          if (dragMovedRef.current) {
            dragMovedRef.current = false
            return
          }
          appendAction(action.id)
        }}
        title={title}
      >
        <span className="drag-affordance compact" aria-hidden>
          {entry.locked ? '·' : '⠿'}
        </span>
        <span>{action.label}</span>
        {requiresLabel ? (
          <span className="combo-inspect-chip-gate">Needs {requiresLabel}</span>
        ) : null}
        {unlocksLabel ? (
          <span className="combo-inspect-chip-unlocks">→ {unlocksLabel}</span>
        ) : null}
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
        </div>
        <div className="combo-inspect-head-right">
          <ul className="combo-inspect-key" aria-label="Palette key">
            <li>
              <span
                className="combo-inspect-chip emphasize kind-na combo-inspect-key-swatch"
                aria-hidden
              >
                Normals
              </span>
              <span>filler</span>
            </li>
            <li>
              <span className="combo-inspect-key-fold" aria-hidden>
                N1–N5 / CA
              </span>
              <span>exact hits</span>
            </li>
            <li>
              <span
                className="combo-inspect-chip gates kind-skill combo-inspect-key-swatch"
                aria-hidden
              >
                Skill
                <span className="combo-inspect-chip-unlocks">→</span>
              </span>
              <span className="combo-inspect-key-gates-label">
                unlocks follow-ups
              </span>
            </li>
            <li>
              <span
                className="combo-inspect-chip locked kind-ca combo-inspect-key-swatch"
                aria-hidden
              >
                Locked
              </span>
              <span>needs prereq</span>
            </li>
          </ul>
          <div className="combo-inspect-meta">
            <span className="combo-inspect-total">
              {packed.totalSeconds > 0
                ? `${packed.totalSeconds.toFixed(2)}s packed`
                : 'Empty sequence'}
            </span>
          {nightsoulCapable ? (
            <label
              className="chip compact rotation-aura-toggle"
              title="Approximate Nightsoul fill (same toggle as timeline effects)"
            >
              <input
                type="checkbox"
                checked={showNightsoulFill}
                onChange={(e) => {
                  const next = e.target.checked
                  onChange((prev) =>
                    prev.map((p) =>
                      p.id === placement.id
                        ? { ...p, showNightsoulFill: next }
                        : p,
                    ),
                  )
                }}
              />
              <span>Nightsoul</span>
            </label>
          ) : null}
          <button
            type="button"
            className="chip compact"
            onClick={zoomOut}
            title="Zoom out"
            aria-label="Zoom out combo sequence"
          >
            −
          </button>
          <button
            type="button"
            className="chip compact"
            onClick={fitZoom}
            title="Fit combo sequence to view"
            aria-label="Fit combo sequence zoom"
            disabled={packed.totalSeconds <= 0}
          >
            1
          </button>
          <button
            type="button"
            className="chip compact"
            onClick={zoomIn}
            title="Zoom in"
            aria-label="Zoom in combo sequence"
          >
            +
          </button>
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
            disabled={
              packed.totalSeconds <= 0 ||
              Math.abs(placement.duration - packed.totalSeconds) < 0.005
            }
            onClick={fitDurationToActions}
            title={
              packed.totalSeconds > 0
                ? `Resize on-field to ${packed.totalSeconds.toFixed(2)}s`
                : 'Add actions first'
            }
          >
            Fit to actions
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
            {normalsEntries.map((entry) =>
              renderPaletteChip(entry, { emphasize: true }),
            )}
          </div>
          {attackStringEntries.length > 0 ? (
            <details className="combo-inspect-attack-fold">
              <summary>
                <span>{attackFoldLabel}</span>
                <span className="combo-inspect-attack-fold-count">
                  {attackStringEntries.length}
                </span>
              </summary>
              <div
                className="combo-inspect-palette"
                aria-label="Individual normals and special charged attacks"
              >
                {attackStringEntries.map((entry) => renderPaletteChip(entry))}
              </div>
            </details>
          ) : null}
        </div>
        <div
          className="combo-inspect-palette-section"
          aria-label="Abilities"
        >
          <span className="combo-inspect-palette-label">Abilities</span>
          <div className="combo-inspect-palette">
            {abilityEntries.length === 0 ? (
              <p className="field-note">No timed abilities for this state yet.</p>
            ) : (
              abilityEntries.map((entry) => renderPaletteChip(entry))
            )}
          </div>
        </div>
      </div>

      <div
        className="combo-inspect-lane"
        ref={laneRef}
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
          <div
            className="combo-inspect-sequence"
            style={{ minWidth: Math.max(trackWidthPx, 1) }}
          >
            {nightsoulGradient ? (
              <div
                className="combo-inspect-nightsoul"
                data-element={character?.element}
                style={{ backgroundImage: nightsoulGradient }}
                title={
                  nightsoulSummary
                    ? `Nightsoul (approx) · ${nightsoulSummary}`
                    : 'Nightsoul fill (approximate)'
                }
                aria-label={
                  nightsoulSummary
                    ? `Nightsoul approximate fill, ${nightsoulSummary}`
                    : 'Nightsoul approximate fill'
                }
              >
                <span className="combo-inspect-nightsoul-label">
                  NS{nightsoulSummary ? ` · ${nightsoulSummary}` : ''}
                </span>
              </div>
            ) : null}
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
                      seg.durationOverridden
                        ? ' (custom)'
                        : seg.cancelledInto
                          ? ` (cancel → ${seg.cancelledInto})`
                          : seg.cancelMode === 'full'
                            ? ' (full anim)'
                            : ''
                    } — drag to reorder`}
                  >
                    <span className="combo-inspect-step-label">
                      {shortActionLabel(seg.label, seg.actionId)}
                    </span>
                    {seg.cancelledInto && !seg.durationOverridden ? (
                      <span
                        className="combo-inspect-step-cancel"
                        title={`Cancelled into next (${seg.cancelledInto})${
                          seg.fullDuration != null
                            ? ` · full ${seg.fullDuration.toFixed(2)}s`
                            : ''
                        }`}
                      >
                        ✂
                      </span>
                    ) : null}
                    {!isNormals &&
                    !seg.durationOverridden &&
                    seg.canCancel ? (
                      <button
                        type="button"
                        className={joinClassNames(
                          'combo-inspect-step-cancel-toggle',
                          seg.cancelMode === 'full' && 'full',
                        )}
                        title={
                          seg.cancelMode === 'full'
                            ? 'Using full animation — click to cancel into next'
                            : 'Using cancel into next — click for full animation'
                        }
                        aria-label={
                          seg.cancelMode === 'full'
                            ? `Use cancel into next for ${seg.label}`
                            : `Use full animation for ${seg.label}`
                        }
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setStepCancelMode(
                            seg.stepId,
                            seg.cancelMode === 'full' ? 'auto' : 'full',
                          )
                        }}
                      >
                        {seg.cancelMode === 'full' ? 'Full' : 'Cancel'}
                      </button>
                    ) : null}
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
                      <DeferredNumberInput
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
                        onCommit={(raw) => {
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
          </div>
        )}
      </div>
    </section>
  )
}
