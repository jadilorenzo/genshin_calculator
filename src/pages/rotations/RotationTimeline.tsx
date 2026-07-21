import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getCharacter } from './characters'
import { readCharacterDrag } from './CharacterPalette'
import { CharacterIcon } from './CharacterIcon'
import { effectStartOffset, getDurationOptions, isCooldownOption, resolveOverlaySeconds } from './durationOptions'
import {
  castTimingOffsets,
  defaultOnFieldDuration,
  defaultSkillVariant,
  kitHoldChannelSeconds,
  parseCastOrder,
  type TimingMode,
} from './fieldTimings'
import {
  MIN_ON_FIELD,
  adjustHandoffAfter,
  adjustHandoffBefore,
  insertOnField,
  removeAndCloseGaps,
  rotationCycleLength,
  snapToNearestBoundary,
  switchGaps,
} from './timelineContinuous'
import type { TimelinePlacement } from './types'

const DEFAULT_PX_PER_SEC = 48
const MIN_PX_PER_SEC = 18
const MAX_PX_PER_SEC = 180
export const TIMELINE_SECONDS = 30

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function uid() {
  return `p-${Math.random().toString(36).slice(2, 10)}`
}

interface RotationTimelineProps {
  placements: TimelinePlacement[]
  onChange: (next: TimelinePlacement[]) => void
  selectedId: string | null
  onSelectPlacement: (id: string | null) => void
  switchBuffer: number
  timingMode: TimingMode
  humanLag: number
}

