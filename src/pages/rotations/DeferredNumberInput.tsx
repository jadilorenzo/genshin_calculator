import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'

type DeferredNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value: number
  onCommit: (value: number) => void
  /** Display formatting while not editing. */
  formatDisplay?: (value: number) => string
}

const formatDefault = (value: number) => {
  if (!Number.isFinite(value)) return ''
  // Avoid noisy trailing float junk while keeping typed precision.
  return String(Number(value.toPrecision(12)))
}

const parseDraft = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (
    trimmed === '' ||
    trimmed === '-' ||
    trimmed === '.' ||
    trimmed === '-.' ||
    trimmed === '+'
  ) {
    return null
  }
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/**
 * Number field that keeps a free draft while focused and only commits
 * (clamp / normalize / parent update) on blur or Enter.
 */
export function DeferredNumberInput({
  value,
  onCommit,
  formatDisplay = formatDefault,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}: DeferredNumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => formatDisplay(value))

  useEffect(() => {
    if (!focused) setDraft(formatDisplay(value))
  }, [value, focused, formatDisplay])

  const commit = () => {
    const parsed = parseDraft(draft)
    if (parsed == null) {
      setDraft(formatDisplay(value))
      return
    }
    onCommit(parsed)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={focused ? draft : formatDisplay(value)}
      onFocus={(e) => {
        setFocused(true)
        setDraft(formatDisplay(value))
        onFocus?.(e)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setFocused(false)
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        onKeyDown?.(e)
      }}
    />
  )
}
