import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useAuth } from '@clerk/react'
import {
  collectLocalAppData,
  writeLocalAppData,
  writeLocalJson,
  type AppDataBlob,
} from './localAppData.ts'

export type SyncStatus = 'local' | 'loading' | 'ready' | 'saving' | 'error'

type UserDataContextValue = {
  /** Signed-in and cloud hydrate finished (or signed-out local mode). */
  ready: boolean
  isSignedIn: boolean
  syncStatus: SyncStatus
  syncError: string | null
  /** Full app blob when signed in; null when signed out (hooks use localStorage). */
  cloudData: AppDataBlob | null
  getCloudValue: <T>(key: string, fallback: T) => T
  setCloudValue: <T>(key: string, update: SetStateAction<T>) => void
  clearCloudPrefix: (prefix: string) => void
  refreshFromCloud: () => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

const sameJson = (a: unknown, b: unknown) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return Object.is(a, b)
  }
}

const localOnlyValue = (): UserDataContextValue => ({
  ready: true,
  isSignedIn: false,
  syncStatus: 'local',
  syncError: null,
  cloudData: null,
  getCloudValue: <T,>(_key: string, fallback: T) => fallback,
  setCloudValue: () => {
    // Signed out — persistence is localStorage via useLocalStorage hooks.
  },
  clearCloudPrefix: () => {
    // Signed out — ClearPageButton already clears localStorage.
  },
  refreshFromCloud: async () => {},
})

/** Always-local mode when Clerk is not configured. */
export const LocalUserDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => localOnlyValue(), [])
  return (
    <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
  )
}

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth()
  const [cloudData, setCloudData] = useState<AppDataBlob | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [syncError, setSyncError] = useState<string | null>(null)
  const cloudDataRef = useRef<AppDataBlob | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedUserRef = useRef<string | null>(null)

  cloudDataRef.current = cloudData

  const scheduleSave = useCallback(
    (data: AppDataBlob) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSyncStatus('saving')
        try {
          const token = await getToken()
          if (!token) throw new Error('Not signed in')
          const response = await fetch('/api/user-data', {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ data }),
          })
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as {
              error?: string
            } | null
            throw new Error(body?.error || `Save failed (${response.status})`)
          }
          writeLocalAppData(data)
          setSyncError(null)
          setSyncStatus('ready')
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'Save failed')
          setSyncStatus('error')
        }
      }, 450)
    },
    [getToken],
  )

  const hydrate = useCallback(async () => {
    if (!isLoaded) return

    if (!isSignedIn || !userId) {
      hydratedUserRef.current = null
      setCloudData(null)
      setSyncStatus('local')
      setSyncError(null)
      return
    }

    if (hydratedUserRef.current === userId && cloudDataRef.current) return

    setSyncStatus('loading')
    setSyncError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const response = await fetch('/api/user-data', {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error || `Load failed (${response.status})`)
      }
      const body = (await response.json()) as {
        data?: AppDataBlob
      }
      let next = body.data && typeof body.data === 'object' ? body.data : {}
      const local = collectLocalAppData()
      const cloudEmpty = Object.keys(next).length === 0
      const localHasData = Object.keys(local).length > 0

      // First login with empty cloud: promote this browser's localStorage.
      if (cloudEmpty && localHasData) {
        next = { ...local }
        const saveResponse = await fetch('/api/user-data', {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ data: next }),
        })
        if (!saveResponse.ok) {
          const errBody = (await saveResponse.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(errBody?.error || 'Could not upload local data')
        }
      }

      writeLocalAppData(next)
      setCloudData(next)
      hydratedUserRef.current = userId
      setSyncStatus('ready')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
      setSyncStatus('error')
      // Fall back to whatever is already in localStorage for this session.
      setCloudData(collectLocalAppData())
    }
  }, [getToken, isLoaded, isSignedIn, userId])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const getCloudValue = useCallback(<T,>(key: string, fallback: T): T => {
    const data = cloudDataRef.current
    if (!data || !(key in data)) return fallback
    return data[key] as T
  }, [])

  const setCloudValue = useCallback(
    <T,>(key: string, update: SetStateAction<T>) => {
      setCloudData((prev) => {
        const base = prev ?? {}
        const current = (key in base ? base[key] : undefined) as T
        const nextValue =
          typeof update === 'function'
            ? (update as (prevState: T) => T)(current)
            : update
        if (sameJson(current, nextValue) && key in base) return prev
        const next = { ...base, [key]: nextValue }
        writeLocalJson(key, nextValue)
        scheduleSave(next)
        return next
      })
      setSyncStatus((status) => (status === 'error' ? 'saving' : status))
    },
    [scheduleSave],
  )

  const clearCloudPrefix = useCallback(
    (prefix: string) => {
      setCloudData((prev) => {
        const base = prev ?? {}
        const next: AppDataBlob = {}
        for (const [key, value] of Object.entries(base)) {
          if (!key.startsWith(prefix)) next[key] = value
        }
        for (const key of Object.keys(base)) {
          if (key.startsWith(prefix)) {
            try {
              localStorage.removeItem(key)
            } catch {
              // ignore
            }
          }
        }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave],
  )

  const value = useMemo<UserDataContextValue>(() => {
    const signedIn = Boolean(isSignedIn)
    const ready =
      isLoaded &&
      (!signedIn ||
        syncStatus === 'ready' ||
        syncStatus === 'saving' ||
        syncStatus === 'error')
    return {
      ready,
      isSignedIn: signedIn,
      syncStatus: signedIn ? syncStatus : 'local',
      syncError,
      cloudData: signedIn ? cloudData : null,
      getCloudValue,
      setCloudValue,
      clearCloudPrefix,
      refreshFromCloud: hydrate,
    }
  }, [
    cloudData,
    clearCloudPrefix,
    getCloudValue,
    hydrate,
    isLoaded,
    isSignedIn,
    setCloudValue,
    syncError,
    syncStatus,
  ])

  return (
    <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
  )
}

export const useUserData = () => {
  const context = useContext(UserDataContext)
  if (!context) {
    throw new Error('useUserData must be used within UserDataProvider')
  }
  return context
}

export const useOptionalUserData = () => useContext(UserDataContext)