export function RotationTimeline({
  placements,
  onChange,
  selectedId,
  onSelectPlacement,
  switchBuffer,
  timingMode,
  humanLag,
}: RotationTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const placementsRef = useRef(placements)
  const switchBufferRef = useRef(switchBuffer)
  const timingModeRef = useRef(timingMode)
  const humanLagRef = useRef(humanLag)
  const pxPerSecRef = useRef(DEFAULT_PX_PER_SEC)
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC)
  const [dragOver, setDragOver] = useState(false)
  const dragRef = useRef<{
    id: string
    mode: 'resize-right' | 'resize-left'
    originX: number
    originStart: number
    originDuration: number
  } | null>(null)

  useEffect(() => {
    placementsRef.current = placements
  }, [placements])

  useEffect(() => {
    switchBufferRef.current = switchBuffer
  }, [switchBuffer])

  useEffect(() => {
    timingModeRef.current = timingMode
  }, [timingMode])

  useEffect(() => {
    humanLagRef.current = humanLag
  }, [humanLag])

  useEffect(() => {
    pxPerSecRef.current = pxPerSec
  }, [pxPerSec])

  // Vertical wheel → zoom; horizontal wheel → native pan
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Trackpad horizontal swipe, or shift+wheel → pan
      if (e.shiftKey || absX > absY) {
        if (e.shiftKey && absY > 0 && absX === 0) {
          // shift+vertical wheel → horizontal pan
          e.preventDefault()
          el.scrollLeft += e.deltaY
        }
        // otherwise let the browser handle deltaX natively
        return
      }

      if (absY === 0) return

      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const prev = pxPerSecRef.current
      const next = clamp(prev * factor, MIN_PX_PER_SEC, MAX_PX_PER_SEC)
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
  }, [])

  const coverageEnd = useMemo(
    () => rotationCycleLength(placements, switchBuffer),
    [placements, switchBuffer],
  )

  /** Full party — show one faded repeat so uptime can be read across the loop. */
  const showLoop = placements.length >= 4 && coverageEnd > 0
  const cycleLength = coverageEnd
  const displayEnd = showLoop
    ? cycleLength * 2
    : Math.max(TIMELINE_SECONDS, coverageEnd + 1)

  const gaps = useMemo(
    () => switchGaps(placements, switchBuffer),
    [placements, switchBuffer],
  )

  const width = displayEnd * pxPerSec
  const majorEvery = pxPerSec >= 70 ? 1 : pxPerSec >= 36 ? 2 : 5
  const ticks = useMemo(() => {
    const step = pxPerSec >= 90 ? 0.5 : 1
    const count = Math.floor(displayEnd / step) + 1
    return Array.from({ length: count }, (_, i) => i * step)
  }, [pxPerSec, displayEnd])

  const durationRows = useMemo(() => {
    const rows: {
      placementId: string
      optionId: string
      label: string
      start: number
      seconds: number
      element: string
      lane: number
      loop: boolean
      cooldown: boolean
    }[] = []

    let lane = 0
    for (const p of placements) {
      const char = getCharacter(p.characterId)
      if (!char) continue
      const kitHold = kitHoldChannelSeconds(char.kit.elementalSkill)
      const timing = castTimingOffsets(p.characterId, {
        skill: p.castSkill ?? true,
        burst: p.castBurst ?? true,
        castOrder: parseCastOrder(p.castOrder),
        mode: timingMode,
        humanLag,
        skillVariant: p.skillVariant,
        kitHoldSeconds: kitHold,
      })
      const options = getDurationOptions(char)
      for (const optionId of p.activeDurations) {
        const opt = options.find((o) => o.id === optionId)
        if (!opt) continue
        const offset = effectStartOffset(opt, timing)
        const start = p.start + offset
        const cooldown = isCooldownOption(opt)
        const seconds = resolveOverlaySeconds(opt, p.durationOverrides)
        rows.push({
          placementId: p.id,
          optionId: opt.id,
          label: `${char.name} · ${opt.label}`,
          start,
          seconds,
          element: char.element,
          lane,
          loop: false,
          cooldown,
        })
        if (showLoop) {
          rows.push({
            placementId: p.id,
            optionId: opt.id,
            label: `${char.name} · ${opt.label}`,
            start: start + cycleLength,
            seconds,
            element: char.element,
            lane,
            loop: true,
            cooldown,
          })
        }
        lane += 1
      }
    }
    return rows
  }, [placements, showLoop, cycleLength, timingMode, humanLag])

  const durationLaneCount = useMemo(() => {
    const lanes = new Set(durationRows.map((r) => r.lane))
    return lanes.size
  }, [durationRows])
  const timeFromClientX = useCallback((clientX: number) => {
    const scroll = scrollRef.current
    const track = trackRef.current
    if (!scroll || !track) return 0
    const rect = track.getBoundingClientRect()
    const x = clientX - rect.left + scroll.scrollLeft
    return clamp(x / pxPerSecRef.current, 0, TIMELINE_SECONDS)
  }, [])

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const characterId = readCharacterDrag(e)
    if (!characterId || !getCharacter(characterId)) return

    const raw = timeFromClientX(e.clientX)
    const at = snapToNearestBoundary(raw, placementsRef.current, switchBufferRef.current)
    const castSkill = true
    const castBurst = true
    const kitHold = kitHoldChannelSeconds(
      getCharacter(characterId)?.kit.elementalSkill ?? null,
    )
    const skillVariant = defaultSkillVariant(characterId, kitHold)
    const next: TimelinePlacement = {
      id: uid(),
      characterId,
      start: at,
      duration: defaultOnFieldDuration(characterId, {
        skill: castSkill,
        burst: castBurst,
        mode: timingModeRef.current,
        humanLag: humanLagRef.current,
        skillVariant,
        kitHoldSeconds: kitHold,
      }),
      castSkill,
      castBurst,
      castOrder: 'skill-first',
      skillVariant,
      activeDurations: [],
      durationOverrides: {},
    }
    const updated = insertOnField(
      placementsRef.current,
      next,
      at,
      switchBufferRef.current,
    )
    onChange(updated)
    onSelectPlacement(next.id)
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.originX) / pxPerSecRef.current

    if (drag.mode === 'resize-right') {
      onChange(
        adjustHandoffAfter(
          placementsRef.current,
          drag.id,
          drag.originDuration + dx,
          switchBufferRef.current,
        ),
      )
      return
    }

    onChange(
      adjustHandoffBefore(
        placementsRef.current,
        drag.id,
        drag.originStart + dx,
        switchBufferRef.current,
      ),
    )
  }

  function onPointerUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function beginResize(
    e: ReactPointerEvent,
    id: string,
    mode: 'resize-right' | 'resize-left',
  ) {
    e.preventDefault()
    e.stopPropagation()
    const placement = placementsRef.current.find((p) => p.id === id)
    if (!placement) return
    onSelectPlacement(id)
    dragRef.current = {
      id,
      mode,
      originX: e.clientX,
      originStart: placement.start,
      originDuration: placement.duration,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function removeSelected() {
    if (!selectedId) return
    onChange(removeAndCloseGaps(placements, selectedId, switchBuffer))
    onSelectPlacement(null)
  }

  function fitToFirstRotation() {
    const el = scrollRef.current
    const span = coverageEnd > 0 ? coverageEnd : TIMELINE_SECONDS
    const viewW = el?.clientWidth ?? 720
    const next = clamp(viewW / Math.max(span, 0.25), MIN_PX_PER_SEC, MAX_PX_PER_SEC)
    pxPerSecRef.current = next
    setPxPerSec(next)
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = 0
    })
  }

  const blockRowHeight = 5.75
  const laneHeight = blockRowHeight + 5.25
  const rowHeight = 1.55
  const durationsHeight = Math.max(durationLaneCount * rowHeight, 0)
  const trackMinHeight =
    3.5 + laneHeight + (durationLaneCount ? 0.85 + durationsHeight : 1.5)

  const sorted = useMemo(
    () => [...placements].sort((a, b) => a.start - b.start),
    [placements],
  )

  function renderBlock(p: TimelinePlacement, loop: boolean) {
    const char = getCharacter(p.characterId)
    if (!char) return null
    const start = loop ? p.start + cycleLength : p.start
    const width = Math.max(p.duration * pxPerSec, MIN_ON_FIELD * pxPerSec)
    return (
      <div
        key={loop ? `${p.id}-loop` : p.id}
        className={loop ? 'rotation-block-shell loop' : 'rotation-block-shell'}
        style={{
          left: start * pxPerSec,
          width,
          top: '50%',
          transform: 'translateY(-50%)',
          height: `${blockRowHeight}rem`,
        }}
      >
        <span className="rotation-block-name">{char.name}</span>
        <div
          className={
            loop
              ? 'rotation-block loop'
              : selectedId === p.id
                ? 'rotation-block selected'
                : 'rotation-block'
          }
          data-element={char.element}
          aria-hidden={loop || undefined}
          aria-label={loop ? undefined : `${char.name}, ${p.duration.toFixed(2)}s`}
          onClick={
            loop
              ? undefined
              : (e) => {
                  e.stopPropagation()
                  onSelectPlacement(p.id)
                }
          }
        >
          {!loop ? (
            <button
              type="button"
              className="rotation-block-resize left"
              aria-label={`Adjust start for ${char.name}`}
              onPointerDown={(e) => beginResize(e, p.id, 'resize-left')}
            />
          ) : null}
          <div className="rotation-block-body">
            {char.icon || char.iconFile ? (
              <CharacterIcon character={char} className="rotation-block-icon" />
            ) : (
              <span className="rotation-block-icon fallback" aria-hidden>
                {char.name.slice(0, 1)}
              </span>
            )}
            <span className="rotation-block-copy">
              <span className="rotation-block-label">{char.name}</span>
              <span className="rotation-block-time">{p.duration.toFixed(2)}s</span>
            </span>
          </div>
          {!loop ? (
            <button
              type="button"
              className="rotation-block-resize right"
              aria-label={`Adjust end for ${char.name}`}
              onPointerDown={(e) => beginResize(e, p.id, 'resize-right')}
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <section className="rotation-timeline" aria-label="Rotation timeline">
      <div className="rotation-timeline-head">
        <h2 className="rotation-section-title">Timeline</h2>
        <div className="rotation-timeline-actions">
          <button
            type="button"
            className="chip compact"
            onClick={() => {
              const next = clamp(pxPerSec / 1.2, MIN_PX_PER_SEC, MAX_PX_PER_SEC)
              pxPerSecRef.current = next
              setPxPerSec(next)
            }}
          >
            −
          </button>
          <button
            type="button"
            className="chip compact"
            title="Fit zoom to first rotation (0 → end)"
            onClick={fitToFirstRotation}
          >
            1
          </button>
          <button
            type="button"
            className="chip compact"
            onClick={() => {
              const next = clamp(pxPerSec * 1.2, MIN_PX_PER_SEC, MAX_PX_PER_SEC)
              pxPerSecRef.current = next
              setPxPerSec(next)
            }}
          >
            +
          </button>
          <button
            type="button"
            className="chip compact"
            disabled={!selectedId}
            onClick={removeSelected}
          >
            Remove
          </button>
          <button
            type="button"
            className="chip compact"
            disabled={placements.length === 0}
            onClick={() => {
              onChange([])
              onSelectPlacement(null)
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rotation-timeline-scroll" ref={scrollRef}>
        <div
          className={dragOver ? 'rotation-track drag-over' : 'rotation-track'}
          ref={trackRef}
          style={{
            width: `max(100%, ${width}px)`,
            minHeight: `${trackMinHeight}rem`,
            backgroundSize: `${pxPerSec}px 100%`,
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => onSelectPlacement(null)}
        >
          <div className="rotation-ticks" aria-hidden>
            {ticks.map((t) => {
              const major = t % majorEvery === 0
              return (
                <div
                  key={t}
                  className={major ? 'rotation-tick major' : 'rotation-tick'}
                  style={{ left: t * pxPerSec }}
                >
                  {major ? <span>{t}s</span> : null}
                </div>
              )
            })}
          </div>

          <div className="rotation-lane" style={{ height: `${laneHeight}rem` }}>
            {placements.length === 0 && (
              <p className="rotation-drop-hint">Drop characters here</p>
            )}
            {sorted.map((p) => renderBlock(p, false))}
            {showLoop ? sorted.map((p) => renderBlock(p, true)) : null}
            {gaps.map((gap) => (
              <div
                key={`gap-${gap.afterId}`}
                className="rotation-switch-gap"
                title={`Switch ${gap.duration.toFixed(2)}s`}
                style={{
                  left: gap.start * pxPerSec,
                  width: Math.max(gap.duration * pxPerSec, 2),
                }}
              >
                <span>sw</span>
              </div>
            ))}
            {showLoop
              ? gaps.map((gap) => (
                  <div
                    key={`gap-loop-${gap.afterId}`}
                    className="rotation-switch-gap loop"
                    title={`Switch ${gap.duration.toFixed(2)}s`}
                    style={{
                      left: (gap.start + cycleLength) * pxPerSec,
                      width: Math.max(gap.duration * pxPerSec, 2),
                    }}
                  >
                    <span>sw</span>
                  </div>
                ))
              : null}
            {showLoop && switchBuffer > 0 ? (
              <div
                key="gap-loop-return"
                className="rotation-switch-gap loop"
                title={`Switch ${switchBuffer.toFixed(2)}s`}
                style={{
                  left: (cycleLength - switchBuffer) * pxPerSec,
                  width: Math.max(switchBuffer * pxPerSec, 2),
                }}
              >
                <span>sw</span>
              </div>
            ) : null}
            {showLoop ? (
              <div
                className="rotation-loop-marker"
                style={{ left: cycleLength * pxPerSec }}
                title={`Loop · ${cycleLength.toFixed(2)}s`}
              >
                <span>loop</span>
              </div>
            ) : null}
          </div>

          {durationLaneCount > 0 ? (
            <div
              className="rotation-duration-lanes"
              style={{ height: `${durationsHeight}rem` }}
              aria-label="Active durations"
            >
              {durationRows.map((row) => (
                <div
                  key={`${row.placementId}-${row.optionId}-${row.loop ? 'loop' : 'main'}`}
                  className={[
                    'rotation-duration-line',
                    row.loop ? 'loop' : '',
                    row.cooldown ? 'cooldown' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-element={row.cooldown ? undefined : row.element}
                  title={row.label}
                  style={{
                    top: `${row.lane * rowHeight + 0.15}rem`,
                    left: row.start * pxPerSec,
                    width: Math.max(row.seconds * pxPerSec, 12),
                  }}
                >
                  <span>{row.label}</span>
                  <span className="rotation-duration-secs">{row.seconds}s</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rotation-duration-empty">
              {placements.length >= 4
                ? 'Toggle durations below to preview uptime across the loop'
                : 'Select duration overlays on characters below'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
