import { describe, expect, it } from 'vitest'
import {
  DOMAIN_FIVE_STAR_PER_RUN,
  MAIN_STAT_RATES,
  RESIN_PER_RUN,
  SLOT_CHANCE,
  SUBSTAT_WEIGHTS,
} from './rates.ts'

describe('artifact rates', () => {
  it('gives each slot equal weight', () => {
    expect(SLOT_CHANCE).toBeCloseTo(0.2)
  })

  it('uses max-domain 5★ drop and resin cost', () => {
    expect(DOMAIN_FIVE_STAR_PER_RUN).toBeCloseTo(1.065)
    expect(RESIN_PER_RUN).toBe(20)
  })

  it('locks flower and plume main stats', () => {
    expect(MAIN_STAT_RATES.flower.hp).toBe(1)
    expect(MAIN_STAT_RATES.plume.atk).toBe(1)
  })

  it('has sands main-stat probabilities that sum to 1', () => {
    const total = Object.values(MAIN_STAT_RATES.sands).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
    expect(MAIN_STAT_RATES.sands.atkPercent).toBeCloseTo(8 / 30)
    expect(MAIN_STAT_RATES.sands.energyRecharge).toBeCloseTo(0.1)
  })

  it('has goblet elemental damage at 5% each and EM at 2.5%', () => {
    expect(MAIN_STAT_RATES.goblet.pyroDamage).toBeCloseTo(0.05)
    expect(MAIN_STAT_RATES.goblet.elementalMastery).toBeCloseTo(0.025)
    const total = Object.values(MAIN_STAT_RATES.goblet).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
  })

  it('has circlet crit mains at 10% and EM at 4%', () => {
    expect(MAIN_STAT_RATES.circlet.critRate).toBeCloseTo(0.1)
    expect(MAIN_STAT_RATES.circlet.critDamage).toBeCloseTo(0.1)
    expect(MAIN_STAT_RATES.circlet.elementalMastery).toBeCloseTo(0.04)
    const total = Object.values(MAIN_STAT_RATES.circlet).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
  })

  it('weights flat substats highest and crit lowest', () => {
    expect(SUBSTAT_WEIGHTS.hp).toBe(6)
    expect(SUBSTAT_WEIGHTS.atkPercent).toBe(4)
    expect(SUBSTAT_WEIGHTS.critRate).toBe(3)
    expect(SUBSTAT_WEIGHTS.critDamage).toBe(3)
  })
})
