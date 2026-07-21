import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { getCharacter } from "./characters";
import { readCharacterDrag } from "./CharacterPalette";
import { CharacterIcon } from "./CharacterIcon";
import {
  effectStartOffset,
  getDurationOptions,
  isCooldownOption,
  resolveOverlaySeconds,
} from "./durationOptions";
import {
  castTimingOffsets,
  defaultOnFieldDuration,
  defaultSkillVariant,
  kitHoldChannelSeconds,
  parseCastOrder,
  type TimingMode,
} from "./fieldTimings";
import {
  MIN_ON_FIELD,
  adjustHandoffAfter,
  adjustHandoffBefore,
  insertIndexFromMids,
  insertOnField,
  removeAndCloseGaps,
  reorderByIds,
  reorderSlotMids,
  rotationCycleLength,
  snapToNearestBoundary,
  switchGaps,
} from "./timelineContinuous";
import type { CharacterData, TimelinePlacement } from "./types";

const DEFAULT_PX_PER_SEC = 48;
const MIN_PX_PER_SEC = 18;
const MAX_PX_PER_SEC = 180;
export const TIMELINE_SECONDS = 30;

const BLOCK_ROW_HEIGHT = 5.75;
const LANE_HEIGHT = BLOCK_ROW_HEIGHT + 5.25;
const DURATION_ROW_HEIGHT = 1.55;

const clamp = (n: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, n));
};

const createPlacementId = () => {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
};

const joinClassNames = (
  ...parts: Array<string | false | null | undefined>
) => {
  return parts.filter(Boolean).join(" ");
};

type DragState = {
  id: string;
  mode: "resize-right" | "resize-left" | "move";
  originX: number;
  originStart: number;
  originDuration: number;
  moved: boolean;
  lastIndex: number;
  orderWithout: string[];
  mids: number[];
};

type DurationRow = {
  placementId: string;
  optionId: string;
  label: string;
  start: number;
  seconds: number;
  element: string;
  lane: number;
  loop: boolean;
  cooldown: boolean;
};

type SwitchGap = {
  afterId: string;
  start: number;
  duration: number;
};

interface RotationTimelineProps {
  placements: TimelinePlacement[];
  onChange: (next: SetStateAction<TimelinePlacement[]>) => void;
  selectedId: string | null;
  onSelectPlacement: (id: string | null) => void;
  switchBuffer: number;
  timingMode: TimingMode;
  humanLag: number;
  onHistoryGestureStart?: () => void;
  onHistoryGestureEnd?: () => void;
}

const majorTickStep = (pxPerSec: number) => {
  if (pxPerSec >= 70) return 1;
  if (pxPerSec >= 36) return 2;
  return 5;
};

const tickStep = (pxPerSec: number) => {
  return pxPerSec >= 90 ? 0.5 : 1;
};

const buildTicks = (displayEnd: number, pxPerSec: number) => {
  const step = tickStep(pxPerSec);
  const count = Math.floor(displayEnd / step) + 1;
  return Array.from({ length: count }, (_, i) => i * step);
};

const buildDurationRows = (
  placements: TimelinePlacement[],
  timingMode: TimingMode,
  humanLag: number,
  showLoop: boolean,
  cycleLength: number,
): DurationRow[] => {
  const rows: DurationRow[] = [];
  let lane = 0;

  for (const placement of placements) {
    const character = getCharacter(placement.characterId);
    if (!character) continue;

    const kitHold = kitHoldChannelSeconds(character.kit.elementalSkill);
    const timing = castTimingOffsets(placement.characterId, {
      skill: placement.castSkill ?? true,
      burst: placement.castBurst ?? true,
      castOrder: parseCastOrder(placement.castOrder),
      mode: timingMode,
      humanLag,
      skillVariant: placement.skillVariant,
      kitHoldSeconds: kitHold,
    });
    const options = getDurationOptions(character);

    for (const optionId of placement.activeDurations) {
      const option = options.find((entry) => entry.id === optionId);
      if (!option) continue;

      const start = placement.start + effectStartOffset(option, timing);
      const cooldown = isCooldownOption(option);
      const seconds = resolveOverlaySeconds(
        option,
        placement.durationOverrides,
      );
      const label = `${character.name} · ${option.label}`;
      const base = {
        placementId: placement.id,
        optionId: option.id,
        label,
        seconds,
        element: character.element,
        lane,
        cooldown,
      };

      rows.push({ ...base, start, loop: false });
      if (showLoop) {
        rows.push({ ...base, start: start + cycleLength, loop: true });
      }
      lane += 1;
    }
  }

  return rows;
};

