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
import { readCastDrag, readCharacterDrag } from "./CharacterPalette";
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
  defaultSkillCasts,
  defaultSkillVariant,
  fieldActionSegments,
  kitHoldChannelSeconds,
  parseCastOrder,
  prefersSupportCastPrefill,
  type TimingMode,
} from "./fieldTimings";
import {
  comboActionFamily,
  initialComboStepsForPlacement,
  initialOnFieldDuration,
  packComboSteps,
  placementUsesComboSteps,
  shortActionLabel,
} from "./comboSequence";
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
import {
  partyConvertsBloom,
  partyConvertsElectroCharged,
} from "./combatMechanicsData";
import { simulateAura, type AuraTransition } from "./auraSim";
import { ElementIcon } from "./ElementIcon";
import { expandRotationHits } from "./rotationHits";
import type { CharacterData, TimelinePlacement } from "./types";

const DEFAULT_PX_PER_SEC = 48;
const MIN_PX_PER_SEC = 18;
const MAX_PX_PER_SEC = 180;
export const TIMELINE_SECONDS = 30;

const BLOCK_ROW_HEIGHT = 4;
const ACTION_STRIP_HEIGHT = 1.05;
/** Extra lane padding in the editor so centered blocks have room for names. */
const LANE_PAD = 3.75;
const LANE_HEIGHT = BLOCK_ROW_HEIGHT + ACTION_STRIP_HEIGHT + LANE_PAD;
/** Room above blocks for character name chips (preview top-align). */
const PREVIEW_NAME_GAP = 1.55;
const PREVIEW_LANE_HEIGHT =
  PREVIEW_NAME_GAP + BLOCK_ROW_HEIGHT + ACTION_STRIP_HEIGHT + 0.35;
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
  originY: number;
  originStart: number;
  originDuration: number;
  /** True once movement crosses the drag threshold (move) or immediately (resize). */
  active: boolean;
  moved: boolean;
  lastIndex: number;
  orderWithout: string[];
  mids: number[];
};

/** Pixels before a timeline block click becomes a reorder drag. */
const MOVE_DRAG_THRESHOLD_PX = 12;

