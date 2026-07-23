import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { ClearPageButton } from "../../components/ClearPageButton.tsx";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.ts";
import { useUndoableLocalStorage } from "../../hooks/useUndoableLocalStorage.ts";
import { CharacterPalette } from "./CharacterPalette";
import {
  createCommunityRotation,
  getCommunityRotation,
  updateCommunityRotation,
} from "./communityApi";
import { PlacementRoster } from "./PlacementRoster";
import { ComboInspectPanel } from "./ComboInspectPanel";
import { RotationSettingsMenu } from "./RotationSettingsMenu";
import {
  initialComboStepsForPlacement,
  initialOnFieldDuration,
} from "./comboSequence";
import {
  defaultOnFieldDuration,
  defaultSkillCasts,
  defaultSkillVariant,
  kitHoldChannelSeconds,
  prefersSupportCastPrefill,
  sanitizePlacementCasts,
  type TimingMode,
} from "./fieldTimings";
import { RotationTimeline } from "./RotationTimeline";
import {
  clampSwitchBuffer,
  fieldEnd,
  insertAtIndex,
  insertOnField,
  normalizeOnField,
  removeAndCloseGaps,
  snapTime,
} from "./timelineContinuous";
import type { CharacterData, TimelinePlacement } from "./types";
import { getCharacter } from "./characters";
import {
  ROTATION_DOC_KEY,
  defaultRotationDoc,
  loadRotationDoc,
  type RotationDoc,
} from "./rotationDoc";

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
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
        skillCasts: next.skillCasts,
        kitHoldSeconds: kitHold,
      }),
    );
    // Backfill old flat 2.5s drops / pre-variant saves to expected on-field defaults
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

