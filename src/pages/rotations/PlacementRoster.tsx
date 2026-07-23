import {
  getArtifactDurationOptions,
  isArtifactDurationId,
} from "./artifactDurationOptions";
import { setCastDrag } from "./CharacterPalette";
import { CharacterIcon } from "./CharacterIcon";
import { setCharacterDragImage } from "./dragGhost";
import { getCharacter } from "./characters";
import {
  getKitCooldownOptions,
  getKitEffectOptions,
  isOverlayDurationAdjusted,
  resolveOverlaySeconds,
  type DurationOption,
} from "./durationOptions";
import {
  defaultOnFieldDuration,
  effectiveCastTimes,
  getFieldCastTimings,
  hasSkillHold,
  kitHoldChannelSeconds,
  parseCastOrder,
  parseSkillVariant,
  clampSkillCasts,
  getSkillCharges,
  usesDiscreteSkillCharges,
  skillToggleLabel,
  skillVariantLabels,
  type CastOrder,
  type SkillCastVariant,
  type TimingMode,
} from "./fieldTimings";
import {
  comboStepsTotalSeconds,
  placementUsesComboSteps,
} from "./comboSequence";
import {
  MIN_ON_FIELD,
  reorderOnField,
  setOnFieldDuration,
  snapTime,
} from "./timelineContinuous";
import type { CharacterData, KitSkill, TimelinePlacement } from "./types";
import type { DragEvent, SetStateAction } from "react";
import { useRef, useState } from "react";

const joinClassNames = (
  ...parts: Array<string | false | null | undefined>
): string => {
  return parts.filter(Boolean).join(" ");
};

const kitHoldFor = (characterId: string): number | null => {
  return kitHoldChannelSeconds(
    getCharacter(characterId)?.kit.elementalSkill ?? null,
  );
};

const withCastDefaults = (p: TimelinePlacement): TimelinePlacement => {
  const kitHold = kitHoldFor(p.characterId);
  return {
    ...p,
    castSkill: p.castSkill ?? true,
    castBurst: p.castBurst ?? true,
    castOrder: parseCastOrder(p.castOrder),
    skillVariant: parseSkillVariant(p.skillVariant, p.characterId, kitHold),
    skillCasts: clampSkillCasts(p.skillCasts, p.characterId, kitHold),
    comboSteps: Array.isArray(p.comboSteps) ? p.comboSteps : [],
    activeDurations: p.activeDurations ?? [],
    durationOverrides: p.durationOverrides ?? {},
  };
};

const durationOpts = (
  p: TimelinePlacement,
  timingMode: TimingMode,
  humanLag: number,
) => {
  return {
    skill: p.castSkill,
    burst: p.castBurst,
    mode: timingMode,
    humanLag,
    skillVariant: p.skillVariant,
    skillCasts: p.skillCasts,
    kitHoldSeconds: kitHoldFor(p.characterId),
  };
};

interface PlacementRosterProps {
  placements: TimelinePlacement[];
  selectedId: string | null;
  switchBuffer: number;
  timingMode: TimingMode;
  humanLag: number;
  onSelect: (id: string) => void;
  onChange: (next: SetStateAction<TimelinePlacement[]>) => void;
  onRemove: (id: string) => void;
  insertAtIndex?: number | null;
  onRequestInsertAt?: (index: number | null) => void;
}