const durationEmptyMessage = (placementCount: number) => {
  if (placementCount >= 4) {
    return "Toggle durations below to preview uptime across the loop";
  }
  return "Select duration overlays on characters below";
};

export const RotationTimeline = ({
  placements,
  onChange,
  selectedId,
  onSelectPlacement,
  switchBuffer,
  timingMode,
  humanLag,
  onHistoryGestureStart,
  onHistoryGestureEnd,
}: RotationTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef(placements);
  const switchBufferRef = useRef(switchBuffer);
  const timingModeRef = useRef(timingMode);
  const humanLagRef = useRef(humanLag);
  const pxPerSecRef = useRef(DEFAULT_PX_PER_SEC);
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [dragOver, setDragOver] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef(hoveredId);

  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    switchBufferRef.current = switchBuffer;
  }, [switchBuffer]);

  useEffect(() => {
    timingModeRef.current = timingMode;
  }, [timingMode]);

  useEffect(() => {
    humanLagRef.current = humanLag;
  }, [humanLag]);

  useEffect(() => {
    pxPerSecRef.current = pxPerSec;
  }, [pxPerSec]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const id = selectedIdRef.current;
      if (!id || hoveredIdRef.current !== id) return;
      e.preventDefault();
      onChange((prev) => removeAndCloseGaps(prev, id, switchBufferRef.current));
      onSelectPlacement(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChange, onSelectPlacement]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (e.shiftKey || absX > absY) {
        if (e.shiftKey && absY > 0 && absX === 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
        return;
      }

      if (absY === 0) return;

      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const prev = pxPerSecRef.current;
      const next = clamp(prev * factor, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
      if (next === prev) return;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const timeUnderMouse = (el.scrollLeft + mouseX) / prev;

      pxPerSecRef.current = next;
      setPxPerSec(next);
      requestAnimationFrame(() => {
        el.scrollLeft = timeUnderMouse * next - mouseX;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const coverageEnd = useMemo(
    () => rotationCycleLength(placements, switchBuffer),
    [placements, switchBuffer],
  );
  const showLoop = placements.length >= 4 && coverageEnd > 0;
  const cycleLength = coverageEnd;
  const displayEnd = showLoop
    ? cycleLength * 2
    : Math.max(TIMELINE_SECONDS, coverageEnd + 1);

  const gaps = useMemo(
    () => switchGaps(placements, switchBuffer),
    [placements, switchBuffer],
  );
  const ticks = useMemo(
    () => buildTicks(displayEnd, pxPerSec),
    [displayEnd, pxPerSec],
  );
  const durationRows = useMemo(
    () =>
      buildDurationRows(
        placements,
        timingMode,
        humanLag,
        showLoop,
        cycleLength,
      ),
    [placements, timingMode, humanLag, showLoop, cycleLength],
  );
  const durationLaneCount = useMemo(() => {
    return new Set(durationRows.map((row) => row.lane)).size;
  }, [durationRows]);
  const sorted = useMemo(
    () => [...placements].sort((a, b) => a.start - b.start),
    [placements],
  );

  const width = displayEnd * pxPerSec;
  const majorEvery = majorTickStep(pxPerSec);
  const durationsHeight = Math.max(durationLaneCount * DURATION_ROW_HEIGHT, 0);
  const trackMinHeight =
    3.5 + LANE_HEIGHT + (durationLaneCount ? 0.85 + durationsHeight : 1.5);

  const timeFromClientX = useCallback((clientX: number) => {
    const scroll = scrollRef.current;
    const track = trackRef.current;
    if (!scroll || !track) return 0;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left + scroll.scrollLeft;
    return clamp(x / pxPerSecRef.current, 0, TIMELINE_SECONDS);
  }, []);

  const setZoom = (next: number) => {
    const zoom = clamp(next, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
    pxPerSecRef.current = zoom;
    setPxPerSec(zoom);
  };

  const zoomOut = () => {
    setZoom(pxPerSec / 1.2);
  };

  const zoomIn = () => {
    setZoom(pxPerSec * 1.2);
  };

  const fitToFirstRotation = () => {
    const el = scrollRef.current;
    const span = coverageEnd > 0 ? coverageEnd : TIMELINE_SECONDS;
    const viewW = el?.clientWidth ?? 720;
    setZoom(viewW / Math.max(span, 0.25));
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = 0;
    });
  };

  const clearAll = () => {
    onChange([]);
    onSelectPlacement(null);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    onChange((prev) => removeAndCloseGaps(prev, selectedId, switchBuffer));
    onSelectPlacement(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const characterId = readCharacterDrag(e);
    if (!characterId || !getCharacter(characterId)) return;

    const raw = timeFromClientX(e.clientX);
    const at = snapToNearestBoundary(
      raw,
      placementsRef.current,
      switchBufferRef.current,
    );
    const kitHold = kitHoldChannelSeconds(
      getCharacter(characterId)?.kit.elementalSkill ?? null,
    );
    const skillVariant = defaultSkillVariant(characterId, kitHold);
    const next: TimelinePlacement = {
      id: createPlacementId(),
      characterId,
      start: at,
      duration: defaultOnFieldDuration(characterId, {
        skill: true,
        burst: true,
        mode: timingModeRef.current,
        humanLag: humanLagRef.current,
        skillVariant,
        kitHoldSeconds: kitHold,
      }),
      castSkill: true,
      castBurst: true,
      castOrder: "skill-first",
      skillVariant,
      activeDurations: [],
      durationOverrides: {},
    };
    onChange((prev) => insertOnField(prev, next, at, switchBufferRef.current));
    onSelectPlacement(next.id);
  };

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.originX) / pxPerSecRef.current;

    if (drag.mode === "move") {
      if (Math.abs(e.clientX - drag.originX) > 4) drag.moved = true;
      const insertAt = insertIndexFromMids(
        drag.mids,
        timeFromClientX(e.clientX),
      );
      if (insertAt === drag.lastIndex) return;
      drag.lastIndex = insertAt;
      const ids = [...drag.orderWithout];
      ids.splice(insertAt, 0, drag.id);
      onChange((prev) => reorderByIds(prev, ids, switchBufferRef.current));
      return;
    }

    if (Math.abs(dx) > 0.02) drag.moved = true;

    if (drag.mode === "resize-right") {
      onChange((prev) =>
        adjustHandoffAfter(
          prev,
          drag.id,
          drag.originDuration + dx,
          switchBufferRef.current,
        ),
      );
      return;
    }

    onChange((prev) =>
      adjustHandoffBefore(
        prev,
        drag.id,
        drag.originStart + dx,
        switchBufferRef.current,
      ),
    );
  };

  const onPointerUp = () => {
    if (dragRef.current?.moved) suppressClickRef.current = true;
    dragRef.current = null;
    setMovingId(null);
    onHistoryGestureEnd?.();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const startPointerGesture = () => {
    onHistoryGestureStart?.();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const beginResize = (
    e: ReactPointerEvent,
    id: string,
    mode: "resize-right" | "resize-left",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const placement = placementsRef.current.find((p) => p.id === id);
    if (!placement) return;
    onSelectPlacement(id);
    dragRef.current = {
      id,
      mode,
      originX: e.clientX,
      originStart: placement.start,
      originDuration: placement.duration,
      moved: false,
      lastIndex: -1,
      orderWithout: [],
      mids: [],
    };
    startPointerGesture();
  };

  const beginMove = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const placement = placementsRef.current.find((p) => p.id === id);
    if (!placement) return;
    onSelectPlacement(id);
    const slots = reorderSlotMids(
      placementsRef.current,
      id,
      switchBufferRef.current,
    );
    const from = [...placementsRef.current]
      .sort((a, b) => a.start - b.start)
      .findIndex((p) => p.id === id);
    dragRef.current = {
      id,
      mode: "move",
      originX: e.clientX,
      originStart: placement.start,
      originDuration: placement.duration,
      moved: false,
      lastIndex: from,
      orderWithout: slots.orderWithout,
      mids: slots.mids,
    };
    setMovingId(id);
    startPointerGesture();
  };

  const selectBlock = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelectPlacement(id);
  };

  const renderBlocks = (loop: boolean) => {
    return sorted.map((placement) => (
      <TimelineBlock
        key={loop ? `${placement.id}-loop` : placement.id}
        placement={placement}
        character={getCharacter(placement.characterId)}
        loop={loop}
        cycleLength={cycleLength}
        pxPerSec={pxPerSec}
        selected={selectedId === placement.id}
        moving={movingId === placement.id}
        onSelect={selectBlock}
        onHoverEnter={(id) => setHoveredId(id)}
        onHoverLeave={(id) =>
          setHoveredId((current) => (current === id ? null : current))
        }
        onBeginResize={beginResize}
        onBeginMove={beginMove}
      />
    ));
  };

  const renderGaps = (loop: boolean) => {
    return gaps.map((gap) => (
      <SwitchGapMark
        key={loop ? `gap-loop-${gap.afterId}` : `gap-${gap.afterId}`}
        gap={gap}
        loop={loop}
        cycleLength={cycleLength}
        pxPerSec={pxPerSec}
      />
    ));
  };

  return (
    <section className="rotation-timeline" aria-label="Rotation timeline">
      <TimelineToolbar
        hasSelection={selectedId != null}
        hasPlacements={placements.length > 0}
        onZoomOut={zoomOut}
        onZoomIn={zoomIn}
        onFit={fitToFirstRotation}
        onRemove={removeSelected}
        onClear={clearAll}
      />

      <div className="rotation-timeline-scroll" ref={scrollRef}>
        <div
          className={joinClassNames("rotation-track", dragOver && "drag-over")}
          ref={trackRef}
          style={{
            width: `max(100%, ${width}px)`,
            minHeight: `${trackMinHeight}rem`,
            backgroundSize: `${pxPerSec}px 100%`,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => onSelectPlacement(null)}
        >
          <TimelineTicks
            ticks={ticks}
            majorEvery={majorEvery}
            pxPerSec={pxPerSec}
          />

          <div
            className="rotation-lane"
            style={{ height: `${LANE_HEIGHT}rem` }}
          >
            {placements.length === 0 ? (
              <p className="rotation-drop-hint">Drop characters here</p>
            ) : null}
            {renderBlocks(false)}
            {showLoop ? renderBlocks(true) : null}
            {renderGaps(false)}
            {showLoop ? renderGaps(true) : null}
            {showLoop && switchBuffer > 0 ? (
              <SwitchGapMark
                gap={{
                  afterId: "loop-return",
                  start: cycleLength - switchBuffer,
                  duration: switchBuffer,
                }}
                loop
                cycleLength={0}
                pxPerSec={pxPerSec}
              />
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

          <DurationLanes
            rows={durationRows}
            laneCount={durationLaneCount}
            height={durationsHeight}
            rowHeight={DURATION_ROW_HEIGHT}
            pxPerSec={pxPerSec}
            emptyMessage={durationEmptyMessage(placements.length)}
          />
        </div>
      </div>
    </section>
  );
};

const TimelineToolbar = ({
  hasSelection,
  hasPlacements,
  onZoomOut,
  onZoomIn,
  onFit,
  onRemove,
  onClear,
}: {
  hasSelection: boolean;
  hasPlacements: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onRemove: () => void;
  onClear: () => void;
}) => {
  return (
    <div className="rotation-timeline-head">
      <h2 className="rotation-section-title">Timeline</h2>
      <div className="rotation-timeline-actions">
        <button type="button" className="chip compact" onClick={onZoomOut}>
          −
        </button>
        <button
          type="button"
          className="chip compact"
          title="Fit zoom to first rotation (0 → end)"
          onClick={onFit}
        >
          1
        </button>
        <button type="button" className="chip compact" onClick={onZoomIn}>
          +
        </button>
        <button
          type="button"
          className="chip compact"
          disabled={!hasSelection}
          onClick={onRemove}
        >
          Remove
        </button>
        <button
          type="button"
          className="chip compact"
          disabled={!hasPlacements}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

const TimelineTicks = ({
  ticks,
  majorEvery,
  pxPerSec,
}: {
  ticks: number[];
  majorEvery: number;
  pxPerSec: number;
}) => {
  return (
    <div className="rotation-ticks" aria-hidden>
      {ticks.map((t) => {
        const major = t % majorEvery === 0;
        return (
          <div
            key={t}
            className={joinClassNames("rotation-tick", major && "major")}
            style={{ left: t * pxPerSec }}
          >
            {major ? <span>{t}s</span> : null}
          </div>
        );
      })}
    </div>
  );
};

const TimelineBlock = ({
  placement,
  character,
  loop,
  cycleLength,
  pxPerSec,
  selected,
  moving,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onBeginResize,
  onBeginMove,
}: {
  placement: TimelinePlacement;
  character: CharacterData | undefined;
  loop: boolean;
  cycleLength: number;
  pxPerSec: number;
  selected: boolean;
  moving: boolean;
  onSelect: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onBeginResize: (
    e: ReactPointerEvent,
    id: string,
    mode: "resize-right" | "resize-left",
  ) => void;
  onBeginMove: (e: ReactPointerEvent, id: string) => void;
}) => {
  if (!character) return null;

  const start = loop ? placement.start + cycleLength : placement.start;
  const width = Math.max(
    placement.duration * pxPerSec,
    MIN_ON_FIELD * pxPerSec,
  );

  const handleClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (loop) return;
    onSelect(placement.id);
  };

  let icon: ReactNode;
  if (character.icon || character.iconFile) {
    icon = (
      <CharacterIcon character={character} className="rotation-block-icon" />
    );
  } else {
    icon = (
      <span className="rotation-block-icon fallback" aria-hidden>
        {character.name.slice(0, 1)}
      </span>
    );
  }

  return (
    <div
      className={joinClassNames("rotation-block-shell", loop && "loop")}
      style={{
        left: start * pxPerSec,
        width,
        top: "50%",
        transform: "translateY(-50%)",
        height: `${BLOCK_ROW_HEIGHT}rem`,
      }}
    >
      <span className="rotation-block-name">{character.name}</span>
      <div
        className={joinClassNames(
          "rotation-block",
          loop && "loop",
          !loop && selected && "selected",
          !loop && moving && "moving",
        )}
        data-element={character.element}
        aria-hidden={loop || undefined}
        aria-label={
          loop
            ? undefined
            : `${character.name}, ${placement.duration.toFixed(2)}s`
        }
        onPointerEnter={loop ? undefined : () => onHoverEnter(placement.id)}
        onPointerLeave={loop ? undefined : () => onHoverLeave(placement.id)}
        onClick={loop ? undefined : handleClick}
      >
        {loop ? null : (
          <button
            type="button"
            className="rotation-block-resize left"
            aria-label={`Adjust start for ${character.name}`}
            onPointerDown={(e) => onBeginResize(e, placement.id, "resize-left")}
          />
        )}
        <div
          className="rotation-block-body"
          onPointerDown={loop ? undefined : (e) => onBeginMove(e, placement.id)}
          title={loop ? undefined : "Drag to reorder"}
        >
          {icon}
          <span className="rotation-block-copy">
            <span className="rotation-block-label">{character.name}</span>
            <span className="rotation-block-time">
              {placement.duration.toFixed(2)}s
            </span>
          </span>
        </div>
        {loop ? null : (
          <button
            type="button"
            className="rotation-block-resize right"
            aria-label={`Adjust end for ${character.name}`}
            onPointerDown={(e) =>
              onBeginResize(e, placement.id, "resize-right")
            }
          />
        )}
      </div>
    </div>
  );
};

const SwitchGapMark = ({
  gap,
  loop,
  cycleLength,
  pxPerSec,
}: {
  gap: SwitchGap;
  loop: boolean;
  cycleLength: number;
  pxPerSec: number;
}) => {
  const left = (gap.start + (loop ? cycleLength : 0)) * pxPerSec;
  return (
    <div
      className={joinClassNames("rotation-switch-gap", loop && "loop")}
      title={`Switch ${gap.duration.toFixed(2)}s`}
      style={{
        left,
        width: Math.max(gap.duration * pxPerSec, 2),
      }}
    >
      <span>sw</span>
    </div>
  );
};

const DurationLanes = ({
  rows,
  laneCount,
  height,
  rowHeight,
  pxPerSec,
  emptyMessage,
}: {
  rows: DurationRow[];
  laneCount: number;
  height: number;
  rowHeight: number;
  pxPerSec: number;
  emptyMessage: string;
}) => {
  if (laneCount === 0) {
    return <p className="rotation-duration-empty">{emptyMessage}</p>;
  }

  return (
    <div
      className="rotation-duration-lanes"
      style={{ height: `${height}rem` }}
      aria-label="Active durations"
    >
      {rows.map((row) => (
        <div
          key={`${row.placementId}-${row.optionId}-${row.loop ? "loop" : "main"}`}
          className={joinClassNames(
            "rotation-duration-line",
            row.loop && "loop",
            row.cooldown && "cooldown",
          )}
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
  );
};
