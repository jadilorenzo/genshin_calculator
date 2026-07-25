import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TimingMode } from './fieldTimings'
import { RotationTimeline } from './RotationTimeline'
import {
  captureShareCardBlob,
  captureShareCardPng,
  copyImageBlob,
  downloadDataUrl,
  slugifyFilename,
} from './shareRotationImage'
import type { TimelinePlacement } from './types'

/** Same zoom as the community rotation detail preview. */
const PREVIEW_ZOOM = 0.75

type ShareRotationModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  placements: TimelinePlacement[]
  switchBuffer: number
  timingMode: TimingMode
  humanLag: number
  showAuraMarkers?: boolean
}

export function ShareRotationModal({
  open,
  onClose,
  title,
  description = '',
  placements,
  switchBuffer,
  timingMode,
  humanLag,
  showAuraMarkers = true,
}: ShareRotationModalProps) {
  const titleId = useId()
  const captureRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayTitle = title.trim() || 'Untitled rotation'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setStatus(null)
      setError(null)
    }
  }, [open])

  if (!open) return null

  const runCapture = async (mode: 'download' | 'copy') => {
    const node = captureRef.current
    if (!node || busy) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      if (mode === 'download') {
        const dataUrl = await captureShareCardPng(node)
        downloadDataUrl(
          dataUrl,
          `falsemoon-${slugifyFilename(displayTitle)}.png`,
        )
        setStatus('Downloaded')
      } else {
        const blob = await captureShareCardBlob(node)
        const ok = await copyImageBlob(blob)
        if (!ok) {
          const dataUrl = await captureShareCardPng(node)
          downloadDataUrl(
            dataUrl,
            `falsemoon-${slugifyFilename(displayTitle)}.png`,
          )
          setStatus('Copied unavailable — downloaded instead')
        } else {
          setStatus('Copied to clipboard')
        }
      }
      window.setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture image')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="rotation-share-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="rotation-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="rotation-share-dialog-head">
          <h2 id={titleId}>Share screenshot</h2>
          <p className="field-note">
            Screenshot of the rotations preview view — copy or download as PNG.
          </p>
        </div>

        <div className="rotation-share-preview-scroll">
          <div
            ref={captureRef}
            className="rotation-share-capture rotation-workspace rotation-preview"
            data-share-card
          >
            <header className="rotation-share-capture-head">
              <h3 className="rotation-share-capture-title">{displayTitle}</h3>
              {description.trim() ? (
                <p className="rotation-share-capture-desc">
                  {description.trim().slice(0, 160)}
                  {description.trim().length > 160 ? '…' : ''}
                </p>
              ) : null}
            </header>
            {placements.length === 0 ? (
              <p className="field-note">Add characters to the rotation first.</p>
            ) : (
              <RotationTimeline
                placements={placements}
                onChange={() => {}}
                selectedId={null}
                onSelectPlacement={() => {}}
                switchBuffer={switchBuffer}
                timingMode={timingMode}
                humanLag={humanLag}
                showAuraMarkers={showAuraMarkers}
                readOnly
                compactLayout
                hideToolbar
                lockZoom
                initialZoomScale={PREVIEW_ZOOM}
                portraitCrossOrigin="anonymous"
              />
            )}
          </div>
        </div>

        <div className="rotation-share-dialog-actions">
          {error ? <p className="auth-error">{error}</p> : null}
          {status ? <p className="field-note">{status}</p> : null}
          <div className="chip-row">
            <button
              type="button"
              className="chip compact"
              disabled={busy}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="chip compact"
              disabled={busy || placements.length === 0}
              onClick={() => {
                void runCapture('copy')
              }}
            >
              {busy ? 'Working…' : 'Copy image'}
            </button>
            <button
              type="button"
              className="chip filled"
              disabled={busy || placements.length === 0}
              onClick={() => {
                void runCapture('download')
              }}
            >
              {busy ? 'Working…' : 'Download PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

type ShareRotationButtonProps = {
  title: string
  description?: string
  placements: TimelinePlacement[]
  switchBuffer: number
  timingMode: TimingMode
  humanLag: number
  showAuraMarkers?: boolean
  className?: string
}

/** Opens the rotations-preview screenshot flow. */
export function ShareRotationButton({
  className = 'chip compact',
  ...shareProps
}: ShareRotationButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={shareProps.placements.length === 0}
        title={
          shareProps.placements.length === 0
            ? 'Add characters before sharing'
            : 'Share as screenshot'
        }
        onClick={() => setOpen(true)}
      >
        Share image
      </button>
      <ShareRotationModal
        open={open}
        onClose={() => setOpen(false)}
        {...shareProps}
      />
    </>
  )
}
