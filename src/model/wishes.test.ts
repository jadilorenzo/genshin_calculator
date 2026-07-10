import { describe, expect, it } from 'vitest'
import {
  HARD_PITY,
  dailiesContribution,
  featuredSuccessChance,
  fiveStarRate,
  nextFiveStarDistribution,
  pullsFromPrimos,
  pullsPerDay,
  pullsToReachChance,
  totalPullsAvailable,
} from './wishes.ts'

describe('fiveStarRate', () => {
  it('is 0.6% before soft pity', () => {
    expect(fiveStarRate(1)).toBeCloseTo(0.006)
    expect(fiveStarRate(73)).toBeCloseTo(0.006)
  })

  it('ramps during soft pity and hits 100% at hard pity', () => {
    expect(fiveStarRate(74)).toBeCloseTo(0.066)
    expect(fiveStarRate(HARD_PITY)).toBe(1)
  })
})

describe('primo conversion', () => {
  it('converts primos at 160 each', () => {
    expect(pullsFromPrimos(160)).toBe(1)
    expect(pullsFromPrimos(319)).toBe(1)
    expect(pullsFromPrimos(320)).toBe(2)
  })

  it('sums saved pulls and primo pulls', () => {
    expect(totalPullsAvailable(10, 320)).toBe(12)
  })
})

describe('nextFiveStarDistribution', () => {
  it('sums to ~1 from pity 0', () => {
    const points = nextFiveStarDistribution(0)
    const total = points.reduce((sum, p) => sum + p.probability, 0)
    expect(total).toBeCloseTo(1, 5)
    const peak = points.reduce((best, p) => (p.probability > best.probability ? p : best))
    expect(peak.pity).toBeGreaterThanOrEqual(74)
    expect(peak.pity).toBeLessThanOrEqual(85)
  })

  it('only includes pity after the current counter', () => {
    const points = nextFiveStarDistribution(80)
    expect(points[0]?.pity).toBe(81)
    expect(points[points.length - 1]?.pity).toBe(90)
  })
})

describe('featuredSuccessChance', () => {
  it('is 0 with no pulls', () => {
    expect(featuredSuccessChance({ currentPity: 0, pullsAvailable: 0, guaranteed: false })).toBe(0)
  })

  it('is 100% at pity 89 with one pull when guaranteed', () => {
    expect(
      featuredSuccessChance({ currentPity: 89, pullsAvailable: 1, guaranteed: true }),
    ).toBeCloseTo(1)
  })

  it('is 50% at pity 89 with one pull on a 50/50', () => {
    expect(
      featuredSuccessChance({ currentPity: 89, pullsAvailable: 1, guaranteed: false }),
    ).toBeCloseTo(0.5)
  })

  it('is higher when guaranteed than on 50/50 for the same budget', () => {
    const base = { currentPity: 20, pullsAvailable: 80 }
    const fifty = featuredSuccessChance({ ...base, guaranteed: false })
    const guar = featuredSuccessChance({ ...base, guaranteed: true })
    expect(guar).toBeGreaterThan(fifty)
  })

  it('approaches certainty with a full double-pity budget from zero', () => {
    const p = featuredSuccessChance({
      currentPity: 0,
      pullsAvailable: 180,
      guaranteed: false,
    })
    expect(p).toBeGreaterThan(0.95)
  })
})

describe('pullsToReachChance', () => {
  it('finds a budget that meets the likely threshold', () => {
    const { pullsNeeded, pullsShort, alreadyMet } = pullsToReachChance({
      currentPity: 0,
      guaranteed: false,
      targetChance: 0.75,
      alreadyHave: 0,
    })
    expect(alreadyMet).toBe(false)
    expect(pullsShort).toBe(pullsNeeded)
    expect(
      featuredSuccessChance({
        currentPity: 0,
        pullsAvailable: pullsNeeded,
        guaranteed: false,
      }),
    ).toBeGreaterThanOrEqual(0.75)
    expect(
      featuredSuccessChance({
        currentPity: 0,
        pullsAvailable: pullsNeeded - 1,
        guaranteed: false,
      }),
    ).toBeLessThan(0.75)
  })

  it('reports already met when saved pulls are enough', () => {
    const result = pullsToReachChance({
      currentPity: 89,
      guaranteed: true,
      targetChance: 0.75,
      alreadyHave: 1,
    })
    expect(result.alreadyMet).toBe(true)
    expect(result.pullsShort).toBe(0)
  })
})

describe('pullsPerDay', () => {
  it('spreads remaining pulls across days', () => {
    expect(pullsPerDay(21, 7)).toBe(3)
    expect(pullsPerDay(0, 7)).toBe(0)
  })
})

describe('dailiesContribution', () => {
  it('credits 60 primos per day toward the remaining pull goal', () => {
    // 11 days × 0.375 pulls = 4.125; of 10 pulls short → 41.25%
    const result = dailiesContribution(10, 11)
    expect(result.pullsFromDailies).toBeCloseTo(4.125)
    expect(result.percentOfGoal).toBeCloseTo(41.25)
  })

  it('caps at 100% when dailies alone cover the shortfall', () => {
    expect(dailiesContribution(2, 11).percentOfGoal).toBe(100)
  })
})
