import type { Slot, Stat } from './types'

export const SLOT_LABELS: Record<Slot, string> = {
  flower: 'Flower',
  plume: 'Feather',
  sands: 'Sands',
  goblet: 'Goblet',
  circlet: 'Circlet',
}

export const STAT_LABELS: Record<Stat, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  hpPercent: 'HP%',
  atkPercent: 'ATK%',
  defPercent: 'DEF%',
  energyRecharge: 'Energy Recharge',
  elementalMastery: 'Elemental Mastery',
  critRate: 'CRIT Rate',
  critDamage: 'CRIT DMG',
  healingBonus: 'Healing Bonus',
  pyroDamage: 'Pyro DMG',
  electroDamage: 'Electro DMG',
  cryoDamage: 'Cryo DMG',
  hydroDamage: 'Hydro DMG',
  dendroDamage: 'Dendro DMG',
  anemoDamage: 'Anemo DMG',
  geoDamage: 'Geo DMG',
  physicalDamage: 'Physical DMG',
}

export const SLOTS: Slot[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

/** 50% chance of at least one match. */
export const LIKELY_CONFIDENCE = 0.5

/** 95% chance of at least one match (“effectively guaranteed”). */
export const GUARANTEED_CONFIDENCE = 0.95
