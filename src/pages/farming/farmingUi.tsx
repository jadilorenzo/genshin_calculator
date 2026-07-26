import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'
import { MATERIAL_CHAR_BY_ID, materialIconUrl, planProgress } from './materialsData'
import {
  clampCharLevel,
  formatGoalSummary,
  formatTalentGoal,
  LEVEL_CHIPS,
  TALENT_PRESETS,
  type FarmingPlanEntry,
  type TalentTargets,
} from './types'

export function GoalEditor({
  plan,
  inventory,
  checkedMaterials,
  onUpdate,
  onTalent,
  onPreset,
  onRemove,
}: {
  plan: FarmingPlanEntry
  inventory: Record<string, number>
  checkedMaterials: Record<string, boolean>
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
}) {
  const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
  const kit =
    getCharacter(plan.characterId) ||
    CHARACTER_KITS.find((c) => c.name === mat?.name)
  const progress = planProgress(plan, inventory, checkedMaterials)
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
    <div className="farming-goal-editor">
      <div className="farming-plan-top">
        <label className="farming-check farming-goal-title">
          <input
            type="checkbox"
            checked={plan.checked}
            onChange={() =>
              onUpdate(plan.characterId, { checked: !plan.checked })
            }
            aria-label={`Mark ${name} goal done`}
          />
          {kit ? (
            <CharacterIcon character={kit} className="testing-char-icon" />
          ) : null}
          <span className="farming-goal-copy">
            <span className="farming-goal-name">{name}</span>
            <span className="farming-goal-summary">
              {formatGoalSummary(plan)}
            </span>
          </span>
        </label>
        {onRemove ? (
          <button
            type="button"
            className="chip compact"
            onClick={() => onRemove(plan.characterId)}
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="farming-goal-progress">
        <div className="farming-progress-track">
          <div
            className="farming-progress-fill"
            style={{
              width: `${plan.checked ? 100 : Math.min(100, progress.pct)}%`,
            }}
          />
        </div>
        <span className="field-note">
          {plan.checked
            ? 'Goal complete'
            : `${progress.pct.toFixed(0)}% materials · ${progress.remainingUnits.toLocaleString()} units left`}
        </span>
      </div>

      <div className="farming-sections">
        <section className="farming-section" aria-label="Current progress">
          <h4>Your progress</h4>
          <div className="farming-plan-grid">
            <label className="field">
              <span className="label">Character Lv</span>
              <input
                type="number"
                min={1}
                max={90}
                value={plan.currentLevel}
                onChange={(e) =>
                  setLevel('currentLevel', Number(e.target.value))
                }
              />
            </label>
            <label className="field">
              <span className="label">Weapon Lv</span>
              <input
                type="number"
                min={1}
                max={90}
                value={plan.weapon.currentLevel}
                onChange={(e) =>
                  setWeaponLevel('currentLevel', Number(e.target.value))
                }
              />
            </label>
          </div>
          <LevelChips
            value={plan.currentLevel}
            onPick={(level) => setLevel('currentLevel', level)}
          />
          <label className="field">
            <span className="label">Weapon name</span>
            <input
              type="text"
              value={plan.weapon.name}
              placeholder="Optional — e.g. Fractured Halo"
              onChange={(e) =>
                onUpdate(plan.characterId, {
                  weapon: { ...plan.weapon, name: e.target.value },
                })
              }
            />
          </label>
          <div className="farming-talent-grid">
            <p className="farming-section-note">Talent levels now</p>
            {(
              [
                ['normal', 'NA'],
                ['skill', 'Skill'],
                ['burst', 'Burst'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="farming-talent-single">
                <span className="label">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={plan.talents[key].current}
                  onChange={(e) =>
                    onTalent(
                      plan.characterId,
                      key,
                      'current',
                      Number(e.target.value),
                    )
                  }
                  aria-label={`${label} current`}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="farming-section" aria-label="Build goal">
          <h4>Build goal</h4>
          <div className="farming-plan-grid">
            <label className="field">
              <span className="label">Character Lv</span>
              <input
                type="number"
                min={1}
                max={90}
                value={plan.targetLevel}
                onChange={(e) =>
                  setLevel('targetLevel', Number(e.target.value))
                }
              />
            </label>
            <label className="field">
              <span className="label">Weapon Lv</span>
              <input
                type="number"
                min={1}
                max={90}
                value={plan.weapon.targetLevel}
                onChange={(e) =>
                  setWeaponLevel('targetLevel', Number(e.target.value))
                }
              />
            </label>
          </div>
          <LevelChips
            value={plan.targetLevel}
            onPick={(level) => setLevel('targetLevel', level)}
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
          <div className="farming-talent-grid">
            <p className="farming-section-note">Talent goals</p>
            {(
              [
                ['normal', 'NA'],
                ['skill', 'Skill'],
                ['burst', 'Burst'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="farming-talent-single">
                <span className="label">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={plan.talents[key].target}
                  onChange={(e) =>
                    onTalent(
                      plan.characterId,
                      key,
                      'target',
                      Number(e.target.value),
                    )
                  }
                  aria-label={`${label} goal`}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function LevelChips({
  value,
  onPick,
}: {
  value: number
  onPick: (level: number) => void
}) {
  return (
    <div className="farming-level-chips" role="group" aria-label="Quick levels">
      {LEVEL_CHIPS.map((level) => (
        <button
          key={level}
          type="button"
          className={value === level ? 'chip compact active' : 'chip compact'}
          onClick={() => onPick(level)}
        >
          {level}
        </button>
      ))}
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
