import { DeferredNumberInput } from '../rotations/DeferredNumberInput'
import { getCharacter } from '../rotations/characters'
import { CharacterPickerField } from './CharacterPickerField'
import { formatRunInt, fromDatetimeLocal, toDatetimeLocal } from './runFormUtils'
import type { TestingCharacterRow } from './types'

export type RunFormValues = {
  mainDpsId: string
  capturedAt: string | null
  dps: number | null
  totalDamage: number | null
  elapsedSeconds: number | null
  strongestHit: number | null
  characters: TestingCharacterRow[]
}

type RunFormFieldsProps = {
  values: RunFormValues
  onChange: (values: RunFormValues) => void
  disabled?: boolean
}

export function RunFormFields({
  values,
  onChange,
  disabled = false,
}: RunFormFieldsProps) {
  const patch = (partial: Partial<RunFormValues>) =>
    onChange({ ...values, ...partial })

  const setRow = (index: number, partial: Partial<TestingCharacterRow>) => {
    const characters = values.characters.map((row, i) => {
      if (i !== index) return row
      const next = { ...row, ...partial }
      if (partial.characterId != null) {
        const character = getCharacter(partial.characterId)
        if (character) next.name = character.name
      }
      return next
    })
    patch({ characters })
  }

  return (
    <>
      <CharacterPickerField
        label="Main DPS"
        value={values.mainDpsId}
        onChange={(mainDpsId) => patch({ mainDpsId })}
        allowEmpty={false}
        disabled={disabled}
      />

      <label className="field">
        <span className="label">Date on screenshot</span>
        <input
          type="datetime-local"
          value={toDatetimeLocal(values.capturedAt)}
          onChange={(e) =>
            patch({ capturedAt: fromDatetimeLocal(e.target.value) })
          }
          disabled={disabled}
        />
      </label>

      <div className="testing-review-metrics">
        <label className="field">
          <span className="label">DPS</span>
          <DeferredNumberInput
            value={values.dps ?? 0}
            onCommit={(dps) => patch({ dps })}
            formatDisplay={formatRunInt}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="label">Total damage</span>
          <DeferredNumberInput
            value={values.totalDamage ?? 0}
            onCommit={(totalDamage) => patch({ totalDamage })}
            formatDisplay={formatRunInt}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="label">Elapsed (s)</span>
          <DeferredNumberInput
            value={values.elapsedSeconds ?? 0}
            onCommit={(elapsedSeconds) => patch({ elapsedSeconds })}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="label">Strongest hit</span>
          <DeferredNumberInput
            value={values.strongestHit ?? 0}
            onCommit={(strongestHit) => patch({ strongestHit })}
            formatDisplay={formatRunInt}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="testing-review-rows">
        <p className="label">Team breakdown</p>
        {values.characters.map((row, index) => (
          <div key={row.slot} className="testing-review-row">
            <CharacterPickerField
              label={`Slot ${index + 1}`}
              value={row.characterId}
              onChange={(characterId) => setRow(index, { characterId })}
              disabled={disabled}
            />
            <label className="field">
              <span className="label">Damage</span>
              <DeferredNumberInput
                value={row.damage ?? 0}
                onCommit={(damage) => setRow(index, { damage })}
                formatDisplay={formatRunInt}
                disabled={disabled}
              />
            </label>
            <label className="field">
              <span className="label">Team %</span>
              <DeferredNumberInput
                value={row.teamPct ?? 0}
                onCommit={(teamPct) => setRow(index, { teamPct })}
                disabled={disabled}
              />
            </label>
          </div>
        ))}
      </div>
    </>
  )
}
