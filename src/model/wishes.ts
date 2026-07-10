/** Primogems per Intertwined Fate / wish. */
export const PRIMOS_PER_PULL = 160

/** Primogems from completing all four daily commissions. */
export const PRIMOS_PER_DAILY = 60

/** Pulls earned per day from commissions alone (60 / 160). */
export const PULLS_FROM_DAILIES_PER_DAY = PRIMOS_PER_DAILY / PRIMOS_PER_PULL

/** Character event wish hard pity. */
export const HARD_PITY = 90

/** Soft pity begins on this pull count within the pity cycle (1-indexed after the pull). */
export const SOFT_PITY_START = 74

const BASE_FIVE_STAR_RATE = 0.006
const SOFT_PITY_INCREMENT = 0.06

/**
 * 5★ rate for the pull that brings pity to `pityAfterPull` (1…90).
 * Community soft-pity model: 0.6% until 73, then +6% each pull through 90.
 */
export function fiveStarRate(pityAfterPull: number): number {
  if (pityAfterPull >= HARD_PITY) return 1
  if (pityAfterPull < SOFT_PITY_START) return BASE_FIVE_STAR_RATE
  return Math.min(1, BASE_FIVE_STAR_RATE + SOFT_PITY_INCREMENT * (pityAfterPull - (SOFT_PITY_START - 1)))
}

export function pullsFromPrimos(primos: number): number {
  if (!Number.isFinite(primos) || primos <= 0) return 0
  return Math.floor(primos / PRIMOS_PER_PULL)
}

export function totalPullsAvailable(savedPulls: number, primos = 0): number {
  const saved = Number.isFinite(savedPulls) ? Math.max(0, Math.floor(savedPulls)) : 0
  return saved + pullsFromPrimos(primos)
}

export interface PityProbabilityPoint {
  /** Pity count after the pull that yields the 5★ (1–90). */
  pity: number
  /** Probability the next 5★ lands exactly here, starting from `fromPity`. */
  probability: number
}

/**
 * Distribution of where the next 5★ lands, starting from `fromPity` (0–89).
 * From 0 this is the familiar soft-pity “bell” peaking in the mid-70s.
 */
export function nextFiveStarDistribution(fromPity = 0): PityProbabilityPoint[] {
  const start = clampPity(fromPity)
  const points: PityProbabilityPoint[] = []
  let survival = 1

  for (let pity = start + 1; pity <= HARD_PITY; pity++) {
    const rate = fiveStarRate(pity)
    const probability = survival * rate
    points.push({ pity, probability })
    survival *= 1 - rate
    if (survival < 1e-15) break
  }

  return points
}

export interface FeaturedSuccessInput {
  /** Pulls since last 5★ (0–89). */
  currentPity: number
  /** Total wishes you can make. */
  pullsAvailable: number
  /** True if the next 5★ is guaranteed featured. */
  guaranteed: boolean
}

/**
 * Probability of obtaining the featured 5★ character at least once
 * within `pullsAvailable` wishes on the character event banner.
 */
export function featuredSuccessChance(input: FeaturedSuccessInput): number {
  const pity = clampPity(input.currentPity)
  const pulls = Math.max(0, Math.floor(input.pullsAvailable))
  if (pulls <= 0) return 0

  const memo = new Map<string, number>()

  function chance(currentPity: number, pullsLeft: number, guaranteed: boolean): number {
    if (pullsLeft <= 0) return 0

    const key = `${currentPity}|${pullsLeft}|${guaranteed ? 1 : 0}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    const nextPity = currentPity + 1
    const p5 = fiveStarRate(nextPity)

    const afterMiss = (1 - p5) * chance(nextPity, pullsLeft - 1, guaranteed)

    let afterHit: number
    if (guaranteed) {
      afterHit = p5 * 1
    } else {
      // 50/50 win → success; lose → pity resets, next 5★ guaranteed
      afterHit = p5 * (0.5 + 0.5 * chance(0, pullsLeft - 1, true))
    }

    const result = afterMiss + afterHit
    memo.set(key, result)
    return result
  }

  return chance(pity, pulls, input.guaranteed)
}

/**
 * Minimum pulls needed to reach at least `targetChance` of getting the featured 5★.
 * Returns 0 if already there with 0 pulls (only when target is 0).
 */
export function pullsToReachChance(input: {
  currentPity: number
  guaranteed: boolean
  targetChance: number
  /** Already-owned pulls counted toward the goal. */
  alreadyHave?: number
}): { pullsNeeded: number; pullsShort: number; alreadyMet: boolean } {
  const target = input.targetChance
  if (!(target > 0 && target < 1)) {
    throw new Error('targetChance must be between 0 and 1 (exclusive)')
  }

  const alreadyHave = Math.max(0, Math.floor(input.alreadyHave ?? 0))
  const base = {
    currentPity: input.currentPity,
    guaranteed: input.guaranteed,
  }

  if (featuredSuccessChance({ ...base, pullsAvailable: alreadyHave }) >= target) {
    return { pullsNeeded: alreadyHave, pullsShort: 0, alreadyMet: true }
  }

  // Worst case ~two hard pities; search a bit beyond for high targets.
  const maxPulls = HARD_PITY * 3
  let lo = alreadyHave
  let hi = maxPulls
  while (
    hi < maxPulls * 2 &&
    featuredSuccessChance({ ...base, pullsAvailable: hi }) < target
  ) {
    hi *= 2
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (featuredSuccessChance({ ...base, pullsAvailable: mid }) >= target) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  return {
    pullsNeeded: lo,
    pullsShort: Math.max(0, lo - alreadyHave),
    alreadyMet: false,
  }
}

/** Pulls per day required to cover `pullsShort` over `days`. */
export function pullsPerDay(pullsShort: number, days: number): number {
  if (pullsShort <= 0) return 0
  if (!(days > 0)) return Number.POSITIVE_INFINITY
  return pullsShort / days
}

/**
 * How much daily commissions contribute toward the remaining pulls for a goal.
 */
export function dailiesContribution(
  pullsShort: number,
  days: number,
): { pullsFromDailies: number; percentOfGoal: number } {
  const safeDays = Math.max(0, days)
  const pullsFromDailies = PULLS_FROM_DAILIES_PER_DAY * safeDays
  if (pullsShort <= 0) {
    return { pullsFromDailies, percentOfGoal: 100 }
  }
  return {
    pullsFromDailies,
    percentOfGoal: Math.min(100, (pullsFromDailies / pullsShort) * 100),
  }
}

function clampPity(pity: number): number {
  if (!Number.isFinite(pity)) return 0
  return Math.min(HARD_PITY - 1, Math.max(0, Math.floor(pity)))
}
