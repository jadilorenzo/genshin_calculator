/** datetime-local value from an ISO string. */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export const formatRunInt = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString() : ''

/** Commit any in-progress deferred number input before saving. */
export function flushFocusedField() {
  const el = document.activeElement
  if (el instanceof HTMLElement) el.blur()
}
