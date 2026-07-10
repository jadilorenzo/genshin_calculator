import {
  ALL_SUBSTATS,
  SUBSTAT_WEIGHTS,
  type Substat,
} from './rates'
import type { Stat } from './types'

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

/**
 * Probability that a 5★ artifact's four substat lines include every required
 * substat. Flower/plume/sands/goblet/circlet all use the same weighted draws;
 * the main stat is excluded from the pool.
 */
export function probabilityOfRequiredSubstats(
  mainStat: Stat,
  requiredSubstats: Stat[],
): number {
  if (requiredSubstats.length === 0) return 1
  if (requiredSubstats.length > LINE_COUNT) return 0

  const required: Substat[] = []
  const seen = new Set<Stat>()
  for (const stat of requiredSubstats) {
    if (stat === mainStat) return 0
    if (!isSubstat(stat)) return 0
    if (seen.has(stat)) return 0
    seen.add(stat)
    required.push(stat)
  }

  const pool = ALL_SUBSTATS.filter((s) => s !== mainStat && !seen.has(s))
  const extrasNeeded = LINE_COUNT - required.length
  let total = 0
  for (const extras of combinations(pool, extrasNeeded)) {
    total += probabilityOfExactSet(mainStat, [...required, ...extras])
  }
  return total
}