export const PlacementRoster = ({
  placements,
  selectedId,
  switchBuffer,
  timingMode,
  humanLag,
  onSelect,
  onChange,
  onRemove,
  insertAtIndex = null,
  onRequestInsertAt,
}: PlacementRosterProps) => {
  if (placements.length === 0) {
    return (
      <section className="rotation-roster" aria-label="Placed characters">
        <h2 className="rotation-section-title">On timeline</h2>
        <p className="field-note">
          Drop characters onto the timeline, or use + in the character list.
        </p>
      </section>
    );
  }

  const sorted = [...placements]
    .map(withCastDefaults)
    .sort((a, b) => a.start - b.start);
  const selected = sorted.find((p) => p.id === selectedId) ?? null;

  const updatePlacement = (id: string, patch: Partial<TimelinePlacement>) => {
    onChange((prev) =>
      prev.map((item) =>
        item.id === id ? withCastDefaults({ ...item, ...patch }) : item,
      ),
    );
  };

  const applyCastPatch = (id: string, patch: Partial<TimelinePlacement>) => {
    onChange((prev) => {
      const current = withCastDefaults(
        prev.find((item) => item.id === id) ?? selected!,
      );
      const next = withCastDefaults({ ...current, ...patch });
      const duration = defaultOnFieldDuration(
        next.characterId,
        durationOpts(next, timingMode, humanLag),
      );
      return setOnFieldDuration(
        prev.map((item) => (item.id === id ? next : item)),
        id,
        duration,
        switchBuffer,
      );
    });
    onSelect(id);
  };

  const resetDuration = (p: TimelinePlacement) => {
    const next = withCastDefaults(p);
    const duration = defaultOnFieldDuration(
      next.characterId,
      durationOpts(next, timingMode, humanLag),
    );
    onChange((prev) => setOnFieldDuration(prev, p.id, duration, switchBuffer));
  };

  const movePlacement = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const order = sorted.map((p) => p.id);
    const from = order.indexOf(fromId);
    const to = order.indexOf(toId);
    if (from === -1 || to === -1) return;
    onChange((prev) => reorderOnField(prev, fromId, to, switchBuffer));
    onSelect(fromId);
  };

  const handleResetSelectedDuration = () => {
    if (!selected) return;
    resetDuration(selected);
    onSelect(selected.id);
  };

  const handleSetDuration = (duration: number) => {
    if (!selected) return;
    onChange((prev) =>
      setOnFieldDuration(prev, selected.id, snapTime(duration), switchBuffer),
    );
    onSelect(selected.id);
  };

  const handleToggleDurationOverlay = (optionId: string) => {
    if (!selected) return;
    const on = selected.activeDurations.includes(optionId);
    if (on) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [optionId]: _removed, ...rest } = selected.durationOverrides;
      updatePlacement(selected.id, {
        activeDurations: selected.activeDurations.filter(
          (id) => id !== optionId,
        ),
        durationOverrides: rest,
      });
    } else {
      updatePlacement(selected.id, {
        activeDurations: [...selected.activeDurations, optionId],
      });
    }
    onSelect(selected.id);
  };

  const handleSetActiveDurations = (activeDurations: string[]) => {
    if (!selected) return;
    const keep = new Set(activeDurations);
    const durationOverrides = Object.fromEntries(
      Object.entries(selected.durationOverrides).filter(([id]) => keep.has(id)),
    );
    updatePlacement(selected.id, { activeDurations, durationOverrides });
    onSelect(selected.id);
  };

  const handleSetDurationOverride = (
    optionId: string,
    seconds: number | null,
  ) => {
    if (!selected) return;
    const next = { ...selected.durationOverrides };
    if (seconds == null) delete next[optionId];
    else next[optionId] = seconds;
    updatePlacement(selected.id, { durationOverrides: next });
    onSelect(selected.id);
  };

  const handleToggleCast = (key: "castSkill" | "castBurst", value: boolean) => {
    if (!selected) return;
    applyCastPatch(selected.id, { [key]: value });
  };

  const handleCastOrder = (castOrder: CastOrder) => {
    if (!selected) return;
    updatePlacement(selected.id, { castOrder });
    onSelect(selected.id);
  };

  const handleSkillVariant = (variant: SkillCastVariant) => {
    if (!selected) return;
    applyCastPatch(selected.id, {
      skillVariant: variant,
      castSkill: true,
    });
  };

  const handleSkillCasts = (skillCasts: number) => {
    if (!selected) return;
    applyCastPatch(selected.id, {
      skillCasts,
      castSkill: true,
    });
  };

  const requestInsert = (index: number) => {
    if (!onRequestInsertAt) return;
    onRequestInsertAt(insertAtIndex === index ? null : index);
  };

  return (
    <section className="rotation-roster" aria-label="Placed characters">
      <h2 className="rotation-section-title">On timeline</h2>
      <p className="field-note rotation-drag-hint">
        Drag pills to reorder. Use + gaps to insert a character.
      </p>
      <ul className="rotation-roster-list compact">
        {onRequestInsertAt ? (
          <li className="rotation-roster-insert-slot">
            <InsertGapButton
              active={insertAtIndex === 0}
              label="Insert at start"
              onClick={() => requestInsert(0)}
            />
          </li>
        ) : null}
        {sorted.map((p, index) => {
          const char = getCharacter(p.characterId);
          if (!char) return null;
          return (
            <li key={p.id} className="rotation-roster-item">
              <RosterPill
                placement={p}
                character={char}
                isSelected={selectedId === p.id}
                onSelect={onSelect}
                onMove={movePlacement}
              />
              {onRequestInsertAt ? (
                <InsertGapButton
                  active={insertAtIndex === index + 1}
                  label={`Insert after ${char.name}`}
                  onClick={() => requestInsert(index + 1)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {selected ? (
        <SelectedPlacementDetail
          placement={selected}
          timingMode={timingMode}
          humanLag={humanLag}
          onRemove={onRemove}
          onResetDuration={handleResetSelectedDuration}
          onSetDuration={handleSetDuration}
          onToggleDurationOverlay={handleToggleDurationOverlay}
          onSetActiveDurations={handleSetActiveDurations}
          onSetDurationOverride={handleSetDurationOverride}
          onToggleCast={handleToggleCast}
          onCastOrder={handleCastOrder}
          onSkillVariant={handleSkillVariant}
          onSkillCasts={handleSkillCasts}
        />
      ) : (
        <p className="field-note rotation-roster-hint">
          Select a character to edit.
        </p>
      )}
    </section>
  );
};

const InsertGapButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      className={joinClassNames(
        "rotation-roster-insert",
        active && "active",
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      +
    </button>
  );
};

const RosterPill = ({
  placement,
  character,
  isSelected,
  onSelect,
  onMove,
}: {
  placement: TimelinePlacement;
  character: CharacterData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (fromId: string, toId: string) => void;
}) => {
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      className={joinClassNames(
        "rotation-roster-pill",
        "is-draggable",
        isSelected && "selected",
        dragging && "dragging",
      )}
      data-element={character.element}
      draggable
      title="Drag to reorder"
      onDragStart={(e) => {
        e.dataTransfer.setData("text/placement-id", placement.id);
        e.dataTransfer.effectAllowed = "move";
        setCharacterDragImage(e, character);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const fromId = e.dataTransfer.getData("text/placement-id");
        if (fromId) onMove(fromId, placement.id);
      }}
      onClick={() => onSelect(placement.id)}
    >
      <span className="drag-affordance" aria-hidden>
        ⠿
      </span>
      <CharacterIcon
        character={character}
        className="rotation-roster-pill-icon"
      />
      <span className="rotation-roster-pill-name">{character.name}</span>
      <span className="rotation-roster-pill-dur">
        {placement.duration.toFixed(2)}s
      </span>
    </button>
  );
};

const SelectedPlacementDetail = ({
  placement,
  timingMode,
  humanLag,
  onRemove,
  onResetDuration,
  onSetDuration,
  onToggleDurationOverlay,
  onSetActiveDurations,
  onSetDurationOverride,
  onToggleCast,
  onCastOrder,
  onSkillVariant,
  onSkillCasts,
}: {
  placement: TimelinePlacement;
  timingMode: TimingMode;
  humanLag: number;
  onRemove: (id: string) => void;
  onResetDuration: () => void;
  onSetDuration: (duration: number) => void;
  onToggleDurationOverlay: (optionId: string) => void;
  onSetActiveDurations: (activeDurations: string[]) => void;
  onSetDurationOverride: (optionId: string, seconds: number | null) => void;
  onToggleCast: (key: "castSkill" | "castBurst", value: boolean) => void;
  onCastOrder: (order: CastOrder) => void;
  onSkillVariant: (variant: SkillCastVariant) => void;
  onSkillCasts: (casts: number) => void;
}) => {
  const char = getCharacter(placement.characterId);
  if (!char) return null;

  const kitHold = kitHoldChannelSeconds(char.kit.elementalSkill);
  const canHold = hasSkillHold(char.id, kitHold);
  const base = getFieldCastTimings(char.id, kitHold);
  const pairLabels = skillVariantLabels(base.skillPairStyle ?? "hold");
  const skillLabel = skillToggleLabel(char.id, kitHold);
  const effective = effectiveCastTimes(
    char.id,
    timingMode,
    humanLag,
    placement.skillVariant,
    kitHold,
  );
  const combo = !!effective.comboIncludesBurst;
  const kitOptions = getKitEffectOptions(char);
  const cooldownOptions = getKitCooldownOptions(char);
  const artifactOptions = getArtifactDurationOptions(char);
  const selectedArtifactId =
    placement.activeDurations.find((id) =>
      artifactOptions.some((o) => o.id === id),
    ) ?? "";
  const adjustableOptions = [
    ...kitOptions.filter((o) => placement.activeDurations.includes(o.id)),
    ...artifactOptions.filter((o) => o.id === selectedArtifactId),
  ];
  const adjustedOverlays = adjustableOptions.filter((o) =>
    isOverlayDurationAdjusted(o, placement.durationOverrides),
  );
  const defaultDur = defaultOnFieldDuration(
    char.id,
    durationOpts(placement, timingMode, humanLag),
  );
  const isDefault = Math.abs(placement.duration - defaultDur) < 0.005;
  const actionsDur = comboStepsTotalSeconds(char.id, placement.comboSteps);
  const hasActions = placementUsesComboSteps(placement) && actionsDur > 0;
  const fitsActions =
    hasActions && Math.abs(placement.duration - actionsDur) < 0.005;
  const frameSkill =
    placement.skillVariant === "hold" && base.skillHoldCast != null
      ? base.skillHoldCast
      : base.skillCast;

  const setArtifactOverlay = (optionId: string) => {
    const withoutArtifacts = placement.activeDurations.filter(
      (id) => !isArtifactDurationId(id),
    );
    onSetActiveDurations(
      optionId ? [...withoutArtifacts, optionId] : withoutArtifacts,
    );
  };

  const handleOnFieldChange = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onSetDuration(raw);
  };

  const handleFitToActions = () => {
    if (!hasActions) return;
    onSetDuration(actionsDur);
  };

  return (
    <article className="rotation-selected-detail" data-element={char.element}>
      <div className="rotation-selected-head">
        <CharacterIcon character={char} className="rotation-roster-icon" />
        <div className="rotation-roster-copy">
          <h3 className="rotation-roster-name">{char.name}</h3>
          <p className="rotation-roster-meta">
            {placement.start.toFixed(2)}s –{" "}
            {(placement.start + placement.duration).toFixed(2)}s
          </p>
        </div>
        <button
          type="button"
          className="chip compact"
          onClick={() => onRemove(placement.id)}
        >
          Remove
        </button>
      </div>

      <div className="rotation-selected-rows">
        <div className="rotation-selected-row">
          <span className="label">Casts</span>
          <CastControls
            placement={placement}
            characterId={char.id}
            skill={char.kit.elementalSkill}
            burst={char.kit.elementalBurst}
            kitHold={kitHold}
            canHold={canHold}
            base={base}
            pairLabels={pairLabels}
            combo={combo}
            skillLabel={skillLabel}
            effective={effective}
            frameSkill={frameSkill}
            timingMode={timingMode}
            humanLag={humanLag}
            onToggleCast={onToggleCast}
            onCastOrder={onCastOrder}
            onSkillVariant={onSkillVariant}
            onSkillCasts={onSkillCasts}
          />
        </div>

        <div className="rotation-selected-row">
          <span className="label">On-field</span>
          <div className="rotation-onfield-adjust">
            <input
              type="number"
              min={MIN_ON_FIELD}
              step={0.01}
              aria-label="On-field duration in seconds"
              value={placement.duration}
              onChange={(e) => handleOnFieldChange(Number(e.target.value))}
            />
            <span className="rotation-onfield-unit">s</span>
            <button
              type="button"
              className="chip compact"
              disabled={isDefault}
              title={`Reset to ${defaultDur.toFixed(2)}s`}
              onClick={onResetDuration}
            >
              Reset
            </button>
            <button
              type="button"
              className="chip compact"
              disabled={!hasActions || fitsActions}
              title={
                hasActions
                  ? `Resize on-field to ${actionsDur.toFixed(2)}s from inspect actions`
                  : "Add inspect actions first"
              }
              onClick={handleFitToActions}
            >
              Fit actions
            </button>
          </div>
        </div>

        {kitOptions.length > 0 ? (
          <div className="rotation-selected-row">
            <span className="label" id={`dur-kit-${placement.id}`}>
              Kit
            </span>
            <div
              className="chip-row wrap"
              role="group"
              aria-labelledby={`dur-kit-${placement.id}`}
            >
              {kitOptions.map((opt) => (
                <KitOverlayRow
                  key={opt.id}
                  option={opt}
                  active={placement.activeDurations.includes(opt.id)}
                  durationOverrides={placement.durationOverrides}
                  onToggle={onToggleDurationOverlay}
                  onSetDurationOverride={onSetDurationOverride}
                />
              ))}
            </div>
          </div>
        ) : null}

        {cooldownOptions.length > 0 ? (
          <div className="rotation-selected-row">
            <span className="label" id={`dur-cd-${placement.id}`}>
              CDs
            </span>
            <div
              className="chip-row wrap"
              role="group"
              aria-labelledby={`dur-cd-${placement.id}`}
            >
              {cooldownOptions.map((opt) => (
                <CooldownOverlayRow
                  key={opt.id}
                  option={opt}
                  active={placement.activeDurations.includes(opt.id)}
                  onToggle={onToggleDurationOverlay}
                />
              ))}
            </div>
          </div>
        ) : null}

        {artifactOptions.length > 0 ? (
          <ArtifactOverlayRow
            placementId={placement.id}
            options={artifactOptions}
            selectedArtifactId={selectedArtifactId}
            durationOverrides={placement.durationOverrides}
            onSelectArtifact={setArtifactOverlay}
            onSetDurationOverride={onSetDurationOverride}
          />
        ) : null}

        {adjustedOverlays.length > 0 ? (
          <p className="rotation-overlay-warning" role="status">
            Custom duration
            {adjustedOverlays.length > 1 ? "s" : ""} — kit/set lists{" "}
            {adjustedOverlays
              .map((o) => `${o.label} at ${o.seconds}s`)
              .join("; ")}
            . Only change these when something extends or delays the effect
            (e.g. holding Mona’s bubble until a normal attack pops it).
          </p>
        ) : null}
      </div>
    </article>
  );
};

const CastControls = ({
  placement,
  characterId,
  skill,
  burst,
  kitHold,
  canHold,
  base,
  pairLabels,
  combo,
  skillLabel,
  effective,
  frameSkill,
  timingMode,
  humanLag,
  onToggleCast,
  onCastOrder,
  onSkillVariant,
  onSkillCasts,
}: {
  placement: TimelinePlacement;
  characterId: string;
  skill: KitSkill | null;
  burst: KitSkill | null;
  kitHold: number | null;
  canHold: boolean;
  base: ReturnType<typeof getFieldCastTimings>;
  pairLabels: ReturnType<typeof skillVariantLabels>;
  combo: boolean;
  skillLabel: string;
  effective: ReturnType<typeof effectiveCastTimes>;
  frameSkill: number;
  timingMode: TimingMode;
  humanLag: number;
  onToggleCast: (key: "castSkill" | "castBurst", value: boolean) => void;
  onCastOrder: (order: CastOrder) => void;
  onSkillVariant: (variant: SkillCastVariant) => void;
  onSkillCasts: (casts: number) => void;
}) => {
  const dragMovedRef = useRef(false);
  const castKinds =
    placement.castOrder === "burst-first"
      ? (["burst", "skill"] as const)
      : (["skill", "burst"] as const);

  const pressEffective = effectiveCastTimes(
    characterId,
    timingMode,
    humanLag,
    "press",
    kitHold,
  );
  const holdEffective = effectiveCastTimes(
    characterId,
    timingMode,
    humanLag,
    "hold",
    kitHold,
  );

  const maxCharges = getSkillCharges(characterId, kitHold);
  const discreteCharges = usesDiscreteSkillCharges(
    characterId,
    kitHold,
    placement.skillVariant,
  );
  const skillCasts = clampSkillCasts(
    placement.skillCasts,
    characterId,
    kitHold,
  );
  const skillTotalSeconds = placement.castSkill
    ? effective.skillCast *
      (discreteCharges ? skillCasts : 1)
    : 0;

  const skillTitle = () => {
    const baseTitle = skill?.name
      ? `${skill.name} · frame ${frameSkill.toFixed(2)}s`
      : `${skillLabel} · frame ${frameSkill.toFixed(2)}s`;
    if (discreteCharges && maxCharges > 1) {
      return `${baseTitle} · ${skillCasts}/${maxCharges} charges · drag to timeline`;
    }
    return `${baseTitle} · drag to timeline`;
  };

  const burstTitle = () => {
    if (combo) {
      return "Expected on-field already weaves burst — this adds a standalone Burst · drag to timeline";
    }
    return burst?.name
      ? `${burst.name} · frame ${base.burstCast.toFixed(2)}s · drag to timeline`
      : `Burst · frame ${base.burstCast.toFixed(2)}s · drag to timeline`;
  };

  const toggleCastOrder = () => {
    onCastOrder(
      placement.castOrder === "burst-first" ? "skill-first" : "burst-first",
    );
  };

  const onCastDragStart = (e: DragEvent, kind: "skill" | "burst") => {
    dragMovedRef.current = true;
    setCastDrag(e, {
      characterId,
      kind,
      skillVariant: placement.skillVariant,
      skillCasts,
    });
  };

  const onCastDragEnd = () => {
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  const onCastClick = (key: "castSkill" | "castBurst", value: boolean) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    onToggleCast(key, value);
  };

  return (
    <div className="rotation-cast-stack">
      <div className="chip-row wrap" role="group" aria-label="Cast toggles">
        {castKinds.map((kind) =>
          kind === "skill" ? (
            <button
              key="skill"
              type="button"
              className={joinClassNames(
                "chip compact is-draggable",
                placement.castSkill && "active",
              )}
              draggable
              onDragStart={(e) => onCastDragStart(e, "skill")}
              onDragEnd={onCastDragEnd}
              onClick={() => onCastClick("castSkill", !placement.castSkill)}
              title={`${skillTitle()} · Drag onto timeline`}
            >
              <span className="drag-affordance compact" aria-hidden>
                ⠿
              </span>
              {skillLabel}
              {discreteCharges && skillCasts > 1 ? `×${skillCasts}` : ""}
              <span className="rotation-dur-chip-secs">
                {skillTotalSeconds.toFixed(2)}s
              </span>
            </button>
          ) : (
            <button
              key="burst"
              type="button"
              className={joinClassNames(
                "chip compact is-draggable",
                placement.castBurst && "active",
              )}
              draggable
              onDragStart={(e) => onCastDragStart(e, "burst")}
              onDragEnd={onCastDragEnd}
              onClick={() => onCastClick("castBurst", !placement.castBurst)}
              title={`${burstTitle()} · Drag onto timeline`}
            >
              <span className="drag-affordance compact" aria-hidden>
                ⠿
              </span>
              Burst
              <span className="rotation-dur-chip-secs">
                {effective.burstCast.toFixed(2)}s
              </span>
            </button>
          ),
        )}
        {placement.castSkill && placement.castBurst ? (
          <button
            type="button"
            className="chip compact"
            onClick={toggleCastOrder}
            title={
              placement.castOrder === "burst-first"
                ? "Cast order: Burst → Skill (click to swap)"
                : "Cast order: Skill → Burst (click to swap)"
            }
          >
            {placement.castOrder === "burst-first" ? "Q→E" : "E→Q"}
          </button>
        ) : null}
      </div>
      {discreteCharges && maxCharges > 1 ? (
        <div
          className="chip-row wrap"
          role="group"
          aria-label="Skill charges to use"
        >
          {Array.from({ length: maxCharges }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={joinClassNames(
                "chip compact",
                placement.castSkill && skillCasts === n && "active",
              )}
              disabled={!placement.castSkill}
              onClick={() => onSkillCasts(n)}
              title={`Use ${n} skill charge${n === 1 ? "" : "s"}`}
            >
              E×{n}
              <span className="rotation-dur-chip-secs">
                {(effective.skillCast * n).toFixed(2)}s
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {canHold ? (
        <div
          className="chip-row wrap"
          role="group"
          aria-label="Skill short or long option"
        >
          <button
            type="button"
            className={joinClassNames(
              "chip compact",
              placement.skillVariant === "press" && "active",
            )}
            disabled={!placement.castSkill}
            onClick={() => onSkillVariant("press")}
            title={`${pairLabels.press} · frame ${base.skillCast.toFixed(2)}s`}
          >
            {pairLabels.press}
            <span className="rotation-dur-chip-secs">
              {pressEffective.skillCast.toFixed(2)}s
            </span>
          </button>
          <button
            type="button"
            className={joinClassNames(
              "chip compact",
              placement.skillVariant === "hold" && "active",
            )}
            disabled={!placement.castSkill}
            onClick={() => onSkillVariant("hold")}
            title={`${pairLabels.hold} · frame ${(base.skillHoldCast ?? 0).toFixed(2)}s`}
          >
            {pairLabels.hold}
            <span className="rotation-dur-chip-secs">
              {holdEffective.skillCast.toFixed(2)}s
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

const OverlaySecondsInput = ({
  option,
  durationOverrides,
  warnKind,
  ariaLabel,
  onSetDurationOverride,
}: {
  option: DurationOption;
  durationOverrides: Record<string, number>;
  warnKind: "kit" | "set";
  ariaLabel: string;
  onSetDurationOverride: (optionId: string, seconds: number | null) => void;
}) => {
  const seconds = resolveOverlaySeconds(option, durationOverrides);
  const adjusted = isOverlayDurationAdjusted(option, durationOverrides);
  const defaultTitle =
    warnKind === "kit"
      ? `Kit default ${option.seconds}s`
      : `Set default ${option.seconds}s`;

  const handleChange = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onSetDurationOverride(
      option.id,
      Math.abs(raw - option.seconds) < 0.001 ? null : raw,
    );
  };

  return (
    <label className={joinClassNames("rotation-overlay-secs", adjusted && "adjusted")}>
      <input
        type="number"
        min={0.5}
        max={60}
        step={0.5}
        aria-label={ariaLabel}
        value={seconds}
        onChange={(e) => handleChange(Number(e.target.value))}
      />
      <span>s</span>
      {adjusted ? (
        <span className="rotation-overlay-warn-tag" title={defaultTitle}>
          {warnKind} {option.seconds}s
        </span>
      ) : null}
    </label>
  );
};

const KitOverlayRow = ({
  option,
  active,
  durationOverrides,
  onToggle,
  onSetDurationOverride,
}: {
  option: DurationOption;
  active: boolean;
  durationOverrides: Record<string, number>;
  onToggle: (optionId: string) => void;
  onSetDurationOverride: (optionId: string, seconds: number | null) => void;
}) => {
  const adjusted = isOverlayDurationAdjusted(option, durationOverrides);

  return (
    <div className="rotation-overlay-ctrl">
      <button
        type="button"
        className={joinClassNames("chip compact", active && "active")}
        title={`${option.skillName} · after ${option.trigger ?? option.source}${
          adjusted ? ` · kit ${option.seconds}s` : ""
        }`}
        onClick={() => onToggle(option.id)}
      >
        {option.label}
        {!active ? (
          <span className="rotation-dur-chip-secs">{option.seconds}s</span>
        ) : null}
      </button>
      {active ? (
        <OverlaySecondsInput
          option={option}
          durationOverrides={durationOverrides}
          warnKind="kit"
          ariaLabel={`${option.label} duration`}
          onSetDurationOverride={onSetDurationOverride}
        />
      ) : null}
    </div>
  );
};

const CooldownOverlayRow = ({
  option,
  active,
  onToggle,
}: {
  option: DurationOption;
  active: boolean;
  onToggle: (optionId: string) => void;
}) => {
  return (
    <button
      type="button"
      className={joinClassNames("chip compact", active && "active")}
      title={`${option.skillName} · CD from cast start`}
      onClick={() => onToggle(option.id)}
    >
      {option.label}
      <span className="rotation-dur-chip-secs">{option.seconds}s</span>
    </button>
  );
};

const ArtifactOverlayRow = ({
  placementId,
  options,
  selectedArtifactId,
  durationOverrides,
  onSelectArtifact,
  onSetDurationOverride,
}: {
  placementId: string;
  options: DurationOption[];
  selectedArtifactId: string;
  durationOverrides: Record<string, number>;
  onSelectArtifact: (optionId: string) => void;
  onSetDurationOverride: (optionId: string, seconds: number | null) => void;
}) => {
  const selectedOption = options.find((o) => o.id === selectedArtifactId);

  return (
    <div className="rotation-selected-row">
      <span className="label" id={`dur-art-${placementId}`}>
        Artifact
      </span>
      <div className="rotation-artifact-row">
        <select
          className="rotation-artifact-select"
          aria-labelledby={`dur-art-${placementId}`}
          value={selectedArtifactId}
          onChange={(e) => onSelectArtifact(e.target.value)}
        >
          <option value="">None</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id} title={opt.skillName}>
              {opt.skillName} · {opt.seconds}s
            </option>
          ))}
        </select>
        {selectedOption ? (
          <OverlaySecondsInput
            option={selectedOption}
            durationOverrides={durationOverrides}
            warnKind="set"
            ariaLabel={`${selectedOption.skillName} duration`}
            onSetDurationOverride={onSetDurationOverride}
          />
        ) : null}
      </div>
    </div>
  );
};
