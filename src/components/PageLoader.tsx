type PageLoaderProps = {
  label?: string
}

/** Lightweight route fallback while lazy chunks load. */
export function PageLoader({ label = 'Loading…' }: PageLoaderProps) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <p className="field-note">{label}</p>
    </div>
  )
}
