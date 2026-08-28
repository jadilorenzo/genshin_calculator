import type { TestingRun } from './types'

/** Oldest screenshot/run first; falls back to save time then manual order. */
export function compareTestingRunsByTimestamp(a: TestingRun, b: TestingRun): number {
  const timeA = a.capturedAt || a.createdAt
  const timeB = b.capturedAt || b.createdAt
  const byTime = timeA.localeCompare(timeB)
  if (byTime !== 0) return byTime
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.createdAt.localeCompare(b.createdAt)
}

export function sortTestingRunsByTimestamp(runs: TestingRun[]): TestingRun[] {
  return [...runs].sort(compareTestingRunsByTimestamp)
}
