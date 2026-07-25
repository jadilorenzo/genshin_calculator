import { useEffect } from 'react'

type ScreenshotLightboxProps = {
  url: string
  label: string
  onClose: () => void
}

/** Full-screen screenshot viewer. Closes on Escape or backdrop click. */
export function ScreenshotLightbox({
  url,
  label,
  onClose,
}: ScreenshotLightboxProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="testing-screenshot-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="testing-screenshot-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="testing-screenshot-dialog-head">
          <h2>{label}</h2>
          <button type="button" className="chip compact" onClick={onClose}>
            Close
          </button>
        </div>
        <img src={url} alt={label} />
      </section>
    </div>
  )
}
