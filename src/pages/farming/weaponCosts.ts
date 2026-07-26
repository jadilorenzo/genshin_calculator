import weaponCosts from '../../data/weaponLevelCosts.json'
import type { MaterialInfo, WeaponGoal, WeaponRarity } from './types'
import { levelToAscension } from './types'

const MYSTIC_ORE = 'Mystic Enhancement Ore'
const MORA = 'Mora'
const ORE_XP = weaponCosts.mysticOreXp

/** Meta for materials introduced by weapon leveling (not always in character dump). */
export const WEAPON_MATERIAL_INFO: Record<string, MaterialInfo> = {
  [MYSTIC_ORE]: {
    name: MYSTIC_ORE,
    rarity: 3,
    typeText: 'Weapon Enhancement Material',
    daysOfWeek: [],
    domain: null,
    icon: 'UI_ItemIcon_104013',
  },
  [MORA]: {
    name: MORA,
    rarity: 3,
    typeText: 'Common Currency',
    daysOfWeek: [],
    domain: null,
    icon: 'UI_ItemIcon_202',
  },
}

function cumulativeExp(rarity: WeaponRarity, level: number): number {
  const table = weaponCosts.cumulativeExp[String(rarity) as '4' | '5']
  const lv = Math.max(1, Math.min(90, Math.round(level)))
  return table[lv] ?? 0
}

function ascensionMora(
  rarity: WeaponRarity,
  fromAscension: number,
  toAscension: number,
): number {
  if (toAscension <= fromAscension) return 0
  const phases = weaponCosts.ascensionMora[String(rarity) as '4' | '5']
  let total = 0
  for (let i = fromAscension; i < toAscension; i += 1) {
    total += phases[i] ?? 0
  }
  return total
}

/** Mora + mystic ore to raise a 4★/5★ weapon from current → target level. */
export function weaponNeeds(weapon: WeaponGoal): Record<string, number> {
  const rarity = weapon.rarity === 4 ? 4 : 5
  const from = Math.min(weapon.currentLevel, weapon.targetLevel)
  const to = Math.max(weapon.currentLevel, weapon.targetLevel)
  if (to <= from) return {}

  const xp = Math.max(0, cumulativeExp(rarity, to) - cumulativeExp(rarity, from))
  const ores = xp > 0 ? Math.ceil(xp / ORE_XP) : 0
  const levelMora = xp > 0 ? Math.ceil(xp / 10) : 0
  const ascendMora = ascensionMora(
    rarity,
    levelToAscension(from),
    levelToAscension(to),
  )
  const mora = levelMora + ascendMora

  const out: Record<string, number> = {}
  if (ores > 0) out[MYSTIC_ORE] = ores
  if (mora > 0) out[MORA] = mora
  return out
}