type MoveGhost = {
  characterId: string;
  name: string;
  element: string;
  x: number;
  y: number;
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
  /** Show enemy aura transition markers (rotation-specific). */
  showAuraMarkers?: boolean;
  onShowAuraMarkersChange?: (value: boolean) => void;
  /** View-only preview (no drag / remove / drop). */
  readOnly?: boolean;
  /** Hide kit / artifact / CD duration overlay lanes. */
  hideDurationOverlays?: boolean;
  /**
   * Starting zoom as a fraction of the default (e.g. 0.75).
   * Does not lock zoom — use `lockZoom` for that.
   */
  initialZoomScale?: number;
  /**
   * Lock horizontal zoom (disables wheel zoom and toolbar zoom controls).
   * When true with `initialZoomScale`, zoom stays at that scale.
   */
  lockZoom?: boolean;
  /** @deprecated Prefer `initialZoomScale` + `lockZoom`. */
  fixedZoomScale?: number;
  /** Hide the Timeline heading / zoom toolbar. */
  hideToolbar?: boolean;
  /** Compact block sizing (hub / detail previews). */
  compactLayout?: boolean;
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
      skillCasts: placement.skillCasts,
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
  showAuraMarkers = true,
  onShowAuraMarkersChange,
  readOnly = false,
  hideDurationOverlays = false,
  initialZoomScale,
  lockZoom = false,
  fixedZoomScale,
  hideToolbar = false,
  compactLayout = false,
}: RotationTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef(placements);
  const switchBufferRef = useRef(switchBuffer);
  const timingModeRef = useRef(timingMode);
  const humanLagRef = useRef(humanLag);
  const startScale =
    initialZoomScale ??
    (fixedZoomScale != null && Number.isFinite(fixedZoomScale)
      ? fixedZoomScale
      : null);
  const zoomLocked =
    lockZoom ||
    (fixedZoomScale != null &&
      Number.isFinite(fixedZoomScale) &&
      initialZoomScale == null);
  const startPxPerSec =
    startScale != null && Number.isFinite(startScale)
      ? clamp(DEFAULT_PX_PER_SEC * startScale, MIN_PX_PER_SEC, MAX_PX_PER_SEC)
      : DEFAULT_PX_PER_SEC;
  const lockedPxPerSec = zoomLocked ? startPxPerSec : null;
  const pxPerSecRef = useRef(startPxPerSec);
  const [pxPerSec, setPxPerSec] = useState(startPxPerSec);
  const [dragOver, setDragOver] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveGhost, setMoveGhost] = useState<MoveGhost | null>(null);
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
    if (lockedPxPerSec == null) return;
    pxPerSecRef.current = lockedPxPerSec;
    setPxPerSec(lockedPxPerSec);
  }, [lockedPxPerSec]);

  useEffect(() => {
    if (readOnly) return;
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
  }, [onChange, onSelectPlacement, readOnly]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || lockedPxPerSec != null) return;

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
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
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
  }, [lockedPxPerSec]);

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
      hideDurationOverlays
        ? []
        : buildDurationRows(
            placements,
            timingMode,
            humanLag,
            showLoop,
            cycleLength,
          ),
    [
      hideDurationOverlays,
      placements,
      timingMode,
      humanLag,
      showLoop,
      cycleLength,
    ],
  );
  const durationLaneCount = useMemo(() => {
    return new Set(durationRows.map((row) => row.lane)).size;
  }, [durationRows]);
  const sorted = useMemo(
    () => [...placements].sort((a, b) => a.start - b.start),
    [placements],
  );

  const auraTransitions = useMemo(() => {
    if (!showAuraMarkers || placements.length === 0) return [];
    const characterIds = [
      ...new Set(sorted.map((p) => p.characterId)),
    ];
    const hits = expandRotationHits(placements);
    if (!hits.length) return [];
    return simulateAura(hits, {
      convertElectroCharged: partyConvertsElectroCharged(characterIds),
      convertBloom: partyConvertsBloom(characterIds),
      sampleInterval: 0.5,
      endTime: Math.max(coverageEnd + 0.5, hits[hits.length - 1]?.time ?? 0),
    }).transitions;
  }, [showAuraMarkers, placements, sorted, coverageEnd]);

  const width = displayEnd * pxPerSec;
  const majorEvery = majorTickStep(pxPerSec);
  const durationsHeight = Math.max(durationLaneCount * DURATION_ROW_HEIGHT, 0);
  const previewLayout = compactLayout || hideDurationOverlays;
  const laneHeight = previewLayout ? PREVIEW_LANE_HEIGHT : LANE_HEIGHT;
  // Aura lane: lasting row + optional flash row (~2.85rem) + small margins.
  const auraLaneReserve = showAuraMarkers ? 3.05 : 0;
  const trackMinHeight = previewLayout
    ? 1.45 +
      laneHeight +
      0.25 +
      auraLaneReserve +
      (durationLaneCount ? 0.55 + durationsHeight * 0.85 : 0)
    : 1.35 +
      LANE_HEIGHT +
      auraLaneReserve +
      (durationLaneCount
        ? 0.85 + durationsHeight
        : showAuraMarkers
          ? 0.2
          : 1.5);

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

    const cast = readCastDrag(e);
    const characterId = cast?.characterId ?? readCharacterDrag(e);
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
    const skillVariant =
      cast?.skillVariant ?? defaultSkillVariant(characterId, kitHold);
    const skillCasts =
      cast?.skillCasts ?? defaultSkillCasts(characterId, kitHold);
    const supportPrefill = prefersSupportCastPrefill(characterId, kitHold);
    // Character drops: only supports prefill Skill/Burst (e.g. Sucrose EE).
    // Cast-chip drops keep the dragged ability. Combo DPS start empty.
    const castSkill = cast ? cast.kind === "skill" : supportPrefill;
    const castBurst = cast ? cast.kind === "burst" : supportPrefill;
    const comboSteps = initialComboStepsForPlacement(characterId, {
      skill: castSkill,
      burst: castBurst,
      castOrder: "skill-first",
      skillVariant,
      skillCasts,
      kitHoldSeconds: kitHold,
    });
    const durationOpts = {
      skill: castSkill,
      burst: castBurst,
      mode: timingModeRef.current,
      humanLag: humanLagRef.current,
      skillVariant,
      skillCasts,
      kitHoldSeconds: kitHold,
    };
    const next: TimelinePlacement = {
      id: createPlacementId(),
      characterId,
      start: at,
      duration: cast
        ? defaultOnFieldDuration(characterId, durationOpts)
        : initialOnFieldDuration(characterId, durationOpts, comboSteps),
      castSkill,
      castBurst,
      castOrder: "skill-first",
      skillVariant,
      skillCasts,
      comboSteps,
      activeDurations: [],
      durationOverrides: {},
    };
    onChange((prev) => insertOnField(prev, next, at, switchBufferRef.current));
    onSelectPlacement(next.id);
  };

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "move") {
      const dist = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY);
      if (!drag.active) {
        if (dist < MOVE_DRAG_THRESHOLD_PX) return;
        drag.active = true;
        drag.moved = true;
        onHistoryGestureStart?.();
        setMovingId(drag.id);
        const placement = placementsRef.current.find((p) => p.id === drag.id);
        const character = placement
          ? getCharacter(placement.characterId)
          : null;
        if (character) {
          setMoveGhost({
            characterId: character.id,
            name: character.name,
            element: String(character.element),
            x: e.clientX,
            y: e.clientY,
          });
        }
      } else if (dist > MOVE_DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }

      setMoveGhost((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev,
      );
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

    const dx = (e.clientX - drag.originX) / pxPerSecRef.current;
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
    const drag = dragRef.current;
    if (drag?.moved) suppressClickRef.current = true;
    const wasActive = Boolean(drag?.active);
    dragRef.current = null;
    setMovingId(null);
    setMoveGhost(null);
    if (wasActive) onHistoryGestureEnd?.();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const startPointerGesture = (beginHistory: boolean) => {
    if (beginHistory) onHistoryGestureStart?.();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const beginResize = (
    e: ReactPointerEvent,
    id: string,
    mode: "resize-right" | "resize-left",
  ) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const placement = placementsRef.current.find((p) => p.id === id);
    if (!placement) return;
    onSelectPlacement(id);
    dragRef.current = {
      id,
      mode,
      originX: e.clientX,
      originY: e.clientY,
      originStart: placement.start,
      originDuration: placement.duration,
      active: true,
      moved: false,
      lastIndex: -1,
      orderWithout: [],
      mids: [],
    };
    startPointerGesture(true);
  };

  const beginMove = (e: ReactPointerEvent, id: string) => {
    if (readOnly) return;
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
      originY: e.clientY,
      originStart: placement.start,
      originDuration: placement.duration,
      active: false,
      moved: false,
      lastIndex: from,
      orderWithout: slots.orderWithout,
      mids: slots.mids,
    };
    // Listen for movement, but don't arm reorder / ghost until threshold.
    startPointerGesture(false);
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
        timingMode={timingMode}
        humanLag={humanLag}
        readOnly={readOnly}
        previewLayout={previewLayout}
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
    <section
      className={joinClassNames(
        "rotation-timeline",
        previewLayout && "preview",
      )}
      aria-label="Rotation timeline"
    >
      {hideToolbar ? null : (
        <TimelineToolbar
          hasSelection={selectedId != null}
          hasPlacements={placements.length > 0}
          readOnly={readOnly}
          lockZoom={zoomLocked}
          showAuraMarkers={showAuraMarkers}
          onToggleAuraMarkers={() =>
            onShowAuraMarkersChange?.(!showAuraMarkers)
          }
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onFit={fitToFirstRotation}
          onRemove={removeSelected}
          onClear={clearAll}
        />
      )}

      <div className="rotation-timeline-scroll" ref={scrollRef}>
        <div
          className={joinClassNames("rotation-track", dragOver && "drag-over")}
          ref={trackRef}
          style={{
            width: `max(100%, ${width}px)`,
            minHeight: `${trackMinHeight}rem`,
            backgroundSize: `${pxPerSec}px 100%`,
          }}
          onDragOver={
            readOnly
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDragOver(true);
                }
          }
          onDragLeave={readOnly ? undefined : () => setDragOver(false)}
          onDrop={readOnly ? undefined : handleDrop}
          onClick={() => onSelectPlacement(null)}
        >
          <TimelineTicks
            ticks={ticks}
            majorEvery={majorEvery}
            pxPerSec={pxPerSec}
          />

          <div
            className="rotation-lane"
            style={{ height: `${laneHeight}rem` }}
          >
            {placements.length === 0 ? (
              <p className="rotation-drop-hint">
                Drop characters or casts here
              </p>
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

          {hideDurationOverlays ||
          (readOnly && durationRows.length === 0) ? null : (
            <DurationLanes
              rows={durationRows}
              laneCount={durationLaneCount}
              height={durationsHeight}
              rowHeight={DURATION_ROW_HEIGHT}
              pxPerSec={pxPerSec}
              emptyMessage={
                readOnly ? "" : durationEmptyMessage(placements.length)
              }
            />
          )}

          {showAuraMarkers ? (
            <AuraMarkerLane
              transitions={auraTransitions}
              pxPerSec={pxPerSec}
              showLoop={showLoop}
              cycleLength={cycleLength}
            />
          ) : null}
        </div>
      </div>

      {moveGhost ? (
        <div
          className="rotation-drag-ghost floating"
          data-element={moveGhost.element}
          style={{
            left: moveGhost.x,
            top: moveGhost.y,
          }}
          aria-hidden
        >
          <CharacterIcon
            character={
              getCharacter(moveGhost.characterId) ?? {
                name: moveGhost.name,
                icon: null,
                iconFile: null,
              }
            }
            className="rotation-drag-ghost-icon"
          />
          <span className="rotation-drag-ghost-name">{moveGhost.name}</span>
        </div>
      ) : null}
    </section>
  );
};