const RotationsEditorInner = () => {
  useDocumentTitle(`Rotation Editor · False Moon's Reckoning`);
  const navigate = useNavigate();
  const { rotationId } = useParams();
  const { getToken, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const authorName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Traveler";

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

  const [metaOpen, setMetaOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(rotationId ?? null);
  const [sourceAuthorId, setSourceAuthorId] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [insertAtIndexState, setInsertAtIndexState] = useState<number | null>(
    null,
  );
  const loadedRemoteRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isOwnRotation = Boolean(
    editingId && sourceAuthorId && userId && sourceAuthorId === userId,
  );
  const isForking = Boolean(
    editingId && sourceAuthorId && userId && sourceAuthorId !== userId,
  );

  useEffect(() => {
    if (!rotationId || loadedRemoteRef.current === rotationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const item = await getCommunityRotation(
          rotationId,
          clerkConfigured ? () => getToken() : undefined,
        );
        if (cancelled) return;
        loadedRemoteRef.current = rotationId;
        setEditingId(item.id);
        setSourceAuthorId(item.authorId);
        setSourceTitle(item.title);
        setTitle(item.title);
        setDescription(item.description || "");
        skipNextHistory();
        setDoc(item.doc as RotationDoc);
      } catch {
        if (!cancelled) setSaveError("Could not load that rotation.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, rotationId, setDoc, skipNextHistory]);

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
  const selectedPlacement =
    placements.find((p) => p.id === selectedPlacementId) ?? null;
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

  const createPlacement = (characterId: string): TimelinePlacement | null => {
    if (!getCharacter(characterId)) return null;
    const kitHold = kitHoldChannelSeconds(
      getCharacter(characterId)?.kit.elementalSkill ?? null,
    );
    const skillVariant = defaultSkillVariant(characterId, kitHold);
    const skillCasts = defaultSkillCasts(characterId, kitHold);
    const supportPrefill = prefersSupportCastPrefill(characterId, kitHold);
    const castSkill = supportPrefill;
    const castBurst = supportPrefill;
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
      mode: timingMode,
      humanLag,
      skillVariant,
      skillCasts,
      kitHoldSeconds: kitHold,
    };
    return {
      id: createPlacementId(),
      characterId,
      start: 0,
      duration: initialOnFieldDuration(characterId, durationOpts, comboSteps),
      castSkill,
      castBurst,
      castOrder: "skill-first",
      skillVariant,
      skillCasts,
      comboSteps,
      activeDurations: [],
      durationOverrides: {},
    };
  };

  const addCharacterToRotation = (character: CharacterData) => {
    const incoming = createPlacement(character.id);
    if (!incoming) return;
    const index =
      insertAtIndexState == null ? placements.length : insertAtIndexState;
    setDoc((prev) => ({
      ...prev,
      placements: insertAtIndex(
        prev.placements,
        incoming,
        index,
        prev.switchBuffer,
      ),
    }));
    setSelectedPlacementId(incoming.id);
    setSelectedCharacterId(character.id);
    setInsertAtIndexState(null);
  };

  const saveRotation = async () => {
    if (!clerkConfigured || !isSignedIn) {
      navigate("/sign-in");
      return;
    }
    if (sourceAuthorId && !userId) {
      setSaveError("Still signing in… try again in a moment.");
      return;
    }

    let nextTitle = title;
    if (
      isForking &&
      sourceTitle &&
      nextTitle.trim() === sourceTitle.trim() &&
      !/\(copy\)$/i.test(nextTitle.trim())
    ) {
      nextTitle = `${sourceTitle.trim()} (copy)`;
      setTitle(nextTitle);
    }

    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      setMetaOpen(true);
      setSaveError("Add a name in Details before saving.");
      requestAnimationFrame(() => titleInputRef.current?.focus());
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload = {
        title: trimmedTitle,
        description,
        doc,
        authorName,
      };
      // Own posts update in place; anyone else's becomes a new published copy.
      const item = isOwnRotation
        ? await updateCommunityRotation(editingId!, payload, () => getToken())
        : await createCommunityRotation(payload, () => getToken());
      setEditingId(item.id);
      setSourceAuthorId(item.authorId);
      setSourceTitle(item.title);
      setTitle(item.title);
      setDescription(item.description || "");
      setMetaOpen(false);
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2000);
      navigate(`/rotations/editor/${item.id}`, { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onSaveMeta = (event: FormEvent) => {
    event.preventDefault();
    setMetaOpen(false);
  };

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Rotation editor</h1>
          <div className="hero-actions">
            <Link to="/rotations" className="chip compact">
              All rotations
            </Link>
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
            <button
              type="button"
              className="chip compact"
              onClick={() => {
                setMetaOpen((open) => !open);
                setSaveError(null);
              }}
              aria-expanded={metaOpen}
            >
              Details
            </button>
            <button
              type="button"
              className="chip filled"
              disabled={saving}
              onClick={() => {
                void saveRotation();
              }}
            >
              {!isSignedIn
                ? "Sign in to save"
                : saving
                  ? "Saving…"
                  : saveOk
                    ? "Saved"
                    : isForking
                      ? "Save copy"
                      : isOwnRotation
                        ? "Save"
                        : "Publish"}
            </button>
          </div>
        </div>
        <p className="lede">
          {title.trim() ? (
            <>
              <span className="rotation-editor-title">{title.trim()}</span>
              {description.trim()
                ? ` — ${description.trim().slice(0, 120)}${description.trim().length > 120 ? "…" : ""}`
                : null}
            </>
          ) : (
            <>
              Sketch field time and buff overlays, then save when you&apos;re
              signed in.
            </>
          )}
          {isForking
            ? " This rotation belongs to someone else; saving publishes your own copy."
            : null}
        </p>
      </header>

      {metaOpen ? (
        <form className="rotation-meta-fields" onSubmit={onSaveMeta}>
          <p className="field-note">
            Title and description are metadata for the published post — not part
            of the timeline.
          </p>
          <label className="field">
            <span className="label">Name</span>
            <input
              ref={titleInputRef}
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hyperbloom Neuvillette"
              aria-label="Rotation name"
            />
          </label>
          <label className="field">
            <span className="label">Description</span>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for the community"
              aria-label="Rotation description"
            />
          </label>
          <div className="chip-row">
            <button
              type="button"
              className="chip compact"
              onClick={() => setMetaOpen(false)}
            >
              Done
            </button>
            <button
              type="button"
              className="chip filled"
              disabled={saving || !title.trim()}
              onClick={() => {
                void saveRotation();
              }}
            >
              {saving
                ? "Saving…"
                : isOwnRotation
                  ? "Save now"
                  : isForking
                    ? "Publish copy"
                    : "Publish"}
            </button>
          </div>
        </form>
      ) : null}

      {saveError ? <p className="auth-error">{saveError}</p> : null}

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

        {selectedPlacement ? (
          <ComboInspectPanel
            placement={selectedPlacement}
            switchBuffer={switchBuffer}
            onChange={setPlacements}
          />
        ) : null}

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
            onAdd={addCharacterToRotation}
            insertHint={
              insertAtIndexState == null
                ? null
                : `Inserting at position ${insertAtIndexState + 1} — tap + on a character`
            }
          />

          <PlacementRoster
            placements={placements}
            selectedId={selectedPlacementId}
            switchBuffer={switchBuffer}
            timingMode={timingMode}
            humanLag={humanLag}
            onSelect={selectPlacement}
            onChange={setPlacements}
            insertAtIndex={insertAtIndexState}
            onRequestInsertAt={setInsertAtIndexState}
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

export default function RotationsPage() {
  if (!clerkConfigured) {
    return (
      <>
        <header className="hero">
          <h1>Rotation editor</h1>
          <p className="lede">
            Auth is not configured, so publishing is unavailable. You can still
            sketch locally once Clerk keys are set.
          </p>
        </header>
        <Link to="/rotations" className="chip">
          Back
        </Link>
      </>
    );
  }
  return <RotationsEditorInner />;
}
