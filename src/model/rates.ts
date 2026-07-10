import type { Slot, Stat } from './types'

/** Equal chance among the five artifact slots. */
export const SLOT_CHANCE = 1 / 5

/** Original Resin cost of one Domain of Blessing claim. */
export const RESIN_PER_RUN = 20

/**
 * Average 5★ artifacts per 20 Resin at AR45+ max domain difficulty (KQM).
 * Modeled as 1 guaranteed + 6.5% chance of a second.
 */
export const DOMAIN_FIVE_STAR_PER_RUN = 1.065

/** Community-derived main-stat probabilities by slot (wiki Artifact/Distribution). */
export const MAIN_STAT_RATES: Record<Slot, Partial<Record<Stat, number>>> = {
  flower: { hp: 1 },
  plume: { atk: 1 },
  sands: {
    hpPercent: 8 / 30,
    atkPercent: 8 / 30,
    defPercent: 8 / 30,
    energyRecharge: 3 / 30,
    elementalMastery: 3 / 30,
  },
  goblet: {
    hpPercent: 0.1925,
    atkPercent: 0.1925,
    defPercent: 0.19,
    pyroDamage: 0.05,
    electroDamage: 0.05,
    cryoDamage: 0.05,
    hydroDamage: 0.05,
    dendroDamage: 0.05,
    anemoDamage: 0.05,
    geoDamage: 0.05,
    physicalDamage: 0.05,
    elementalMastery: 0.025,
  },
  circlet: {
    hpPercent: 0.22,
    atkPercent: 0.22,
    defPercent: 0.22,
    critRate: 0.1,
    critDamage: 0.1,
    healingBonus: 0.1,
    elementalMastery: 0.04,
  },
}

/** Fixed weights for initial / unlock substat rolls. */
export const SUBSTAT_WEIGHTS: Record<
  Exclude<
    Stat,
    | 'healingBonus'
    | 'pyroDamage'
    | 'electroDamage'
    | 'cryoDamage'
    | 'hydroDamage'
    | 'dendroDamage'
    | 'anemoDamage'
    | 'geoDamage'
    | 'physicalDamage'
  >,
  number
> = {
  hp: 6,
  atk: 6,
  def: 6,
  hpPercent: 4,
  atkPercent: 4,
  defPercent: 4,
  energyRecharge: 4,
  elementalMastery: 4,
  critRate: 3,
  critDamage: 3,
}

export type Substat = keyof typeof SUBSTAT_WEIGHTS

export const ALL_SUBSTATS = Object.keys(SUBSTAT_WEIGHTS) as Substat[]
