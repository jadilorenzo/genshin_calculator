import { useEffect, useState } from 'react'
import { DeferredNumberInput } from '../rotations/DeferredNumberInput'
import { getCharacter } from '../rotations/characters'
import { CharacterPickerField } from './CharacterPickerField'
import { ScreenshotLightbox } from './ScreenshotLightbox'
import type { RunDraft, TestingCharacterRow } from './types'

type RunReviewCardProps = {
  draft: RunDraft
  onChange: (next: RunDraft) => void
  onSave: () => void
  onDiscard: () => void
}

const formatInt = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString() : ''

/** datetime-local value from an ISO string. */
const toDatetimeLocal = (iso: string | null): string => {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromDatetimeLocal = (value: string): string | null => {
  if (!value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export function RunReviewCard({
  draft,
  onChange,
  onSave,
  onDiscard,
}: RunReviewCardProps) {
  const patch = (partial: Partial<RunDraft>) => onChange({ ...draft, ...partial })

  const setRow = (index: number, partial: Partial<TestingCharacterRow>) => {
    const characters = draft.characters.map((row, i) => {
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

  const busy = draft.status === 'ocr' || draft.status === 'saving'
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!draft.previewUrl) setExpanded(false)
  }, [draft.previewUrl])

  return (
    <article className="testing-review-card">
      <div className="testing-review-preview">
        {draft.previewUrl ? (
          <button
            type="button"
            className="testing-review-thumb"
            onClick={() => setExpanded(true)}
            aria-label="Expand screenshot"
          >
            <img src={draft.previewUrl} alt="" />
            <span className="testing-review-thumb-hint">Click to expand</span>
          </button>
        ) : (
          <p className="field-note">No preview</p>
        )}
        <p className="field-note">{draft.fileName}</p>
        {draft.status === 'ocr' ? (
          <p className="field-note">Reading text…</p>
        ) : null}
        {draft.error ? <p className="auth-error">{draft.error}</p> : null}
      </div>

      {expanded && draft.previewUrl ? (
        <ScreenshotLightbox
          url={draft.previewUrl}
          label={draft.fileName || 'Screenshot'}
          onClose={() => setExpanded(false)}
        />
      ) : null}

      <div className="testing-review-form">
        <CharacterPickerField
          label="Main DPS"
          value={draft.mainDpsId}
          onChange={(mainDpsId) => patch({ mainDpsId })}
          allowEmpty={false}
        />

        <label className="field">
          <span className="label">Date on screenshot</span>
          <input
            type="datetime-local"
            value={toDatetimeLocal(draft.capturedAt)}
            onChange={(e) =>
              patch({ capturedAt: fromDatetimeLocal(e.target.value) })
            }
            disabled={busy}
          />
          <p className="field-note">
            Filled automatically when OCR finds a date on the image.
          </p>
        </label>

        <div className="testing-review-metrics">
          <label className="field">
            <span className="label">DPS</span>
            <DeferredNumberInput
              value={draft.dps ?? 0}
              onCommit={(dps) => patch({ dps })}
              formatDisplay={formatInt}
            />
          </label>
          <label className="field">
            <span className="label">Total damage</span>
            <DeferredNumberInput
              value={draft.totalDamage ?? 0}
              onCommit={(totalDamage) => patch({ totalDamage })}
              formatDisplay={formatInt}
            />
          </label>
          <label className="field">
            <span className="label">Elapsed (s)</span>
            <DeferredNumberInput
              value={draft.elapsedSeconds ?? 0}
              onCommit={(elapsedSeconds) => patch({ elapsedSeconds })}
            />
          </label>
          <label className="field">
            <span className="label">Strongest hit</span>
            <DeferredNumberInput
              value={draft.strongestHit ?? 0}
              onCommit={(strongestHit) => patch({ strongestHit })}
              formatDisplay={formatInt}
            />
          </label>
        </div>

        <div className="testing-review-rows">
          <p className="label">Team breakdown</p>
          {draft.characters.map((row, index) => (
            <div key={row.slot} className="testing-review-row">
              <CharacterPickerField
                label={`Slot ${index + 1}`}
                value={row.characterId}
                onChange={(characterId) => setRow(index, { characterId })}
              />
              <label className="field">
                <span className="label">Damage</span>
                <DeferredNumberInput
                  value={row.damage ?? 0}
                  onCommit={(damage) => setRow(index, { damage })}
                  formatDisplay={formatInt}
                />
              </label>
              <label className="field">
                <span className="label">Team %</span>
                <DeferredNumberInput
                  value={row.teamPct ?? 0}
                  onCommit={(teamPct) => setRow(index, { teamPct })}
                />
              </label>
            </div>
          ))}
        </div>

        {draft.warnings.length > 0 ? (
          <ul className="testing-review-warnings">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="chip-row">
          <button
            type="button"
            className="chip compact"
            disabled={busy}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="chip filled"
            disabled={busy || draft.status === 'pending'}
            onClick={onSave}
          >
            {draft.status === 'saving' ? 'Saving…' : 'Save run'}
          </button>
        </div>
      </div>
    </article>
  )
}
