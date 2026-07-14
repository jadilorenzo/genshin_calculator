import { clearStoragePrefix } from '../hooks/clearStoragePrefix.ts'

/** Resets persisted inputs for a page prefix and reloads. */
export function ClearPageButton({
  prefix,
  label = 'Clear',
}: {
  prefix: string
  label?: string
}) {
  return (
    <button
      type="button"
      className="clear-page"
      onClick={() => {
        clearStoragePrefix(prefix)
        window.location.reload()
      }}
    >
      {label}
    </button>
  )
}
