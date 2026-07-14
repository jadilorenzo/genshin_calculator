import {
  DOMAIN_FIVE_STAR_PER_RUN,
  MAIN_STAT_RATES,
  RESIN_PER_RUN,
  SLOT_CHANCE,
} from './rates'
import { probabilityOfRequiredSubstats } from './substats'
import type { Slot, Stat, SubstatMode } from './types'

/** One lineup piece: slot + main, optional substat filters. */
export interface LineupPiece {
  slot: Slot
  mainStat: Stat
  requiredSubstats?: Stat[]
  substatMode?: SubstatMode
}

/**
 * How set bonus is required while farming the lineup.
 * - onSet: every piece must be on-set
 * - anySet: set does not matter
 * - oneOff: four on-set + one off-piece; which slot is off does not matter
 */
export type LineupSetMode = 'onSet' | 'anySet' | 'oneOff'

/** Average Original Resin spent per 5★ drop at AR45+. */
export const RESIN_PER_FIVE_STAR = RESIN_PER_RUN / DOMAIN_FIVE_STAR_PER_RUN

function mainChance(piece: LineupPiece): number {
  return MAIN_STAT_RATES[piece.slot][piece.mainStat] ?? 0
}

function substatChance(piece: LineupPiece): number {
  return probabilityOfRequiredSubstats(
    piece.mainStat,
    piece.requiredSubstats ?? [],
    piece.substatMode ?? 'all',
  )
}

/** Slot × main × substats (before set filter). */
export function lineupMainProbability(piece: LineupPiece): number {
  return SLOT_CHANCE * mainChance(piece) * substatChance(piece)
}

/**
 * Probability a random 5★ domain drop matches this piece under a simple set filter.
 * For `oneOff`, callers should use on/off rates separately.
 */
export function lineupPieceProbability(
  piece: LineupPiece,
  setChance = 0.5,
): number {
  return setChance * lineupMainProbability(piece)
}

/**
 * Expected number of 5★ drops to fill every remaining piece (fixed set filter).
 */
export function expectedDropsToFillLineup(probabilities: number[]): number {
  const probs = probabilities.filter((p) => p > 0)
  const n = probs.length
  if (n === 0) return 0
  if (probs.some((p) => !(p > 0 && p <= 1))) {
    return Number.POSITIVE_INFINITY
  }

  const memo = new Map<number, number>()

  function expected(mask: number): number {
    if (mask === 0) return 0
    const cached = memo.get(mask)
    if (cached !== undefined) return cached

    let progress = 0
    let weightedNext = 0
    for (let i = 0; i < n; i += 1) {
      if ((mask & (1 << i)) === 0) continue
      progress += probs[i]
      weightedNext += probs[i] * expected(mask ^ (1 << i))
    }

    if (!(progress > 0)) {
      memo.set(mask, Number.POSITIVE_INFINITY)
      return Number.POSITIVE_INFINITY
    }

    const value = (1 + weightedNext) / progress
    memo.set(mask, value)
    return value
  }

  return expected((1 << n) - 1)
}

/**
 * Expected drops when one off-piece is allowed (any unfinished slot may take it).
 * `onProbs[i]` / `offProbs[i]` are mutually exclusive with each other for the same i,
 * and slots are exclusive across i on a single drop.
 */
export function expectedDropsToFillLineupWithOffPiece(
  onProbs: number[],
  offProbs: number[],
): number {
  const n = onProbs.length
  if (n === 0) return 0
  if (offProbs.length !== n) {
    throw new Error('onProbs and offProbs must be the same length')
  }

  const memo = new Map<number, number>()
  // state key: remaining_mask | (usedOff << n)
  const bitOff = 1 << n

  function expected(remaining: number, usedOff: boolean): number {
    if (remaining === 0) return 0
    const key = remaining | (usedOff ? bitOff : 0)
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    let progress = 0
    let weightedNext = 0

    for (let i = 0; i < n; i += 1) {
      if ((remaining & (1 << i)) === 0) continue
      const onP = onProbs[i]
      if (onP > 0) {
        progress += onP
        weightedNext += onP * expected(remaining ^ (1 << i), usedOff)
      }
      if (!usedOff) {
        const offP = offProbs[i]
        if (offP > 0) {
          progress += offP
          weightedNext += offP * expected(remaining ^ (1 << i), true)
        }
      }
    }

    if (!(progress > 0)) {
      memo.set(key, Number.POSITIVE_INFINITY)
      return Number.POSITIVE_INFINITY
    }

    const value = (1 + weightedNext) / progress
    memo.set(key, value)
    return value
  }

  return expected((1 << n) - 1, false)
}

/**
 * Smallest number of 5★ drops so P(lineup complete) ≥ confidence.
 */
export function dropsForLineupConfidence(
  probabilities: number[],
  confidence: number,
): number {
  if (!(confidence > 0 && confidence < 1)) {
    throw new Error('confidence must be between 0 and 1 (exclusive)')
  }

  const probs = probabilities.filter((p) => p > 0)
  const n = probs.length
  if (n === 0) return 0
  if (probs.some((p) => !(p > 0 && p <= 1))) {
    return Number.POSITIVE_INFINITY
  }

  const full = (1 << n) - 1
  const expected = expectedDropsToFillLineup(probs)
  if (!Number.isFinite(expected)) return Number.POSITIVE_INFINITY

  let lo = 0
  let hi = Math.max(8, Math.ceil(expected * 8))

  function doneBy(drops: number): number {
    let dp = new Float64Array(full + 1)
    dp[full] = 1

    for (let t = 0; t < drops; t += 1) {
      const next = new Float64Array(full + 1)
      for (let mask = 0; mask <= full; mask += 1) {
        const mass = dp[mask]
        if (mass === 0) continue
        if (mask === 0) {
          next[0] += mass
          continue
        }

        let stay = 1
        for (let i = 0; i < n; i += 1) {
          if ((mask & (1 << i)) === 0) continue
          const p = probs[i]
          stay -= p
          next[mask ^ (1 << i)] += mass * p
        }
        next[mask] += mass * Math.max(0, stay)
      }
      dp = next
    }

    return dp[0]
  }

  while (doneBy(hi) < confidence && hi < 1_000_000) {
    hi *= 2
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (doneBy(mid) >= confidence) hi = mid
    else lo = mid + 1
  }

  return lo
}

