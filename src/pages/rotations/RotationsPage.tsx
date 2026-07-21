import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { ClearPageButton } from "../../components/ClearPageButton.tsx";
import { PAGE_TITLES } from "../../documentTitles.ts";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.ts";
import { useUndoableLocalStorage } from "../../hooks/useUndoableLocalStorage.ts";
import { CharacterPalette } from "./CharacterPalette";
import { PlacementRoster } from "./PlacementRoster";
import { RotationSettingsMenu } from "./RotationSettingsMenu";
import {
  defaultOnFieldDuration,
  kitHoldChannelSeconds,
  sanitizePlacementCasts,
  type TimingMode,
} from "./fieldTimings";
import { RotationTimeline } from "./RotationTimeline";
import {
  clampSwitchBuffer,
  fieldEnd,
  insertOnField,
  normalizeOnField,
  removeAndCloseGaps,
  snapTime,
} from "./timelineContinuous";
import type { TimelinePlacement } from "./types";
import { getCharacter } from "./characters";
import {
  ROTATION_DOC_KEY,
  defaultRotationDoc,
  loadRotationDoc,
  type RotationDoc,
} from "./rotationDoc";

const placementIdsKey = (placements: TimelinePlacement[]) => {
  return placements.map((p) => p.id).join("\0");
};

/** Placement fields that count as character edits (ignore layout `start`). */
const placementEditSignature = (placements: TimelinePlacement[]) => {
  return JSON.stringify(
    [...placements]
      .map(({ start: _start, ...rest }) => rest)
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
};

/**
 * Adds, removes, reorders, and character/kit edits always get their own undo
 * step. Timeline drag gestures coalesce separately via begin/endHistoryGesture.
 */
const forceRotationHistory = (prev: RotationDoc, next: RotationDoc) => {
  return (
    prev.placements.length !== next.placements.length ||
    placementIdsKey(prev.placements) !== placementIdsKey(next.placements) ||
    placementEditSignature(prev.placements) !==
      placementEditSignature(next.placements) ||
    prev.switchBuffer !== next.switchBuffer ||
    prev.timingMode !== next.timingMode ||
    prev.humanLag !== next.humanLag
  );
};

const sanitizePlacements = (
  list: TimelinePlacement[],
  timingMode: TimingMode,
  humanLag: number,
): TimelinePlacement[] => {
  return list.map((p) => {
    const kitHold = kitHoldChannelSeconds(
      getCharacter(p.characterId)?.kit.elementalSkill ?? null,
    );
    const { migratedVariant, ...casts } = sanitizePlacementCasts(p, kitHold);
    const next: TimelinePlacement = { ...p, ...casts };
    const fullDuration = snapTime(
      defaultOnFieldDuration(next.characterId, {
        skill: next.castSkill,
        burst: next.castBurst,
        mode: timingMode,
        humanLag,
        skillVariant: next.skillVariant,
        kitHoldSeconds: kitHold,
      }),
    );
    // Backfill old flat 2.5s drops / pre-variant saves to Full defaults
    if (
      migratedVariant ||
      (Math.abs(p.duration - 2.5) < 0.05 && fullDuration > 3.5)
    ) {
      next.duration = fullDuration;
    }
    return next;
  });
};

const createPlacementId = () => {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
};

const isEditableTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(
    el?.closest('input, textarea, select, [contenteditable="true"]'),
  );
};

