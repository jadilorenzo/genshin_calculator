import { CharacterIcon } from './CharacterIcon'
import { getCharacter } from './characters'
import { getDurationOptions } from './durationOptions'
import {
  defaultOnFieldDuration,
  effectiveCastTimes,
  getFieldCastTimings,
  hasSkillHold,
  kitHoldChannelSeconds,
  parseSkillVariant,
  skillToggleLabel,
  skillVariantLabels,
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
    skillVariant: parseSkillVariant(p.skillVariant, p.characterId, kitHold),
    activeDurations: p.activeDurations ?? [],
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
            const active = selected.activeDurations.includes(optionId)
              ? selected.activeDurations.filter((id) => id !== optionId)
              : [...selected.activeDurations, optionId]
            updatePlacement(selected.id, { activeDurations: active })
            onSelect(selected.id)
          }}
          onToggleCast={(key, value) => {
            applyCastPatch(selected.id, { [key]: value })
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
  onToggleCast,
  onSkillVariant,
}: {
  placement: TimelinePlacement
  timingMode: TimingMode
  humanLag: number
  onRemove: (id: string) => void
  onResetDuration: () => void
  onSetDuration: (duration: number) => void
  onToggleDurationOverlay: (optionId: string) => void
  onToggleCast: (key: 'castSkill' | 'castBurst', value: boolean) => void
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
  const options = getDurationOptions(char)
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
              <button
                type="button"
                className={
                  placement.castSkill ? 'chip compact active' : 'chip compact'
                }
                onClick={() => onToggleCast('castSkill', !placement.castSkill)}
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
              <button
                type="button"
                className={
                  placement.castBurst ? 'chip compact active' : 'chip compact'
                }
                onClick={() => onToggleCast('castBurst', !placement.castBurst)}
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

        {options.length > 0 ? (
          <div className="rotation-selected-row">
            <span className="label" id={`dur-${placement.id}`}>
              Overlays
            </span>
            <div
              className="chip-row wrap"
              role="group"
              aria-labelledby={`dur-${placement.id}`}
            >
              {options.map((opt) => {
                const on = placement.activeDurations.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={on ? 'chip compact active' : 'chip compact'}
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
      </div>
    </article>
  )
}
