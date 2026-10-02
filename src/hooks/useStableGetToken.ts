import { useAuth } from '@clerk/react'
import { useCallback, useRef } from 'react'

/** Clerk's getToken identity changes often. Callers can depend on this safely. */
export function useStableGetToken() {
  const { getToken } = useAuth()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  return useCallback(() => getTokenRef.current(), [])
}

/**
 * Stays true after the first time Clerk finishes loading, so a later
 * isLoaded flicker does not unmount the page for a "Loading…" screen.
 */
export function useAuthHasLoaded() {
  const { isLoaded } = useAuth()
  const seen = useRef(false)
  if (isLoaded) seen.current = true
  return seen.current
}
