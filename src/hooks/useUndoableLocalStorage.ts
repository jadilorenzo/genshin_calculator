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

const cloneValue = <T>(value: T): T => structuredClone(value)

const sameJson = <T>(a: T, b: T): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return Object.is(a, b)
  }
}

export interface UndoableLocalStorage<T> {
  value: T
  setValue: Dispatch<SetStateAction<T>>
  undo: () => void
  redo: () => void
  skipNextHistory: () => void
  beginHistoryGesture: () => void
  endHistoryGesture: () => void
}

/**
 * Undoable state: localStorage when signed out; user cloud blob when signed in
 * (mirrored to localStorage).
 */
export const useUndoableLocalStorage = <T>(
  key: string,
  initialValue: T,
  options?: {
    maxHistory?: number
    coalesceMs?: number
    load?: () => T
    forceHistory?: (prev: T, next: T) => boolean
  },
): UndoableLocalStorage<T> => {
  const maxHistory = options?.maxHistory ?? 50
  const coalesceMs = options?.coalesceMs ?? 400
  const load = options?.load
  const forceHistory = options?.forceHistory
  const userData = useOptionalUserData()
  const cloudReady = Boolean(
    userData?.isSignedIn &&
      (userData.syncStatus === 'ready' ||
        userData.syncStatus === 'saving' ||
        userData.syncStatus === 'error') &&
      userData.cloudData,
  )

  const [value, setValueRaw] = useState<T>(() =>
    load ? load() : readLocalJson(key, initialValue),
  )
  const valueRef = useRef(value)
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const skipRef = useRef(0)
  const lastPushAtRef = useRef(0)
  const inGestureRef = useRef(false)
  const gesturePushedRef = useRef(false)
  const forceHistoryRef = useRef(forceHistory)
  const hydratedCloudRef = useRef(false)
  forceHistoryRef.current = forceHistory
  valueRef.current = value

  useEffect(() => {
    if (!cloudReady || !userData) {
      hydratedCloudRef.current = false
      return
    }
    if (hydratedCloudRef.current) return
    hydratedCloudRef.current = true
    const preferred =
      userData.cloudData && key in userData.cloudData
        ? userData.getCloudValue(key, initialValue)
        : load
          ? load()
          : readLocalJson(key, initialValue)
    pastRef.current = []
    futureRef.current = []
    skipRef.current += 1
    setValueRaw(preferred)
  }, [cloudReady, userData, key, initialValue, load])

  useEffect(() => {
    writeLocalJson(key, value)
    if (cloudReady && userData && hydratedCloudRef.current) {
      userData.setCloudValue(key, value)
    }
  }, [key, value, cloudReady, userData])

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setValueRaw((prev) => {
        const skipping = skipRef.current > 0
        if (skipping) skipRef.current -= 1

        const next =
          typeof update === 'function'
            ? (update as (prevState: T) => T)(prev)
            : update
        if (sameJson(prev, next)) return prev
        if (skipping) return next

        if (inGestureRef.current) {
          if (!gesturePushedRef.current) {
            pastRef.current = [...pastRef.current, cloneValue(prev)].slice(
              -maxHistory,
            )
            gesturePushedRef.current = true
          }
          futureRef.current = []
          lastPushAtRef.current = Date.now()
          return next
        }

        const now = Date.now()
        const forced = forceHistoryRef.current?.(prev, next) ?? false
        const shouldPush =
          forced ||
          pastRef.current.length === 0 ||
          now - lastPushAtRef.current > coalesceMs
        if (shouldPush) {
          pastRef.current = [...pastRef.current, cloneValue(prev)].slice(
            -maxHistory,
          )
        }
        lastPushAtRef.current = now
        futureRef.current = []
        return next
      })
    },
    [coalesceMs, maxHistory],
  )

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, cloneValue(valueRef.current)]
    skipRef.current += 1
    lastPushAtRef.current = 0
    setValueRaw(prev)
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, cloneValue(valueRef.current)].slice(
      -maxHistory,
    )
    skipRef.current += 1
    lastPushAtRef.current = 0
    setValueRaw(next)
  }, [maxHistory])

  const skipNextHistory = useCallback(() => {
    skipRef.current += 1
  }, [])

  const beginHistoryGesture = useCallback(() => {
    inGestureRef.current = true
    gesturePushedRef.current = false
  }, [])

  const endHistoryGesture = useCallback(() => {
    inGestureRef.current = false
    gesturePushedRef.current = false
    lastPushAtRef.current = 0
  }, [])

  return {
    value,
    setValue,
    undo,
    redo,
    skipNextHistory,
    beginHistoryGesture,
    endHistoryGesture,
  }
}
