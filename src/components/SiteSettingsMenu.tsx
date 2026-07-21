import { useEffect, useId, useRef, useState } from 'react'
import { MoonIcon, SettingsIcon, SunIcon } from './icons.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { THEME_LABEL } from '../theme'

export function SiteSettingsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { theme, toggleTheme, nextTheme } = useTheme()
  const ThemeIcon = nextTheme === 'light' ? SunIcon : MoonIcon

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="site-settings" ref={rootRef}>
      <button
        type="button"
        className={open ? 'site-settings-toggle open' : 'site-settings-toggle'}
        aria-label="Settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <SettingsIcon />
      </button>

      {open ? (
        <div
          className="site-settings-panel"
          id={panelId}
          role="dialog"
          aria-label="Settings"
        >
          <div className="site-settings-field" role="group" aria-label="Appearance">
            <span className="label">Appearance</span>
            <button
              type="button"
              className="site-settings-theme"
              onClick={toggleTheme}
              aria-label={`Switch to ${THEME_LABEL[nextTheme].toLowerCase()} mode`}
            >
              <ThemeIcon />
              <span>
                {THEME_LABEL[theme]} · switch to {THEME_LABEL[nextTheme].toLowerCase()}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
