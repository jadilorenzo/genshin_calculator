import { useEffect, useId, useRef, useState } from 'react'
import {
  encodeImageForUpload,
  loadImageFromBlob,
} from './ocr/preprocessOverlay'
import { parseCapturedAtFromFilename } from './ocr/parseOverlayText'
import { runOverlayOcr, terminateOverlayOcr } from './ocr/runOverlayOcr'
import { RunReviewCard } from './RunReviewCard'
import type { RunDraft } from './types'

type UploadRunsPanelProps = {
  drafts: RunDraft[]
  onDraftsChange: (drafts: RunDraft[]) => void
  onSaveDraft: (localId: string) => void
  onDiscardDraft: (localId: string) => void
}

type DraftWithFile = RunDraft & { file?: File }

const makeLocalId = () =>
  `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`

const emptyRows = () =>
  Array.from({ length: 4 }, (_, slot) => ({
    slot,
    characterId: '',
    name: '',
    damage: null as number | null,
    teamPct: null as number | null,
  }))

export function UploadRunsPanel({
  drafts,
  onDraftsChange,
  onSaveDraft,
  onDiscardDraft,
}: UploadRunsPanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const draftsRef = useRef(drafts)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    return () => {
      void terminateOverlayOcr()
    }
  }, [])

  /** Keep the ref in sync before parent re-renders so OCR can patch immediately. */
  const commitDrafts = (next: RunDraft[]) => {
    draftsRef.current = next
    onDraftsChange(next)
  }

  const patchDraft = (localId: string, partial: Partial<RunDraft>) => {
    commitDrafts(
      draftsRef.current.map((d) =>
        d.localId === localId ? { ...d, ...partial } : d,
      ),
    )
  }

  const processFile = async (file: File, localId: string) => {
    patchDraft(localId, { status: 'ocr', error: undefined })
    try {
      const parsed = await runOverlayOcr(file)
      const image = await loadImageFromBlob(file)
      const imageBase64 = await encodeImageForUpload(image)
      const characters =
        parsed.characters.length > 0 ? parsed.characters : emptyRows()
      patchDraft(localId, {
        status: 'ready',
        imageBase64,
        mainDpsId: parsed.mainDpsId,
        dps: parsed.dps,
        totalDamage: parsed.totalDamage,
        elapsedSeconds: parsed.elapsedSeconds,
        strongestHit: parsed.strongestHit,
        capturedAt:
          parsed.capturedAt ?? parseCapturedAtFromFilename(file.name),
        characters,
        ocrRaw: parsed.ocrRaw,
        warnings: parsed.warnings,
      })
    } catch (err) {
      patchDraft(localId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'OCR failed',
        characters: emptyRows(),
      })
    }
  }

  const enqueueFiles = (fileList: FileList | File[]) => {
    const files = [...fileList].filter(
      (f) => !f.type || f.type.startsWith('image/'),
    )
    if (!files.length) return
    const withFiles: DraftWithFile[] = files.map((file) => ({
      localId: makeLocalId(),
      fileName: file.name || 'screenshot.png',
      previewUrl: URL.createObjectURL(file),
      imageBase64: null,
      status: 'pending',
      warnings: [],
      mainDpsId: '',
      dps: null,
      totalDamage: null,
      elapsedSeconds: null,
      strongestHit: null,
      capturedAt: null,
      characters: emptyRows(),
      ocrRaw: '',
      file,
    }))
    commitDrafts([...draftsRef.current, ...withFiles])
    for (const draft of withFiles) {
      if (draft.file) void processFile(draft.file, draft.localId)
    }
  }

  const reOcr = async (localId: string) => {
    const draft = draftsRef.current.find((d) => d.localId === localId) as
      | DraftWithFile
      | undefined
    if (!draft) return
    let file = draft.file
    if (!file && draft.previewUrl) {
      const res = await fetch(draft.previewUrl)
      const blob = await res.blob()
      file = new File([blob], draft.fileName, { type: blob.type || 'image/png' })
    }
    if (file) await processFile(file, localId)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files
      if (items && items.length) {
        e.preventDefault()
        enqueueFiles(items)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="testing-upload">
      <div className="testing-upload-head">
        <h2>Upload screenshots</h2>
        <p className="field-note">
          Drop combat-result overlays (or paste). Text is read automatically —
          review and fix before saving.
        </p>
      </div>

      <div
        className={
          dragOver ? 'testing-dropzone drag-over' : 'testing-dropzone'
        }
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <p>Drop images here, click to browse, or paste from clipboard</p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {drafts.length > 0 ? (
        <div className="testing-draft-list">
          {drafts
            .filter((d) => d.status !== 'saved')
            .map((draft) => (
              <div key={draft.localId} className="testing-draft-wrap">
                {draft.status === 'error' || draft.status === 'ready' ? (
                  <button
                    type="button"
                    className="chip compact"
                    onClick={() => {
                      void reOcr(draft.localId)
                    }}
                  >
                    Re-run OCR
                  </button>
                ) : null}
                <RunReviewCard
                  draft={draft}
                  onChange={(next) =>
                    commitDrafts(
                      draftsRef.current.map((d) =>
                        d.localId === next.localId ? { ...d, ...next } : d,
                      ),
                    )
                  }
                  onSave={() => onSaveDraft(draft.localId)}
                  onDiscard={() => onDiscardDraft(draft.localId)}
                />
              </div>
            ))}
        </div>
      ) : null}
    </section>
  )
}
