import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage.ts'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  oppositeTheme,
  type ThemeMode,
} from '../theme'

/** Persist light/dark theme and sync <html data-theme>. */
export function useTheme(): {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
  nextTheme: ThemeMode
} {
  const [theme, setTheme] = useLocalStorage<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME)
  const nextTheme = oppositeTheme(theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(nextTheme),
    nextTheme,
  }
}
