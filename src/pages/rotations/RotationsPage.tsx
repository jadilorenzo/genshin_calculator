import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.ts";
import { useLocalStorage } from "../../hooks/useLocalStorage.ts";
import { useUndoableLocalStorage } from "../../hooks/useUndoableLocalStorage.ts";
import { CharacterPalette } from "./CharacterPalette";
import {
  createCommunityRotation,
  deleteCommunityRotation,
  getCommunityRotation,
  updateCommunityRotation,
} from "./communityApi";
import { PlacementRoster } from "./PlacementRoster";
import { AuraSimPanel } from "./AuraSimPanel";
import { ComboInspectPanel } from "./ComboInspectPanel";
import { DeferredNumberInput } from "./DeferredNumberInput";
import {
  initialComboStepsForPlacement,
  initialOnFieldDuration,
} from "./comboSequence";
import {
  MAX_HUMAN_LAG,
  MIN_HUMAN_LAG,
  clampHumanLag,
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
    prev.humanLag !== next.humanLag ||
    prev.showAuraMarkers !== next.showAuraMarkers
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
  const [searchParams] = useSearchParams();
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
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [autoSave, setAutoSave] = useLocalStorage(
    "gc:rotations:autoSave",
    true,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(rotationId ?? null);
  const [sourceAuthorId, setSourceAuthorId] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [insertAtIndexState, setInsertAtIndexState] = useState<number | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const loadedRemoteRef = useRef<string | null>(null);
  const suppressAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!metaOpen) return;
    const frame = requestAnimationFrame(() => {
      titleInputRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMetaOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [metaOpen]);

  useEffect(() => {
    suppressAutoSaveRef.current = true;
    const timer = window.setTimeout(() => {
      suppressAutoSaveRef.current = false;
    }, 900);
    return () => window.clearTimeout(timer);
  }, [editingId, rotationId]);

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
        setIsPublic(item.isPublic !== false);
        skipNextHistory();
        setDoc({
          ...defaultRotationDoc(),
          ...(item.doc as Partial<RotationDoc>),
          placements: Array.isArray((item.doc as RotationDoc)?.placements)
            ? (item.doc as RotationDoc).placements
            : [],
          showAuraMarkers:
            (item.doc as Partial<RotationDoc>)?.showAuraMarkers !== false,
        });
      } catch (err) {
        if (!cancelled) {
          const detail =
            err instanceof Error && err.message
              ? err.message
              : "Could not load that rotation.";
          setSaveError(detail);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, rotationId, setDoc, skipNextHistory]);

  const {
    placements,
    switchBuffer,
    timingMode,
    humanLag,
    showAuraMarkers,
  } = doc;

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

  const resetEditor = useCallback(() => {
    skipNextHistory();
    setDoc(defaultRotationDoc());
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setEditingId(null);
    setSourceAuthorId(null);
    setSourceTitle("");
    setSelectedPlacementId(null);
    setSelectedCharacterId(null);
    setInsertAtIndexState(null);
    setSaveError(null);
    setSaveOk(false);
    setMetaOpen(false);
    loadedRemoteRef.current = null;
  }, [setDoc, skipNextHistory]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    resetEditor();
    navigate("/rotations/editor", { replace: true });
  }, [navigate, resetEditor, searchParams]);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileHintDismissed, setMobileHintDismissed] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useLocalStorage(
    "gc:rotations:rightPanelWidth:v2",
    380,
  );
  const rightResizeRef = useRef<{
    startX: number;
    startWidth: number;
    pointerId: number;
  } | null>(null);
  const leftPanelId = useId();
  const rightPanelId = useId();
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

  const clampRightPanelWidth = useCallback((width: number) => {
    const max = Math.max(240, Math.floor(window.innerWidth * 0.55));
    return Math.min(max, Math.max(240, Math.round(width)));
  }, []);

  const onRightResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || !rightOpen) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    rightResizeRef.current = {
      startX: event.clientX,
      startWidth: rightPanelWidth,
      pointerId: event.pointerId,
    };
    document.body.classList.add("rotation-editor-resizing");
  };

  const onRightResizePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = rightResizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Dragging the left edge: move left → wider panel.
    setRightPanelWidth(
      clampRightPanelWidth(drag.startWidth + (drag.startX - event.clientX)),
    );
  };

  const endRightResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = rightResizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    rightResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove("rotation-editor-resizing");
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
      showOffFieldApplications: false,
      showNightsoulFill: false,
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

  const saveRotation = async (opts?: { closeMeta?: boolean }) => {
    const closeMeta = opts?.closeMeta !== false;
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
      setSaveError("Add a name in Rotation details before saving.");
      requestAnimationFrame(() =>
        titleInputRef.current?.focus({ preventScroll: true }),
      );
      return;
    }

    if (doc.placements.length === 0) {
      setSaveError("Add at least one character before saving.");
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
        isPublic,
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
      setIsPublic(item.isPublic !== false);
      if (closeMeta) setMetaOpen(false);
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2000);
      navigate(`/rotations/editor/${item.id}`, { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!autoSave) return;
    if (!isOwnRotation || !isSignedIn || !clerkConfigured) return;
    if (!title.trim() || doc.placements.length === 0) return;
    if (suppressAutoSaveRef.current || deleting || saving) return;

    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveRotation({ closeMeta: false });
    }, 10_000);

    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
    // Intentionally depend on the editable payload; saveRotation closes over latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce autosave on content edits
  }, [
    autoSave,
    isOwnRotation,
    isSignedIn,
    title,
    description,
    isPublic,
    doc,
    deleting,
    saving,
  ]);

  const onSaveMeta = (event: FormEvent) => {
    event.preventDefault();
    setMetaOpen(false);
  };

  const deleteRotation = async () => {
    const message = isOwnRotation
      ? "Delete this published rotation permanently? This cannot be undone."
      : "Delete this rotation from the editor? This cannot be undone.";
    if (!window.confirm(message)) return;

    setDeleting(true);
    setSaveError(null);
    try {
      if (isOwnRotation && editingId) {
        if (!isSignedIn) {
          navigate("/sign-in");
          return;
        }
        await deleteCommunityRotation(editingId, () => getToken());
      }
      resetEditor();
      navigate("/rotations/editor", { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rotation-editor-page">
      <header className="rotation-editor-bar">
        <div className="rotation-editor-bar-leading">
          <Link to="/rotations" className="chip compact">
            Return to rotations
          </Link>
          <div className="rotation-editor-bar-titles">
            <h1>Editor</h1>
            {title.trim() ? (
              <p className="rotation-editor-bar-sub">
                <span className="rotation-editor-title">{title.trim()}</span>
                {description.trim()
                  ? ` — ${description.trim().slice(0, 80)}${description.trim().length > 80 ? "…" : ""}`
                  : null}
              </p>
            ) : (
              <p className="rotation-editor-bar-sub">
                Sketch field time and buffs
                {isForking ? " · saving publishes your copy" : null}
              </p>
            )}
          </div>
        </div>
        <div className="rotation-editor-bar-actions">
          <button
            type="button"
            className="chip compact"
            onClick={() => {
              setMetaOpen((open) => !open);
              setSaveError(null);
            }}
            aria-expanded={metaOpen}
          >
            Rotation details
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
              ? "Sign in"
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
      </header>

      {metaOpen
        ? createPortal(
            <div
              className="rotation-meta-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setMetaOpen(false);
              }}
            >
              <div
                className="rotation-meta-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rotation-meta-dialog-title"
              >
                <form
                  className="rotation-meta-dialog-body"
                  onSubmit={onSaveMeta}
                >
                  <div className="rotation-meta-dialog-scroll">
                    <div className="rotation-meta-dialog-head">
                      <h2
                        id="rotation-meta-dialog-title"
                        className="rotation-section-title"
                      >
                        Rotation details
                      </h2>
                      <button
                        type="button"
                        className="chip compact"
                        onClick={() => setMetaOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <p className="field-note">
                      Title and description are metadata for the published post.
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
                        rows={3}
                        maxLength={500}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional notes for the community"
                        aria-label="Rotation description"
                      />
                    </label>

                    <div className="rotation-meta-section">
                      <p className="rotation-meta-section-title">Timing</p>
                      <label className="field">
                        <span className="label">Switch buffer (s)</span>
                        <DeferredNumberInput
                          min={0}
                          max={1.5}
                          step={0.01}
                          value={switchBuffer}
                          onCommit={updateSwitchBuffer}
                          aria-label="Switch buffer in seconds"
                        />
                      </label>
                      <div
                        className="field"
                        role="group"
                        aria-label="Cast timing mode"
                      >
                        <span className="label">Cast timings</span>
                        <div className="chip-row">
                          <button
                            type="button"
                            className={
                              timingMode === "frame"
                                ? "chip compact active"
                                : "chip compact"
                            }
                            onClick={() =>
                              setDoc((prev) => ({
                                ...prev,
                                timingMode: "frame",
                              }))
                            }
                          >
                            Frame
                          </button>
                          <button
                            type="button"
                            className={
                              timingMode === "human"
                                ? "chip compact active"
                                : "chip compact"
                            }
                            onClick={() =>
                              setDoc((prev) => ({
                                ...prev,
                                timingMode: "human",
                              }))
                            }
                          >
                            Human
                          </button>
                        </div>
                      </div>
                      {timingMode === "human" ? (
                        <label className="field">
                          <span className="label">Human lag / cast (s)</span>
                          <DeferredNumberInput
                            min={MIN_HUMAN_LAG}
                            max={MAX_HUMAN_LAG}
                            step={0.01}
                            value={humanLag}
                            onCommit={(n) =>
                              setDoc((prev) => ({
                                ...prev,
                                humanLag: clampHumanLag(n),
                              }))
                            }
                            aria-label="Human lag per cast in seconds"
                          />
                        </label>
                      ) : null}
                    </div>

                    <label className="rotation-meta-public">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                      />
                      <span>
                        <strong>Public</strong>
                        <span className="field-note">
                          Listed on community Rotations. Uncheck to keep it only
                          on My rotations.
                        </span>
                      </span>
                    </label>
                    <label className="rotation-meta-public">
                      <input
                        type="checkbox"
                        checked={autoSave}
                        onChange={(e) => setAutoSave(e.target.checked)}
                      />
                      <span>
                        <strong>Auto-save</strong>
                        <span className="field-note">
                          Save edits to your published rotation automatically.
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="chip-row rotation-meta-actions">
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
                      disabled={saving || deleting || !title.trim()}
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
                    <button
                      type="button"
                      className="chip compact rotation-meta-delete"
                      disabled={deleting || saving}
                      onClick={() => {
                        void deleteRotation();
                      }}
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {saveError ? <p className="auth-error rotation-editor-error">{saveError}</p> : null}

      {mobileHintDismissed ? null : (
        <aside className="rotation-editor-mobile-hint" role="note">
          <p>
            This editor is built for a larger screen. For dragging onto the
            timeline and using both side panels, open it on a computer or tablet.
          </p>
          <button
            type="button"
            className="chip compact"
            onClick={() => setMobileHintDismissed(true)}
          >
            Dismiss
          </button>
        </aside>
      )}

      <div className="rotation-editor-shell">
        <aside
          className={
            leftOpen
              ? "rotation-editor-sidebar left"
              : "rotation-editor-sidebar left collapsed"
          }
        >
          <div
            className="rotation-editor-sidebar-body"
            id={leftPanelId}
            hidden={!leftOpen}
          >
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
          </div>
          <button
            type="button"
            className="rotation-editor-sidebar-fab"
            aria-expanded={leftOpen}
            aria-controls={leftPanelId}
            title={leftOpen ? "Hide characters" : "Show characters"}
            onClick={() => setLeftOpen((v) => !v)}
          >
            <span className="visually-hidden">
              {leftOpen ? "Hide" : "Show"} character list
            </span>
            <span aria-hidden>{leftOpen ? "‹" : "›"}</span>
          </button>
        </aside>

        <main className="rotation-editor-main">
          <RotationTimeline
            placements={placements}
            onChange={setPlacements}
            selectedId={selectedPlacementId}
            switchBuffer={switchBuffer}
            timingMode={timingMode}
            humanLag={humanLag}
            showAuraMarkers={showAuraMarkers}
            onShowAuraMarkersChange={(value) =>
              setDoc((prev) => ({ ...prev, showAuraMarkers: value }))
            }
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

          <AuraSimPanel placements={placements} />
        </main>

        <aside
          className={
            rightOpen
              ? "rotation-editor-sidebar right"
              : "rotation-editor-sidebar right collapsed"
          }
        >
          {rightOpen ? (
            <div
              className="rotation-editor-sidebar-resize"
              role="separator"
              aria-orientation="vertical"
              aria-controls={rightPanelId}
              aria-valuenow={rightPanelWidth}
              aria-valuemin={240}
              aria-label="Resize roster panel"
              title="Drag to resize"
              onPointerDown={onRightResizePointerDown}
              onPointerMove={onRightResizePointerMove}
              onPointerUp={endRightResize}
              onPointerCancel={endRightResize}
            />
          ) : null}
          <div
            className="rotation-editor-sidebar-body"
            id={rightPanelId}
            hidden={!rightOpen}
            style={
              rightOpen
                ? { width: rightPanelWidth, maxWidth: "none" }
                : undefined
            }
          >
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
          <button
            type="button"
            className="rotation-editor-sidebar-fab"
            aria-expanded={rightOpen}
            aria-controls={rightPanelId}
            title={rightOpen ? "Hide roster" : "Show roster"}
            onClick={() => setRightOpen((v) => !v)}
          >
            <span className="visually-hidden">
              {rightOpen ? "Hide" : "Show"} placement roster
            </span>
            <span aria-hidden>{rightOpen ? "›" : "‹"}</span>
          </button>
        </aside>
      </div>
    </div>
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