const TimelineToolbar = ({
  hasSelection,
  hasPlacements,
  readOnly,
  lockZoom,
  showAuraMarkers,
  onToggleAuraMarkers,
  onZoomOut,
  onZoomIn,
  onFit,
  onRemove,
  onClear,
}: {
  hasSelection: boolean;
  hasPlacements: boolean;
  readOnly?: boolean;
  lockZoom?: boolean;
  showAuraMarkers: boolean;
  onToggleAuraMarkers: () => void;
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
        {readOnly ? null : (
          <button
            type="button"
            className={
              showAuraMarkers ? "chip compact active" : "chip compact"
            }
            title="Show enemy aura changes on the timeline"
            aria-pressed={showAuraMarkers}
            onClick={onToggleAuraMarkers}
          >
            Aura
          </button>
        )}
        {lockZoom ? null : (
          <>
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
          </>
        )}
        {readOnly ? null : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

const AuraMarkerLane = ({
  transitions,
  pxPerSec,
  showLoop,
  cycleLength,
}: {
  transitions: AuraTransition[];
  pxPerSec: number;
  showLoop: boolean;
  cycleLength: number;
}) => {
  const renderMark = (tr: AuraTransition, loop: boolean) => {
    const left = (tr.time + (loop ? cycleLength : 0)) * pxPerSec;
    const lastingLabel =
      tr.auras.length === 0
        ? "Aura cleared"
        : tr.auras
            .map((a) => `${a.element} ${a.gauge.toFixed(2)}U`)
            .join(" · ");
    const flashLabel = tr.flash?.length
      ? ` · flash ${tr.flash.map((a) => a.element).join("+")}`
      : "";
    return (
      <div
        key={`${loop ? "loop-" : ""}${tr.time}-${tr.auras.map((a) => a.element).join("-")}-${tr.flash?.map((a) => a.element).join("-") ?? ""}`}
        className={joinClassNames(
          "rotation-aura-mark",
          loop && "loop",
          tr.auras.length === 0 && "cleared",
          tr.flash?.length ? "has-flash" : false,
        )}
        style={{ left }}
        title={`${tr.time.toFixed(2)}s — ${lastingLabel}${flashLabel}`}
      >
        <div className="rotation-aura-row lasting">
          {tr.auras.length === 0 ? (
            <span className="rotation-aura-icon empty" aria-hidden />
          ) : (
            tr.auras.map((a) => (
              <ElementIcon
                key={a.element}
                element={a.element}
                className="rotation-aura-icon"
                title={`${a.element} ${a.gauge.toFixed(2)}U`}
              />
            ))
          )}
        </div>
        {tr.flash?.length ? (
          <div className="rotation-aura-row flash" aria-label="Reaction flash">
            {tr.flash.map((a) => (
              <ElementIcon
                key={`flash-${a.element}`}
                element={a.element}
                className="rotation-aura-icon flash"
                title={`${a.element} flash`}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rotation-aura-lane" aria-label="Enemy aura transitions">
      {transitions.length === 0 ? (
        <p className="rotation-aura-empty">No aura changes yet</p>
      ) : (
        <>
          {transitions.map((tr) => renderMark(tr, false))}
          {showLoop
            ? transitions.map((tr) => renderMark(tr, true))
            : null}
        </>
      )}
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
  timingMode,
  humanLag,
  readOnly,
  previewLayout,
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
  timingMode: TimingMode;
  humanLag: number;
  readOnly?: boolean;
  previewLayout?: boolean;
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

  const kitHold = kitHoldChannelSeconds(character.kit.elementalSkill);
  const actionSegments = placementUsesComboSteps(placement)
    ? packComboSteps(placement.characterId, placement.comboSteps).segments.map(
        (seg) => ({
          id: seg.stepId,
          kind: comboActionFamily(seg.kind),
          label: seg.label,
          shortLabel: shortActionLabel(seg.label, seg.actionId || seg.kind),
          start: seg.start,
          duration: seg.duration,
        }),
      )
    : fieldActionSegments(placement.characterId, placement.duration, {
        skill: placement.castSkill ?? true,
        burst: placement.castBurst ?? true,
        castOrder: parseCastOrder(placement.castOrder),
        mode: timingMode,
        humanLag,
        skillVariant: placement.skillVariant,
        skillCasts: placement.skillCasts,
        kitHoldSeconds: kitHold,
      }).map((seg) => ({
        ...seg,
        shortLabel: shortActionLabel(seg.label, seg.kind),
      }));

  // Clamp strip drawing to the on-field window width.
  const fieldDuration = placement.duration;
  const visibleSegments = actionSegments
    .map((seg) => {
      const start = Math.max(0, Math.min(fieldDuration, seg.start));
      const end = Math.max(
        start,
        Math.min(fieldDuration, seg.start + seg.duration),
      );
      if (end <= start) return null;
      return { ...seg, start, duration: end - start };
    })
    .filter((seg): seg is NonNullable<typeof seg> => seg != null);

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
        top: previewLayout ? `${PREVIEW_NAME_GAP}rem` : "50%",
        transform: previewLayout ? "none" : "translateY(-50%)",
        height: `${BLOCK_ROW_HEIGHT + ACTION_STRIP_HEIGHT}rem`,
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
        style={{ height: `${BLOCK_ROW_HEIGHT}rem` }}
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
        {loop || readOnly ? null : (
          <button
            type="button"
            className="rotation-block-resize left"
            aria-label={`Adjust start for ${character.name}`}
            onPointerDown={(e) => onBeginResize(e, placement.id, "resize-left")}
          />
        )}
        <div
          className="rotation-block-body is-draggable"
          onPointerDown={
            loop || readOnly
              ? undefined
              : (e) => onBeginMove(e, placement.id)
          }
          title={loop || readOnly ? undefined : "Drag to reorder"}
        >
          {loop || readOnly ? null : (
            <span className="drag-affordance" aria-hidden>
              ⠿
            </span>
          )}
          {icon}
          <span className="rotation-block-copy">
            <span className="rotation-block-label">{character.name}</span>
            <span className="rotation-block-time">
              {placement.duration.toFixed(2)}s
            </span>
          </span>
        </div>
        {loop || readOnly ? null : (
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
      <div
        className={joinClassNames(
          "rotation-block-actions",
          loop && "loop",
          !loop && selected && "selected",
        )}
        style={{ height: `${ACTION_STRIP_HEIGHT}rem` }}
        aria-hidden={loop || undefined}
        aria-label={loop ? undefined : `${character.name} actions`}
      >
        {visibleSegments.map((seg) => {
          const segWidth = Math.max(seg.duration * pxPerSec, 1);
          return (
            <span
              key={seg.id}
              className={`rotation-block-action kind-${seg.kind}`}
              style={{
                left: seg.start * pxPerSec,
                width: segWidth,
              }}
              title={`${seg.label} · ${seg.duration.toFixed(2)}s`}
            >
              <span className="rotation-block-action-label">
                {seg.shortLabel}
              </span>
            </span>
          );
        })}
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
    if (!emptyMessage) return null;
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
