import {
  getArtifactDurationOptions,
  isArtifactDurationId,
} from './artifactDurationOptions'
import { CharacterIcon } from './CharacterIcon'
import { getCharacter } from './characters'
import {
  getKitCooldownOptions,
  getKitEffectOptions,
  isOverlayDurationAdjusted,
  resolveOverlaySeconds,
} from './durationOptions'
import {
  defaultOnFieldDuration,
  effectiveCastTimes,
  getFieldCastTimings,
  hasSkillHold,
  kitHoldChannelSeconds,
  parseCastOrder,
  parseSkillVariant,
  skillToggleLabel,
  skillVariantLabels,
  type CastOrder,
  type SkillCastVariant,
  type TimingMode,
} from './fieldTimings'
import {
  MIN_ON_FIELD,
  setOnFieldDuration,
  snapTime,
} from './timelineContinuous'
import type { TimelinePlacement } from './types'

function kitHoldFor(characterId: string): number | null {
  return kitHoldChannelSeconds(getCharacter(characterId)?.kit.elementalSkill ?? null)
}

function withCastDefaults(p: TimelinePlacement): TimelinePlacement {
  const kitHold = kitHoldFor(p.characterId)
  return {
    ...p,
    castSkill: p.castSkill ?? true,
    castBurst: p.castBurst ?? true,
    castOrder: parseCastOrder(p.castOrder),
    skillVariant: parseSkillVariant(p.skillVariant, p.characterId, kitHold),
    activeDurations: p.activeDurations ?? [],
    durationOverrides: p.durationOverrides ?? {},
  }
}

function durationOpts(p: TimelinePlacement, timingMode: TimingMode, humanLag: number) {
  return {
    skill: p.castSkill,
    burst: p.castBurst,
    mode: timingMode,
    humanLag,
    skillVariant: p.skillVariant,
    kitHoldSeconds: kitHoldFor(p.characterId),
  }
}

interface PlacementRosterProps {
  placements: TimelinePlacement[]
  selectedId: string | null
  switchBuffer: number
  timingMode: TimingMode
  humanLag: number
  onSelect: (id: string) => void
  onChange: (next: TimelinePlacement[]) => void
  onRemove: (id: string) => void
}

export function PlacementRoster({
  placements,
  selectedId,
  switchBuffer,
  timingMode,
  humanLag,
  onSelect,
  onChange,
  onRemove,
}: PlacementRosterProps) {
  if (placements.length === 0) {
    return (
      <section className="rotation-roster" aria-label="Placed characters">
        <h2 className="rotation-section-title">On timeline</h2>
        <p className="field-note">Drop characters onto the timeline.</p>
      </section>
    )
  }

  const sorted = [...placements].map(withCastDefaults).sort((a, b) => a.start - b.start)
  const selected = sorted.find((p) => p.id === selectedId) ?? null

  function updatePlacement(id: string, patch: Partial<TimelinePlacement>) {
    onChange(
      placements.map((item) =>
        item.id === id ? withCastDefaults({ ...item, ...patch }) : item,
      ),
    )
  }

  function applyCastPatch(id: string, patch: Partial<TimelinePlacement>) {
    const current = withCastDefaults(
      placements.find((item) => item.id === id) ?? selected!,
    )
    const next = withCastDefaults({ ...current, ...patch })
    const duration = defaultOnFieldDuration(
      next.characterId,
      durationOpts(next, timingMode, humanLag),
    )
    onChange(
      setOnFieldDuration(
        placements.map((item) => (item.id === id ? next : item)),
        id,
        duration,
        switchBuffer,
      ),
    )
    onSelect(id)
  }

  function resetDuration(p: TimelinePlacement) {
    const next = withCastDefaults(p)
    const duration = defaultOnFieldDuration(
      next.characterId,
      durationOpts(next, timingMode, humanLag),
    )
    onChange(setOnFieldDuration(placements, p.id, duration, switchBuffer))
  }

  return (
    <section className="rotation-roster" aria-label="Placed characters">
      <h2 className="rotation-section-title">On timeline</h2>
      <ul className="rotation-roster-list compact">
        {sorted.map((p) => {
          const char = getCharacter(p.characterId)
          if (!char) return null
          const isSelected = selectedId === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                className={
                  isSelected
                    ? 'rotation-roster-pill selected'
                    : 'rotation-roster-pill'
                }
                data-element={char.element}
                onClick={() => onSelect(p.id)}
              >
                <CharacterIcon character={char} className="rotation-roster-pill-icon" />
                <span className="rotation-roster-pill-name">{char.name}</span>
                <span className="rotation-roster-pill-dur">{p.duration.toFixed(2)}s</span>
              </button>
            </li>
          )
        })}
      </ul>

      {selected ? (
        <SelectedPlacementDetail
          placement={selected}
          timingMode={timingMode}
          humanLag={humanLag}
          onRemove={onRemove}
          onResetDuration={() => {
            resetDuration(selected)
            onSelect(selected.id)
          }}
          onSetDuration={(duration) => {
            onChange(
              setOnFieldDuration(
                placements,
                selected.id,
                snapTime(duration),
                switchBuffer,
              ),
            )
            onSelect(selected.id)
          }}
          onToggleDurationOverlay={(optionId) => {
            const on = selected.activeDurations.includes(optionId)
            if (on) {
              const { [optionId]: _removed, ...rest } =
                selected.durationOverrides
              updatePlacement(selected.id, {
                activeDurations: selected.activeDurations.filter(
                  (id) => id !== optionId,
                ),
                durationOverrides: rest,
              })
            } else {
              updatePlacement(selected.id, {
                activeDurations: [...selected.activeDurations, optionId],
              })
            }
            onSelect(selected.id)
          }}
          onSetActiveDurations={(activeDurations) => {
            const keep = new Set(activeDurations)
            const durationOverrides = Object.fromEntries(
              Object.entries(selected.durationOverrides).filter(([id]) =>
                keep.has(id),
              ),
            )
            updatePlacement(selected.id, { activeDurations, durationOverrides })
            onSelect(selected.id)
          }}
          onSetDurationOverride={(optionId, seconds) => {
            const next = { ...selected.durationOverrides }
            if (seconds == null) delete next[optionId]
            else next[optionId] = seconds
            updatePlacement(selected.id, { durationOverrides: next })
            onSelect(selected.id)
          }}
          onToggleCast={(key, value) => {
            applyCastPatch(selected.id, { [key]: value })
          }}
          onCastOrder={(castOrder) => {
            updatePlacement(selected.id, { castOrder })
            onSelect(selected.id)
          }}
          onSkillVariant={(variant) => {
            applyCastPatch(selected.id, {
              skillVariant: variant,
              castSkill: true,
            })
          }}
        />
      ) : (
        <p className="field-note rotation-roster-hint">Select a character to edit.</p>
      )}
    </section>
  )
}

