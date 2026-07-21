import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useOptionalUserData } from '../sync/UserDataProvider.tsx'
import { readLocalJson, writeLocalJson } from '../sync/localAppData.ts'

/**
 * Persist React state under `key`.
 * Signed out → localStorage only.
 * Signed in → cloud blob (mirrored to localStorage as a cache).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const userData = useOptionalUserData()
  const cloudReady = Boolean(
    userData?.isSignedIn &&
      (userData.syncStatus === 'ready' ||
        userData.syncStatus === 'saving' ||
        userData.syncStatus === 'error') &&
      userData.cloudData,
  )

  const [localValue, setLocalValue] = useState<T>(() =>
    readLocalJson(key, initialValue),
  )
  const hydratedCloudRef = useRef(false)

  // Pull from cloud once when the signed-in blob becomes ready.
  useEffect(() => {
    if (!cloudReady || !userData) {
      hydratedCloudRef.current = false
      return
    }
    if (hydratedCloudRef.current) return
    hydratedCloudRef.current = true
    setLocalValue(userData.getCloudValue(key, initialValue))
  }, [cloudReady, userData, key, initialValue])

  // Always keep a localStorage copy (signed-out source of truth; signed-in cache).
  useEffect(() => {
    writeLocalJson(key, localValue)
  }, [key, localValue])

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setLocalValue((prev) => {
        const next =
          typeof update === 'function'
            ? (update as (prevState: T) => T)(prev)
            : update
        if (cloudReady && userData) {
          userData.setCloudValue(key, next)
        }
        return next
      })
    },
    [cloudReady, key, userData],
  )

  return [localValue, setValue]
}
