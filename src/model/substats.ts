import {
  ALL_SUBSTATS,
  SUBSTAT_WEIGHTS,
  type Substat,
} from './rates'
import type { Stat, SubstatMode } from './types'

const LINE_COUNT = 4

function isSubstat(stat: Stat): stat is Substat {
  return stat in SUBSTAT_WEIGHTS
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > items.length) return []
  const [first, ...rest] = items
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    return permutations(rest).map((perm) => [item, ...perm])
  })
}

/** Probability of rolling an exact unordered set of four substats. */
function probabilityOfExactSet(mainStat: Stat, set: Substat[]): number {
  let total = 0
  for (const order of permutations(set)) {
    let p = 1
    const remaining = new Map(
      ALL_SUBSTATS.filter((s) => s !== mainStat).map((s) => [s, SUBSTAT_WEIGHTS[s]]),
    )
    for (const stat of order) {
      const weight = remaining.get(stat)
      if (weight === undefined) {
        p = 0
        break
      }
      let totalWeight = 0
      for (const w of remaining.values()) totalWeight += w
      p *= weight / totalWeight
      remaining.delete(stat)
    }
    total += p
  }
  return total
}

function normalizeRequired(
  mainStat: Stat,
  requiredSubstats: Stat[],
): Substat[] | null {
  const required: Substat[] = []
  const seen = new Set<Stat>()
  for (const stat of requiredSubstats) {
    if (stat === mainStat) return null
    if (!isSubstat(stat)) return null
    if (seen.has(stat)) return null
    seen.add(stat)
    required.push(stat)
  }
  return required
}

/** Probability that none of `avoided` appear among the four lines. */
function probabilityOfAvoidingSubstats(mainStat: Stat, avoided: Substat[]): number {
  const blocked = new Set<Stat>(avoided)
  const pool = ALL_SUBSTATS.filter((s) => s !== mainStat && !blocked.has(s))
  if (pool.length < LINE_COUNT) return 0
  let total = 0
  for (const combo of combinations(pool, LINE_COUNT)) {
    total += probabilityOfExactSet(mainStat, combo)
  }
  return total
}

function probabilityOfAllRequired(mainStat: Stat, required: Substat[]): number {
  if (required.length > LINE_COUNT) return 0
  const blocked = new Set<Stat>(required)
  const pool = ALL_SUBSTATS.filter((s) => s !== mainStat && !blocked.has(s))
  const extrasNeeded = LINE_COUNT - required.length
  let total = 0
  for (const extras of combinations(pool, extrasNeeded)) {
    total += probabilityOfExactSet(mainStat, [...required, ...extras])
  }
  return total
}

/**
 * Probability that a 5★ artifact's four substat lines match the requirement.
 * - `all`: every required substat appears
 * - `any`: at least one required substat appears
 */
export function probabilityOfRequiredSubstats(
  mainStat: Stat,
  requiredSubstats: Stat[],
  mode: SubstatMode = 'all',
): number {
  if (requiredSubstats.length === 0) return 1

  const required = normalizeRequired(mainStat, requiredSubstats)
  if (required === null) return 0

  if (mode === 'any') {
    return 1 - probabilityOfAvoidingSubstats(mainStat, required)
  }

  return probabilityOfAllRequired(mainStat, required)
}