const RotationsPage = () => {
  useDocumentTitle(PAGE_TITLES.rotations);
  const {
    value: doc,
    setValue: setDoc,
    undo,
    redo,
    skipNextHistory,
    beginHistoryGesture,
    endHistoryGesture,
  } = useUndoableLocalStorage<RotationDoc>(
    ROTATION_DOC_KEY,
    defaultRotationDoc(),
    { load: loadRotationDoc, forceHistory: forceRotationHistory },
  );

  const { placements, switchBuffer, timingMode, humanLag } = doc;

  const setPlacements = useCallback(
    (update: SetStateAction<TimelinePlacement[]>) => {
      setDoc((prev) => ({
        ...prev,
        placements:
          typeof update === "function" ? update(prev.placements) : update,
      }));
    },
    [setDoc],
  );

  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const clipboardRef = useRef<TimelinePlacement | null>(null);
  const docRef = useRef(doc);
  const selectedPlacementIdRef = useRef(selectedPlacementId);

  docRef.current = doc;
  selectedPlacementIdRef.current = selectedPlacementId;

  // Keep a timeline character selected whenever the roster is non-empty.
  useEffect(() => {
    if (placements.length === 0) {
      if (selectedPlacementId != null) setSelectedPlacementId(null);
      return;
    }
    const stillValid = placements.some((p) => p.id === selectedPlacementId);
    if (stillValid) return;
    const next = [...placements].sort((a, b) => a.start - b.start)[0];
    setSelectedPlacementId(next.id);
    setSelectedCharacterId(next.characterId);
  }, [placements, selectedPlacementId]);

  // Re-lay out with switch buffers; backfill cast toggles on older saves
  useEffect(() => {
    skipNextHistory();
    setDoc((prev) => ({
      ...prev,
      placements: normalizeOnField(
        sanitizePlacements(prev.placements, prev.timingMode, prev.humanLag),
        prev.switchBuffer,
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount sanitize only
  }, []);

  useEffect(() => {
    const copySelected = () => {
      const id = selectedPlacementIdRef.current;
      if (!id) return false;
      const placement = docRef.current.placements.find((p) => p.id === id);
      if (!placement) return false;
      clipboardRef.current = structuredClone(placement);
      return true;
    };

    const pasteClipboard = () => {
      const clip = clipboardRef.current;
      if (!clip) return;
      const { placements: list, switchBuffer: buffer } = docRef.current;
      const selected = list.find(
        (p) => p.id === selectedPlacementIdRef.current,
      );
      const incoming: TimelinePlacement = {
        ...structuredClone(clip),
        id: createPlacementId(),
      };
      const at = selected
        ? selected.start + selected.duration + buffer * 0.5
        : fieldEnd(list, buffer);
      const next = insertOnField(list, incoming, at, buffer);
      setDoc((prev) => ({ ...prev, placements: next }));
      setSelectedPlacementId(incoming.id);
      setSelectedCharacterId(incoming.characterId);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (key === "c") {
        if (copySelected()) e.preventDefault();
        return;
      }
      if (key === "v") {
        if (!clipboardRef.current) return;
        e.preventDefault();
        pasteClipboard();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, setDoc]);

  const selectPlacement = (id: string | null) => {
    if (id == null) {
      if (placements.length === 0) setSelectedPlacementId(null);
      return;
    }
    setSelectedPlacementId(id);
    const placement = placements.find((x) => x.id === id);
    if (placement) setSelectedCharacterId(placement.characterId);
  };

  const updateSwitchBuffer = (raw: number) => {
    const next = clampSwitchBuffer(raw);
    setDoc((prev) => ({
      ...prev,
      switchBuffer: next,
      placements: normalizeOnField(prev.placements, next),
    }));
  };

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Rotations</h1>
          <div className="hero-actions">
            <RotationSettingsMenu
              switchBuffer={switchBuffer}
              onSwitchBufferChange={updateSwitchBuffer}
              timingMode={timingMode}
              onTimingModeChange={(mode) =>
                setDoc((prev) => ({ ...prev, timingMode: mode }))
              }
              humanLag={humanLag}
              onHumanLagChange={(value) =>
                setDoc((prev) => ({ ...prev, humanLag: value }))
              }
            />
            <ClearPageButton prefix="gc:rotations:" />
          </div>
        </div>
        <p className="lede">
          Sketch field time and see team buffs, artifact sets, and cooldowns as
          timeline overlays — then reorder and tune durations to spot gaps and
          maximize uptime.
        </p>
      </header>

      <div className="rotation-workspace">
        <RotationTimeline
          placements={placements}
          onChange={setPlacements}
          selectedId={selectedPlacementId}
          switchBuffer={switchBuffer}
          timingMode={timingMode}
          humanLag={humanLag}
          onSelectPlacement={selectPlacement}
          onHistoryGestureStart={beginHistoryGesture}
          onHistoryGestureEnd={endHistoryGesture}
        />

        <div className="rotation-below">
          <CharacterPalette
            selectedId={selectedCharacterId}
            onSelect={(c) => {
              setSelectedCharacterId(c.id);
              const match = placements
                .filter((p) => p.characterId === c.id)
                .sort((a, b) => a.start - b.start)[0];
              if (match) setSelectedPlacementId(match.id);
            }}
          />

          <PlacementRoster
            placements={placements}
            selectedId={selectedPlacementId}
            switchBuffer={switchBuffer}
            timingMode={timingMode}
            humanLag={humanLag}
            onSelect={selectPlacement}
            onChange={setPlacements}
            onRemove={(id) => {
              setPlacements((prev) =>
                removeAndCloseGaps(prev, id, switchBuffer),
              );
              if (selectedPlacementId === id) {
                setSelectedPlacementId(null);
              }
            }}
          />
        </div>
      </div>
    </>
  );
};

export default RotationsPage;