export function dropsForLineupConfidenceWithOffPiece(
  onProbs: number[],
  offProbs: number[],
  confidence: number,
): number {
  if (!(confidence > 0 && confidence < 1)) {
    throw new Error('confidence must be between 0 and 1 (exclusive)')
  }

  const n = onProbs.length
  if (n === 0) return 0
  if (offProbs.length !== n) {
    throw new Error('onProbs and offProbs must be the same length')
  }

  const expected = expectedDropsToFillLineupWithOffPiece(onProbs, offProbs)
  if (!Number.isFinite(expected)) return Number.POSITIVE_INFINITY

  const full = (1 << n) - 1
  const stateCount = (full + 1) * 2
  const idx = (remaining: number, usedOff: boolean) => remaining + (usedOff ? full + 1 : 0)

  let lo = 0
  let hi = Math.max(8, Math.ceil(expected * 8))

  function doneBy(drops: number): number {
    let dp = new Float64Array(stateCount)
    dp[idx(full, false)] = 1

    for (let t = 0; t < drops; t += 1) {
      const next = new Float64Array(stateCount)
      for (let used = 0; used < 2; used += 1) {
        const usedOff = used === 1
        for (let remaining = 0; remaining <= full; remaining += 1) {
          const mass = dp[idx(remaining, usedOff)]
          if (mass === 0) continue
          if (remaining === 0) {
            next[idx(0, usedOff)] += mass
            continue
          }

          let stay = 1
          for (let i = 0; i < n; i += 1) {
            if ((remaining & (1 << i)) === 0) continue
            const onP = onProbs[i]
            if (onP > 0) {
              stay -= onP
              next[idx(remaining ^ (1 << i), usedOff)] += mass * onP
            }
            if (!usedOff) {
              const offP = offProbs[i]
              if (offP > 0) {
                stay -= offP
                next[idx(remaining ^ (1 << i), true)] += mass * offP
              }
            }
          }
          next[idx(remaining, usedOff)] += mass * Math.max(0, stay)
        }
      }
      dp = next
    }

    return dp[idx(0, false)] + dp[idx(0, true)]
  }

  while (doneBy(hi) < confidence && hi < 1_000_000) {
    hi *= 2
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (doneBy(mid) >= confidence) hi = mid
    else lo = mid + 1
  }

  return lo
}

function ratesForMode(
  pieces: LineupPiece[],
  mode: LineupSetMode,
): { display: number[]; onProbs: number[]; offProbs: number[] } {
  const mains = pieces.map(lineupMainProbability)

  if (mode === 'anySet') {
    return { display: mains, onProbs: mains, offProbs: mains.map(() => 0) }
  }

  if (mode === 'onSet') {
    const on = mains.map((p) => p * 0.5)
    return { display: on, onProbs: on, offProbs: mains.map(() => 0) }
  }

  // oneOff: early on, either half can fill a slot; display on+off = full main rate
  const on = mains.map((p) => p * 0.5)
  const off = mains.map((p) => p * 0.5)
  return { display: mains, onProbs: on, offProbs: off }
}

export function estimateLineupResin(
  pieces: LineupPiece[],
  mode: LineupSetMode = 'onSet',
): {
  probabilities: number[]
  expectedDrops: number
  expectedResin: number
  /** Naive sum of solo expected resin (for comparison). */
  naiveSumResin: number
  resinForConfidence: (confidence: number) => number
} {
  const { display, onProbs, offProbs } = ratesForMode(pieces, mode)

  const expectedDrops =
    mode === 'oneOff'
      ? expectedDropsToFillLineupWithOffPiece(onProbs, offProbs)
      : expectedDropsToFillLineup(onProbs)

  const expectedResin =
    Number.isFinite(expectedDrops) && expectedDrops > 0
      ? expectedDrops * RESIN_PER_FIVE_STAR
      : expectedDrops === 0
        ? 0
        : Number.POSITIVE_INFINITY

  // Solo baseline: on-set each piece (or any-set when mode is anySet).
  let naiveSumResin = 0
  for (const p of onProbs) {
    if (!(p > 0)) {
      naiveSumResin = Number.POSITIVE_INFINITY
      break
    }
    naiveSumResin += RESIN_PER_FIVE_STAR / p
  }

  return {
    probabilities: display,
    expectedDrops,
    expectedResin,
    naiveSumResin,
    resinForConfidence(confidence: number): number {
      const drops =
        mode === 'oneOff'
          ? dropsForLineupConfidenceWithOffPiece(onProbs, offProbs, confidence)
          : dropsForLineupConfidence(onProbs, confidence)
      if (!Number.isFinite(drops)) return Number.POSITIVE_INFINITY
      return drops * RESIN_PER_FIVE_STAR
    },
  }
}
