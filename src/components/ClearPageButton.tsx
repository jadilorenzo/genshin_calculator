import { clearStoragePrefix } from '../hooks/clearStoragePrefix.ts'
import { useOptionalUserData } from '../sync/UserDataProvider.tsx'

/** Resets persisted inputs for a page prefix and reloads (local-only, signed-out mode). */
export function ClearPageButton({
  prefix,
  label = 'Clear',
}: {
  prefix: string
  label?: string
}) {
  const userData = useOptionalUserData()

  if (userData?.isSignedIn) {
    return null
  }

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
