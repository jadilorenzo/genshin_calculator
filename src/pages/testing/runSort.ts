import type { TestingRun } from './types'

export function runTimestampMs(run: TestingRun): number {
  const raw = run.capturedAt || run.createdAt
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : 0
}

/** Oldest screenshot/run first; falls back to save time then manual order. */
export function compareTestingRunsByTimestamp(a: TestingRun, b: TestingRun): number {
  const timeA = runTimestampMs(a)
  const timeB = runTimestampMs(b)
  if (timeA !== timeB) return timeA - timeB
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.createdAt.localeCompare(b.createdAt)
}

export function sortTestingRunsByTimestamp(runs: TestingRun[]): TestingRun[] {
  return [...runs].sort(compareTestingRunsByTimestamp)
}
