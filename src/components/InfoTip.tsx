import { useId } from 'react'
import { InfoIcon } from './icons'

interface InfoTipProps {
  /** Short accessible name for the tip button. */
  label: string
  /** Tooltip body explaining the calculation. */
  children: string
}

/** Inline ⓘ control that shows an explanation on hover / keyboard focus. */
export function InfoTip({ label, children }: InfoTipProps) {
  const tipId = useId()
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-btn"
        aria-label={label}
        aria-describedby={tipId}
      >
        <InfoIcon />
      </button>
      <span id={tipId} className="info-tip-bubble" role="tooltip">
        {children}
      </span>
    </span>
  )
}
