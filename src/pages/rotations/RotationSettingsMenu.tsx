import { useEffect, useId, useRef, useState } from 'react'
import { SettingsIcon } from '../../components/icons.tsx'
import {
  MAX_HUMAN_LAG,
  MIN_HUMAN_LAG,
  clampHumanLag,
  type TimingMode,
} from './fieldTimings'

interface RotationSettingsMenuProps {
  switchBuffer: number
  onSwitchBufferChange: (value: number) => void
  timingMode: TimingMode
  onTimingModeChange: (mode: TimingMode) => void
  humanLag: number
  onHumanLagChange: (value: number) => void
}

export function RotationSettingsMenu({
  switchBuffer,
  onSwitchBufferChange,
  timingMode,
  onTimingModeChange,
  humanLag,
  onHumanLagChange,
}: RotationSettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
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
    <div className="rotation-settings" ref={rootRef}>
      <button
        type="button"
        className={open ? 'rotation-settings-toggle open' : 'rotation-settings-toggle'}
        aria-label="Rotation settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <SettingsIcon />
      </button>

      {open ? (
        <div className="rotation-settings-panel" id={panelId} role="dialog" aria-label="Rotation settings">
          <label className="rotation-settings-field">
            <span className="label">Switch buffer (s)</span>
            <input
              type="number"
              min={0}
              max={1.5}
              step={0.01}
              value={switchBuffer}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onSwitchBufferChange(n)
              }}
            />
          </label>

          <div className="rotation-settings-field" role="group" aria-label="Cast timing mode">
            <span className="label">Cast timings</span>
            <div className="chip-row">
              <button
                type="button"
                className={timingMode === 'frame' ? 'chip compact active' : 'chip compact'}
                onClick={() => onTimingModeChange('frame')}
              >
                Frame
              </button>
              <button
                type="button"
                className={timingMode === 'human' ? 'chip compact active' : 'chip compact'}
                onClick={() => onTimingModeChange('human')}
              >
                Human
              </button>
            </div>
          </div>

          {timingMode === 'human' ? (
            <label className="rotation-settings-field">
              <span className="label">Human lag / cast (s)</span>
              <input
                type="number"
                min={MIN_HUMAN_LAG}
                max={MAX_HUMAN_LAG}
                step={0.01}
                value={humanLag}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) onHumanLagChange(clampHumanLag(n))
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