function SelectedPlacementDetail({
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
}: {
  placement: TimelinePlacement
  timingMode: TimingMode
  humanLag: number
  onRemove: (id: string) => void
  onResetDuration: () => void
  onSetDuration: (duration: number) => void
  onToggleDurationOverlay: (optionId: string) => void
  onSetActiveDurations: (activeDurations: string[]) => void
  onSetDurationOverride: (optionId: string, seconds: number | null) => void
  onToggleCast: (key: 'castSkill' | 'castBurst', value: boolean) => void
  onCastOrder: (order: CastOrder) => void
  onSkillVariant: (variant: SkillCastVariant) => void
}) {
  const char = getCharacter(placement.characterId)
  if (!char) return null

  const kitHold = kitHoldChannelSeconds(char.kit.elementalSkill)
  const canHold = hasSkillHold(char.id, kitHold)
  const base = getFieldCastTimings(char.id, kitHold)
  const pairLabels = skillVariantLabels(base.skillPairStyle ?? 'hold')
  const combo = !!base.comboIncludesBurst
  const skillLabel = skillToggleLabel(char.id, kitHold)
  const effective = effectiveCastTimes(
    char.id,
    timingMode,
    humanLag,
    placement.skillVariant,
    kitHold,
  )
  const kitOptions = getKitEffectOptions(char)
  const cooldownOptions = getKitCooldownOptions(char)
  const artifactOptions = getArtifactDurationOptions(char)
  const selectedArtifactId =
    placement.activeDurations.find((id) =>
      artifactOptions.some((o) => o.id === id),
    ) ?? ''
  const adjustableOptions = [
    ...kitOptions.filter((o) => placement.activeDurations.includes(o.id)),
    ...artifactOptions.filter((o) => o.id === selectedArtifactId),
  ]
  const adjustedOverlays = adjustableOptions.filter((o) =>
    isOverlayDurationAdjusted(o, placement.durationOverrides),
  )
  const skill = char.kit.elementalSkill
  const burst = char.kit.elementalBurst
  const defaultDur = defaultOnFieldDuration(
    char.id,
    durationOpts(placement, timingMode, humanLag),
  )
  const isDefault = Math.abs(placement.duration - defaultDur) < 0.005
  const frameSkill =
    placement.skillVariant === 'hold' && base.skillHoldCast != null
      ? base.skillHoldCast
      : base.skillCast

  function setArtifactOverlay(optionId: string) {
    const withoutArtifacts = placement.activeDurations.filter(
      (id) => !isArtifactDurationId(id),
    )
    onSetActiveDurations(
      optionId ? [...withoutArtifacts, optionId] : withoutArtifacts,
    )
  }

  return (
    <article
      className="rotation-selected-detail"
      data-element={char.element}
    >
      <div className="rotation-selected-head">
        <CharacterIcon character={char} className="rotation-roster-icon" />
        <div className="rotation-roster-copy">
          <h3 className="rotation-roster-name">{char.name}</h3>
          <p className="rotation-roster-meta">
            {placement.start.toFixed(2)}s –{' '}
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
          <div className="rotation-cast-stack">
            <div className="chip-row wrap" role="group" aria-label="Cast toggles">
              {(placement.castOrder === 'burst-first'
                ? (['burst', 'skill'] as const)
                : (['skill', 'burst'] as const)
              ).map((kind) =>
                kind === 'skill' ? (
                  <button
                    key="skill"
                    type="button"
                    className={
                      placement.castSkill ? 'chip compact active' : 'chip compact'
                    }
                    onClick={() =>
                      onToggleCast('castSkill', !placement.castSkill)
                    }
                    title={
                      skill?.name
                        ? `${skill.name} · frame ${frameSkill.toFixed(2)}s`
                        : `${skillLabel} · frame ${frameSkill.toFixed(2)}s`
                    }
                  >
                    {skillLabel}
                    <span className="rotation-dur-chip-secs">
                      {effective.skillCast.toFixed(2)}s
                    </span>
                  </button>
                ) : (
                  <button
                    key="burst"
                    type="button"
                    className={
                      placement.castBurst ? 'chip compact active' : 'chip compact'
                    }
                    onClick={() =>
                      onToggleCast('castBurst', !placement.castBurst)
                    }
                    title={
                      combo
                        ? 'Extra standalone burst (combo already includes woven bursts)'
                        : burst?.name
                          ? `${burst.name} · frame ${base.burstCast.toFixed(2)}s`
                          : `Burst · frame ${base.burstCast.toFixed(2)}s`
                    }
                  >
                    Burst
                    <span className="rotation-dur-chip-secs">
                      {effective.burstCast.toFixed(2)}s
                    </span>
                  </button>
                ),
              )}
              {placement.castSkill && placement.castBurst && !combo ? (
                <button
                  type="button"
                  className="chip compact"
                  onClick={() =>
                    onCastOrder(
                      placement.castOrder === 'burst-first'
                        ? 'skill-first'
                        : 'burst-first',
                    )
                  }
                  title={
                    placement.castOrder === 'burst-first'
                      ? 'Cast order: Burst → Skill (click to swap)'
                      : 'Cast order: Skill → Burst (click to swap)'
                  }
                >
                  {placement.castOrder === 'burst-first' ? 'Q→E' : 'E→Q'}
                </button>
              ) : null}
            </div>
            {canHold ? (
              <div
                className="chip-row wrap"
                role="group"
                aria-label="Skill short or long option"
              >
                <button
                  type="button"
                  className={
                    placement.skillVariant === 'press'
                      ? 'chip compact active'
                      : 'chip compact'
                  }
                  disabled={!placement.castSkill}
                  onClick={() => onSkillVariant('press')}
                  title={`${pairLabels.press} · frame ${base.skillCast.toFixed(2)}s`}
                >
                  {pairLabels.press}
                  <span className="rotation-dur-chip-secs">
                    {effectiveCastTimes(
                      char.id,
                      timingMode,
                      humanLag,
                      'press',
                      kitHold,
                    ).skillCast.toFixed(2)}
                    s
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    placement.skillVariant === 'hold'
                      ? 'chip compact active'
                      : 'chip compact'
                  }
                  disabled={!placement.castSkill}
                  onClick={() => onSkillVariant('hold')}
                  title={`${pairLabels.hold} · frame ${(base.skillHoldCast ?? 0).toFixed(2)}s`}
                >
                  {pairLabels.hold}
                  <span className="rotation-dur-chip-secs">
                    {effectiveCastTimes(
                      char.id,
                      timingMode,
                      humanLag,
                      'hold',
                      kitHold,
                    ).skillCast.toFixed(2)}
                    s
                  </span>
                </button>
              </div>
            ) : null}
          </div>
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
              onChange={(e) => {
                const raw = Number(e.target.value)
                if (!Number.isFinite(raw)) return
                onSetDuration(raw)
              }}
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
              {kitOptions.map((opt) => {
                const on = placement.activeDurations.includes(opt.id)
                const seconds = resolveOverlaySeconds(
                  opt,
                  placement.durationOverrides,
                )
                const adjusted = isOverlayDurationAdjusted(
                  opt,
                  placement.durationOverrides,
                )
                return (
                  <div key={opt.id} className="rotation-overlay-ctrl">
                    <button
                      type="button"
                      className={on ? 'chip compact active' : 'chip compact'}
                      title={`${opt.skillName} · after ${opt.trigger ?? opt.source}${
                        adjusted ? ` · kit ${opt.seconds}s` : ''
                      }`}
                      onClick={() => onToggleDurationOverlay(opt.id)}
                    >
                      {opt.label}
                      {!on ? (
                        <span className="rotation-dur-chip-secs">
                          {opt.seconds}s
                        </span>
                      ) : null}
                    </button>
                    {on ? (
                      <label
                        className={
                          adjusted
                            ? 'rotation-overlay-secs adjusted'
                            : 'rotation-overlay-secs'
                        }
                      >
                        <input
                          type="number"
                          min={0.5}
                          max={60}
                          step={0.5}
                          aria-label={`${opt.label} duration`}
                          value={seconds}
                          onChange={(e) => {
                            const raw = Number(e.target.value)
                            if (!Number.isFinite(raw)) return
                            onSetDurationOverride(
                              opt.id,
                              Math.abs(raw - opt.seconds) < 0.001
                                ? null
                                : raw,
                            )
                          }}
                        />
                        <span>s</span>
                        {adjusted ? (
                          <span
                            className="rotation-overlay-warn-tag"
                            title={`Kit default ${opt.seconds}s`}
                          >
                            kit {opt.seconds}s
                          </span>
                        ) : null}
                      </label>
                    ) : null}
                  </div>
                )
              })}
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
              {cooldownOptions.map((opt) => {
                const on = placement.activeDurations.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={on ? 'chip compact active' : 'chip compact'}
                    title={`${opt.skillName} · CD from cast start`}
                    onClick={() => onToggleDurationOverlay(opt.id)}
                  >
                    {opt.label}
                    <span className="rotation-dur-chip-secs">{opt.seconds}s</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {artifactOptions.length > 0 ? (
          <div className="rotation-selected-row">
            <span className="label" id={`dur-art-${placement.id}`}>
              Artifact
            </span>
            <div className="rotation-artifact-row">
              <select
                className="rotation-artifact-select"
                aria-labelledby={`dur-art-${placement.id}`}
                value={selectedArtifactId}
                onChange={(e) => setArtifactOverlay(e.target.value)}
              >
                <option value="">None</option>
                {artifactOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} title={opt.skillName}>
                    {opt.skillName} · {opt.seconds}s
                  </option>
                ))}
              </select>
              {selectedArtifactId
                ? (() => {
                    const opt = artifactOptions.find(
                      (o) => o.id === selectedArtifactId,
                    )
                    if (!opt) return null
                    const seconds = resolveOverlaySeconds(
                      opt,
                      placement.durationOverrides,
                    )
                    const adjusted = isOverlayDurationAdjusted(
                      opt,
                      placement.durationOverrides,
                    )
                    return (
                      <label
                        className={
                          adjusted
                            ? 'rotation-overlay-secs adjusted'
                            : 'rotation-overlay-secs'
                        }
                      >
                        <input
                          type="number"
                          min={0.5}
                          max={60}
                          step={0.5}
                          aria-label={`${opt.skillName} duration`}
                          value={seconds}
                          onChange={(e) => {
                            const raw = Number(e.target.value)
                            if (!Number.isFinite(raw)) return
                            onSetDurationOverride(
                              opt.id,
                              Math.abs(raw - opt.seconds) < 0.001
                                ? null
                                : raw,
                            )
                          }}
                        />
                        <span>s</span>
                        {adjusted ? (
                          <span
                            className="rotation-overlay-warn-tag"
                            title={`Set default ${opt.seconds}s`}
                          >
                            set {opt.seconds}s
                          </span>
                        ) : null}
                      </label>
                    )
                  })()
                : null}
            </div>
          </div>
        ) : null}

        {adjustedOverlays.length > 0 ? (
          <p className="rotation-overlay-warning" role="status">
            Custom duration
            {adjustedOverlays.length > 1 ? 's' : ''} — kit/set lists{' '}
            {adjustedOverlays
              .map((o) => `${o.label} at ${o.seconds}s`)
              .join('; ')}
            . Only change these when something extends or delays the effect
            (e.g. holding Mona’s bubble until a normal attack pops it).
          </p>
        ) : null}
      </div>
    </article>
  )
}
