import { useEffect, useRef, useState } from 'react'
import { RunFormFields, type RunFormValues } from './RunFormFields'
import { flushFocusedField } from './runFormUtils'
import type { TestingRun } from './types'

function runToFormValues(run: TestingRun): RunFormValues {
  return {
    mainDpsId: run.mainDpsId,
    capturedAt: run.capturedAt,
    dps: run.dps,
    totalDamage: run.totalDamage,
    elapsedSeconds: run.elapsedSeconds,
    strongestHit: run.strongestHit,
    characters: run.characters.map((row) => ({ ...row })),
  }
}

type SavedRunEditorProps = {
  run: TestingRun
  saving?: boolean
  onCancel: () => void
  onSave: (values: RunFormValues) => void
}

export function SavedRunEditor({
  run,
  saving = false,
  onCancel,
  onSave,
}: SavedRunEditorProps) {
  const [values, setValues] = useState(() => runToFormValues(run))
  const valuesRef = useRef(values)

  useEffect(() => {
    const next = runToFormValues(run)
    valuesRef.current = next
    setValues(next)
  }, [run])

  const handleChange = (next: RunFormValues) => {
    valuesRef.current = next
    setValues(next)
  }

  return (
    <div className="testing-saved-run-editor">
      {run.imageUrl ? (
        <img
          className="testing-run-screenshot"
          src={run.imageUrl}
          alt=""
        />
      ) : null}
      <RunFormFields values={values} onChange={handleChange} disabled={saving} />
      <div className="chip-row">
        <button
          type="button"
          className="chip compact"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="chip filled"
          disabled={saving}
          onClick={() => {
            flushFocusedField()
            onSave(valuesRef.current)
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
