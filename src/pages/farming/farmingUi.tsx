import { useState } from 'react'
import { CheckIcon, TrashIcon } from '../../components/icons'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'
import { MATERIAL_CHAR_BY_ID, materialIconUrl } from './materialsData'
import {
  buildProgress,
  clampCharLevel,
  clampTalentLevel,
  formatGoalSummary,
  formatProgressSummary,
  formatTalentGoal,
  TALENT_PRESETS,
  type FarmingPlanEntry,
  type TalentTargets,
} from './types'

export function GoalEditor({
  plan,
  matsPct = 0,
  matsComplete = 0,
  matsTotal = 0,
  onUpdate,
  onTalent,
  onPreset,
  onRemove,
  onConfirmGoal,
  initiallyEditing = false,
}: {
  plan: FarmingPlanEntry
  matsPct?: number
  matsComplete?: number
  matsTotal?: number
  onUpdate: (id: string, patch: Partial<FarmingPlanEntry>) => void
  onTalent: (
    id: string,
    key: keyof TalentTargets,
    field: 'current' | 'target',
    value: number,
  ) => void
  onPreset: (
    id: string,
    targets: { normal: number; skill: number; burst: number },
  ) => void
  onRemove?: (id: string) => void
  /** Called when the user confirms goal targets (exits Goal mode). */
  onConfirmGoal?: () => void
  /** Opens the build-goal editors (targets), not progress. */
  initiallyEditing?: boolean
}) {
  const [editingGoal, setEditingGoal] = useState(initiallyEditing)
  const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
  const kit =
    getCharacter(plan.characterId) ||
    CHARACTER_KITS.find((c) => c.name === mat?.name)
  const progress = buildProgress(plan)
  const name = mat?.name || plan.characterId

  const setLevel = (
    field: 'currentLevel' | 'targetLevel',
    value: number,
  ) => {
    const next = clampCharLevel(value)
    if (field === 'currentLevel') {
      onUpdate(plan.characterId, {
        currentLevel: next,
        targetLevel: Math.max(next, plan.targetLevel),
      })
    } else {
      onUpdate(plan.characterId, {
        targetLevel: Math.max(next, plan.currentLevel),
      })
    }
  }

  const setWeaponLevel = (
    field: 'currentLevel' | 'targetLevel',
    value: number,
  ) => {
    const next = clampCharLevel(value)
    const weapon = { ...plan.weapon }
    if (field === 'currentLevel') {
      weapon.currentLevel = next
      weapon.targetLevel = Math.max(next, weapon.targetLevel)
    } else {
      weapon.targetLevel = Math.max(next, weapon.currentLevel)
    }
    onUpdate(plan.characterId, { weapon })
  }

  return (
    <div
      className={
        editingGoal ? 'farming-goal-editor editing-goal' : 'farming-goal-editor'
      }
    >
      <div className="farming-plan-top">
        <div className="farming-goal-title">
          {kit ? (
            <CharacterIcon character={kit} className="testing-char-icon" />
          ) : null}
          <span className="farming-goal-copy">
            <span className="farming-goal-name">{name}</span>
            <span className="farming-goal-summary">
              {editingGoal
                ? formatGoalSummary(plan)
                : formatProgressSummary(plan)}
            </span>
          </span>
        </div>
        <div className="farming-panel-actions">
          <div
            className="farming-mode-toggle"
            role="tablist"
            aria-label="Build editor mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!editingGoal}
              className={!editingGoal ? 'active' : undefined}
              onClick={() => setEditingGoal(false)}
            >
              Progress
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editingGoal}
              className={editingGoal ? 'active' : undefined}
              onClick={() => setEditingGoal(true)}
            >
              Goal
            </button>
          </div>
          {onRemove ? (
            <button
              type="button"
              className="chip compact farming-delete-btn"
              onClick={() => onRemove(plan.characterId)}
            >
              <TrashIcon />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <label className="farming-check farming-not-obtained">
        <input
          type="checkbox"
          checked={plan.notObtained}
          onChange={(e) => {
            const notObtained = e.target.checked
            if (notObtained) {
              onUpdate(plan.characterId, {
                notObtained: true,
                currentLevel: 1,
                talents: {
                  normal: { ...plan.talents.normal, current: 1 },
                  skill: { ...plan.talents.skill, current: 1 },
                  burst: { ...plan.talents.burst, current: 1 },
                },
              })
            } else {
              onUpdate(plan.characterId, { notObtained: false })
            }
          }}
        />
        Character not obtained
      </label>

      <div className="farming-goal-progress">
        <div className="farming-dual-tracks compact">
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Built</span>
            <div className="farming-progress-track">
              <div
                className="farming-progress-fill"
                style={{ width: `${Math.min(100, progress.pct)}%` }}
              />
            </div>
          </div>
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Mats</span>
            <div className="farming-progress-track mats">
              <div
                className="farming-progress-fill mats"
                style={{ width: `${Math.min(100, matsPct)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="farming-goal-progress-meta">
          <span className="field-note">
            {`${progress.pct.toFixed(0)}% built`}
            {matsTotal
              ? ` · ${matsPct.toFixed(0)}% mats (${matsComplete}/${matsTotal})`
              : ''}
          </span>
          <ul className="farming-build-parts" aria-label="Build parts">
            {progress.parts.map((part) => (
              <li
                key={part.id}
                className={part.done ? 'done' : undefined}
                title={
                  part.done
                    ? `${part.label} complete`
                    : `${part.label} ${part.pct.toFixed(0)}%`
                }
              >
                <span className="farming-build-part-icon" aria-hidden="true">
                  {part.done ? '✓' : '○'}
                </span>
                <span>{part.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="farming-sections stacked">
        {editingGoal ? (
          <section className="farming-section farming-section-goal" aria-label="Build goal">
            <h4>Build goal</h4>
            <LevelSlider
              label="Character Lv"
              value={plan.targetLevel}
              min={1}
              max={90}
              onChange={(level) => setLevel('targetLevel', level)}
            />
            <LevelNudge
              value={plan.targetLevel}
              min={1}
              max={90}
              onChange={(level) => setLevel('targetLevel', level)}
            />
            <LevelSlider
              label="Weapon Lv"
              value={plan.weapon.targetLevel}
              min={1}
              max={90}
              onChange={(level) => setWeaponLevel('targetLevel', level)}
            />
            <div
              className="farming-talent-presets"
              role="group"
              aria-label="Talent goal presets"
            >
              {TALENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    formatTalentGoal(plan.talents) === preset.label
                      ? 'chip compact active'
                      : 'chip compact'
                  }
                  onClick={() => onPreset(plan.characterId, preset.targets)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="farming-talent-grid" role="group" aria-label="Talent goals">
              {(
                [
                  ['normal', 'NA'],
                  ['skill', 'Skill'],
                  ['burst', 'Burst'],
                ] as const
              ).map(([key, label]) => (
                <TalentLevelField
                  key={key}
                  label={label}
                  value={plan.talents[key].target}
                  onChange={(level) =>
                    onTalent(plan.characterId, key, 'target', level)
                  }
                />
              ))}
            </div>
            <div className="farming-goal-confirm-row">
              <button
                type="button"
                className="chip farming-confirm-btn"
                onClick={() => {
                  setEditingGoal(false)
                  onConfirmGoal?.()
                }}
              >
                <CheckIcon />
                Confirm goal
              </button>
            </div>
          </section>
        ) : (
          <section className="farming-section farming-section-progress" aria-label="Current progress">
            <h4>Your progress</h4>
            {plan.notObtained ? (
              <p className="field-note">
                Character progress is locked at baseline until you obtain them.
                Weapon level can still be tracked. Materials are treated as
                unowned.
              </p>
            ) : null}
            <LevelSlider
              label="Character Lv"
              value={plan.currentLevel}
              min={1}
              max={90}
              done={plan.currentLevel >= plan.targetLevel}
              disabled={plan.notObtained}
              onChange={(level) => setLevel('currentLevel', level)}
            />
            <LevelNudge
              value={plan.currentLevel}
              min={1}
              max={90}
              disabled={plan.notObtained}
              onChange={(level) => setLevel('currentLevel', level)}
            />
            <LevelSlider
              label="Weapon Lv"
              value={plan.weapon.currentLevel}
              min={1}
              max={90}
              done={plan.weapon.currentLevel >= plan.weapon.targetLevel}
              onChange={(level) => setWeaponLevel('currentLevel', level)}
            />
            <div
              className="farming-rarity-toggle"
              role="group"
              aria-label="Weapon rarity"
            >
              {([4, 5] as const).map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  className={
                    plan.weapon.rarity === rarity
                      ? 'chip compact active'
                      : 'chip compact'
                  }
                  onClick={() =>
                    onUpdate(plan.characterId, {
                      weapon: { ...plan.weapon, rarity },
                    })
                  }
                >
                  {rarity}★
                </button>
              ))}
            </div>
            <div
              className="farming-talent-grid"
              role="group"
              aria-label="Talent levels now"
            >
              {(
                [
                  ['normal', 'NA'],
                  ['skill', 'Skill'],
                  ['burst', 'Burst'],
                ] as const
              ).map(([key, label]) => (
                <TalentLevelField
                  key={key}
                  label={label}
                  value={plan.talents[key].current}
                  done={plan.talents[key].current >= plan.talents[key].target}
                  disabled={plan.notObtained}
                  onChange={(level) =>
                    onTalent(plan.characterId, key, 'current', level)
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export function TalentLevelField({
  label,
  value,
  onChange,
  done = false,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  done?: boolean
  disabled?: boolean
}) {
  const set = (next: number) => onChange(clampTalentLevel(next))
  return (
    <div
      className={[
        'farming-talent-field',
        done ? 'done' : '',
        disabled ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="label">
        {done ? <span className="farming-done-mark" aria-hidden="true">✓</span> : null}
        {label}
      </span>
      <input
        type="number"
        min={1}
        max={10}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        onBlur={(e) => set(Number(e.target.value))}
      />
      <div className="farming-talent-picks" role="group" aria-label={`${label} quick picks`}>
        {[1, 6, 8, 9, 10].map((level) => (
          <button
            key={level}
            type="button"
            className={value === level ? 'chip compact active' : 'chip compact'}
            disabled={disabled}
            onClick={() => set(level)}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LevelSlider({
  label,
  value,
  min,
  max,
  onChange,
  done = false,
  disabled = false,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  done?: boolean
  disabled?: boolean
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <label
      className={[
        'farming-slider',
        done ? 'done' : '',
        disabled ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="farming-slider-head">
        <span className="label">
          {done ? <span className="farming-done-mark" aria-hidden="true">✓</span> : null}
          {label}
        </span>
        <span className="farming-slider-value">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--slider-fill' as string]: `${pct}%` }}
      />
    </label>
  )
}

export function LevelNudge({
  value,
  min,
  max,
  onChange,
  steps = [-10, -1, 1, 10],
  disabled = false,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  steps?: number[]
  disabled?: boolean
}) {
  return (
    <div className="farming-level-nudge" role="group" aria-label="Adjust level">
      {steps.map((step) => {
        const next = Math.max(min, Math.min(max, value + step))
        const isDisabled = disabled || next === value
        const label = step > 0 ? `+${step}` : String(step)
        return (
          <button
            key={step}
            type="button"
            className="chip compact"
            disabled={isDisabled}
            onClick={() => onChange(next)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function MaterialRowIcon({
  name,
  icon,
}: {
  name: string
  icon: string | null | undefined
}) {
  const src = materialIconUrl(icon)
  if (!src) {
    return <span className="farming-mat-fallback">{name.slice(0, 1)}</span>
  }
  return <img className="farming-mat-icon" src={src} alt="" loading="lazy" />
}
