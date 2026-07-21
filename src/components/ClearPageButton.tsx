import { clearStoragePrefix } from '../hooks/clearStoragePrefix.ts'
import { useOptionalUserData } from '../sync/UserDataProvider.tsx'

/** Resets persisted inputs for a page prefix and reloads. */
export function ClearPageButton({
  prefix,
  label = 'Clear',
}: {
  prefix: string
  label?: string
}) {
  const userData = useOptionalUserData()

  return (
    <button
      type="button"
      className="clear-page"
      onClick={() => {
        clearStoragePrefix(prefix)
        userData?.clearCloudPrefix(prefix)
        window.location.reload()
      }}
    >
      {label}
    </button>
  )
}
