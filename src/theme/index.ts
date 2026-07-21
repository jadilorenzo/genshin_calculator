/**
 * Theme modes + persistence. Visual tokens live in `../styles/_tokens.scss` only —
 * change colors there; components should use CSS variables.
 */
export type ThemeMode = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'gc:theme'
export const DEFAULT_THEME: ThemeMode = 'dark'

export const THEME_LABEL: Record<ThemeMode, string> = {
  dark: 'Dark',
  light: 'Light',
}

export function oppositeTheme(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark'
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light'
}

export function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === null) return DEFAULT_THEME
    const parsed: unknown = JSON.parse(raw)
    return isThemeMode(parsed) ? parsed : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** Apply theme to <html data-theme="…">. */
export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
}
