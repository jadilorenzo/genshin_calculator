import { describe, expect, it } from 'vitest'
import {
  dropsForLineupConfidence,
  expectedDropsToFillLineup,
  expectedDropsToFillLineupWithOffPiece,
  lineupPieceProbability,
} from './buildLineup.ts'

describe('lineupPieceProbability', () => {
  it('uses set × slot × main for a locked flower', () => {
    // 0.5 × 0.2 × 1 = 0.1
    expect(lineupPieceProbability({ slot: 'flower', mainStat: 'hp' }, 0.5)).toBeCloseTo(0.1)
  })
})

describe('expectedDropsToFillLineup', () => {
  it('is less than summing solo geometrics when farming in parallel', () => {
    const probs = [0.1, 0.1, 0.1, 0.1, 0.1]
    const parallel = expectedDropsToFillLineup(probs)
    const naive = probs.reduce((sum, p) => sum + 1 / p, 0)
    expect(parallel).toBeLessThan(naive)
    expect(parallel).toBeGreaterThan(0)
  })

  it('matches two equal exclusive pieces', () => {
    expect(expectedDropsToFillLineup([0.5, 0.5])).toBeCloseTo(3)
  })

  it('returns 0 for an empty lineup', () => {
    expect(expectedDropsToFillLineup([])).toBe(0)
  })
})

describe('expectedDropsToFillLineupWithOffPiece', () => {
  it('is faster than requiring every piece on-set', () => {
    const on = [0.1, 0.1, 0.1]
    const off = [0.1, 0.1, 0.1]
    const withOff = expectedDropsToFillLineupWithOffPiece(on, off)
    const onSetOnly = expectedDropsToFillLineup(on)
    expect(withOff).toBeLessThan(onSetOnly)
  })
})

describe('dropsForLineupConfidence', () => {
  it('needs more drops for higher confidence', () => {
    const probs = [0.2, 0.2]
    const mid = dropsForLineupConfidence(probs, 0.5)
    const high = dropsForLineupConfidence(probs, 0.95)
    expect(high).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(0)
  })
})
