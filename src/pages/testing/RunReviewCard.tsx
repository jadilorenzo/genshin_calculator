import { useEffect, useState } from 'react'
import { RunFormFields } from './RunFormFields'
import { ScreenshotLightbox } from './ScreenshotLightbox'
import type { RunDraft } from './types'

type RunReviewCardProps = {
  draft: RunDraft
  onChange: (next: RunDraft) => void
  onSave: () => void
  onDiscard: () => void
  onCancelOcr?: () => void
  onRetryOcr?: () => void
}

export function RunReviewCard({
  draft,
  onChange,
  onSave,
  onDiscard,
  onCancelOcr,
  onRetryOcr,
}: RunReviewCardProps) {
  const patch = (partial: Partial<RunDraft>) => onChange({ ...draft, ...partial })

  const busy = draft.status === 'ocr' || draft.status === 'saving'
  const stalled = draft.status === 'stalled'
  const progress = draft.ocrProgress
  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0
  const progressLabel = stalled
    ? 'Stalled'
    : progress?.phase === 'queued'
      ? 'Waiting'
      : progress
        ? `Reading text · ${progress.done}/${progress.total}`
        : 'Reading text…'
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
        {draft.status === 'ocr' || stalled ? (
          <div className="testing-ocr-status">
            <div className="testing-ocr-status-row">
              <p className="field-note">{progressLabel}</p>
              {stalled && onRetryOcr ? (
                <button
                  type="button"
                  className="chip compact"
                  onClick={onRetryOcr}
                >
                  Retry
                </button>
              ) : null}
              {draft.status === 'ocr' && onCancelOcr ? (
                <button
                  type="button"
                  className="chip compact"
                  onClick={onCancelOcr}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <div
              className={[
                'testing-ocr-track',
                progress?.phase === 'queued' ? 'is-waiting' : '',
                stalled ? 'is-stalled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stalled || progress?.phase === 'reading' ? progressPct : undefined}
              aria-label={progressLabel}
            >
              <div
                className="testing-ocr-fill"
                style={
                  progress?.phase === 'queued'
                    ? undefined
                    : { width: `${progressPct}%` }
                }
              />
            </div>
          </div>
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
        <RunFormFields
          values={{
            mainDpsId: draft.mainDpsId,
            capturedAt: draft.capturedAt,
            dps: draft.dps,
            totalDamage: draft.totalDamage,
            elapsedSeconds: draft.elapsedSeconds,
            strongestHit: draft.strongestHit,
            characters: draft.characters,
          }}
          onChange={(values) => patch(values)}
          disabled={busy}
        />

        {draft.warnings.length > 0 ? (
          <ul className="testing-review-warnings">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <p className="field-note">
          Date is filled automatically when OCR finds one on the image.
        </p>

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
            disabled={busy || stalled || draft.status === 'pending'}
            onClick={onSave}
          >
            {draft.status === 'saving' ? 'Saving…' : 'Save run'}
          </button>
        </div>
      </div>
    </article>
  )
}
