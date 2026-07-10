import { describe, expect, it } from 'vitest'
import { artifactProbability, estimateResin } from './probability.ts'

describe('artifactProbability', () => {
  it('multiplies set, slot, and main-stat chances for a flower with no substat filter', () => {
    const result = artifactProbability({
      setChance: 0.5,
      slot: 'flower',
      mainStat: 'hp',
    })

    expect(result.set).toBe(0.5)
    expect(result.slot).toBeCloseTo(0.2)
    expect(result.mainStat).toBe(1)
    expect(result.substats).toBe(1)
    expect(result.total).toBeCloseTo(0.5 * 0.2)
  })

  it('defaults set chance to 0.5', () => {
    const result = artifactProbability({
      slot: 'plume',
      mainStat: 'atk',
    })
    expect(result.set).toBe(0.5)
  })

  it('returns 0 for an impossible main stat on a slot', () => {
    const result = artifactProbability({
      slot: 'flower',
      mainStat: 'critRate',
    })
    expect(result.mainStat).toBe(0)
    expect(result.total).toBe(0)
  })

  it('applies goblet elemental main-stat rarity', () => {
    const result = artifactProbability({
      slot: 'goblet',
      mainStat: 'pyroDamage',
      requiredSubstats: [],
    })
    expect(result.mainStat).toBeCloseTo(0.05)
    expect(result.total).toBeCloseTo(0.5 * 0.2 * 0.05)
  })

  it('reduces probability when double crit is required on a circlet', () => {
    const mainOnly = artifactProbability({
      slot: 'circlet',
      mainStat: 'critRate',
    })
    const withSubs = artifactProbability({
      slot: 'circlet',
      mainStat: 'critRate',
      requiredSubstats: ['critDamage', 'atkPercent'],
    })
    expect(withSubs.total).toBeLessThan(mainOnly.total)
    expect(withSubs.substats).toBeLessThan(1)
  })
})

describe('estimateResin', () => {
  it('scales expected resin from per-artifact probability and domain drop rate', () => {
    // On-set flower (any subs): p = 0.5 * 0.2 = 0.1
    const estimate = estimateResin({
      slot: 'flower',
      mainStat: 'hp',
    })

    expect(estimate.probabilityPerArtifact).toBeCloseTo(0.1)
    // expected matches / run = 1.065 * 0.1
    expect(estimate.expectedMatchesPerRun).toBeCloseTo(0.1065)
    expect(estimate.expectedResin).toBeCloseTo(20 / 0.1065)
  })

  it('returns higher resin for rarer targets', () => {
    const flower = estimateResin({ slot: 'flower', mainStat: 'hp' })
    const emGoblet = estimateResin({
      slot: 'goblet',
      mainStat: 'elementalMastery',
    })
    expect(emGoblet.expectedResin).toBeGreaterThan(flower.expectedResin)
  })

  it('computes resin for a given confidence via geometric distribution', () => {
    const estimate = estimateResin({
      slot: 'flower',
      mainStat: 'hp',
    })
    const resin50 = estimate.resinForConfidence(0.5)
    const resin90 = estimate.resinForConfidence(0.9)

    expect(resin50).toBeGreaterThan(0)
    expect(resin90).toBeGreaterThan(resin50)
    // 50% confidence should be near ln(0.5)/ln(1-p) artifacts * resin scaling
    expect(resin50).toBeLessThan(estimate.expectedResin)
  })

  it('throws for confidence outside (0, 1)', () => {
    const estimate = estimateResin({ slot: 'plume', mainStat: 'atk' })
    expect(() => estimate.resinForConfidence(0)).toThrow()
    expect(() => estimate.resinForConfidence(1)).toThrow()
  })
})
