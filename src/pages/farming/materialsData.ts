import raw from '../../data/characterMaterials.json'
import type {
  CharacterMaterials,
  FarmingPlanEntry,
  MaterialCost,
  MaterialInfo,
} from './types'
import { ASCEND_KEYS, TALENT_KEYS, levelToAscension } from './types'

type MaterialsFile = {
  ascendLabels: Record<string, string>
  talentLabels: Record<string, string>
  materials: MaterialInfo[]
  characters: CharacterMaterials[]
}

const data = raw as MaterialsFile

export const ASCEND_LABELS = data.ascendLabels
export const TALENT_LABELS = data.talentLabels
export const MATERIAL_LIST = data.materials
export const MATERIAL_CHARACTERS = data.characters

export const MATERIAL_BY_NAME: Record<string, MaterialInfo> =
  Object.fromEntries(MATERIAL_LIST.map((m) => [m.name, m]))

export const MATERIAL_CHAR_BY_ID: Record<string, CharacterMaterials> =
  Object.fromEntries(MATERIAL_CHARACTERS.map((c) => [c.id, c]))

const MATERIAL_ICON_CDN = 'https://gi.yatta.moe/assets/UI'

export function materialIconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  return `${MATERIAL_ICON_CDN}/${icon}.png`
}

function addCosts(
  into: Record<string, number>,
  items: MaterialCost[] | undefined,
) {
  if (!items) return
  for (const item of items) {
    into[item.name] = (into[item.name] || 0) + item.count
  }
}

/** Materials to go from completedAscension → targetAscension (exclusive of completed). */
export function ascensionNeeds(
  character: CharacterMaterials,
  currentAscension: number,
  targetAscension: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  const from = Math.max(0, Math.min(6, currentAscension))
  const to = Math.max(0, Math.min(6, targetAscension))
  if (to <= from) return out
  for (let i = from; i < to; i += 1) {
    addCosts(out, character.ascension[ASCEND_KEYS[i]])
  }
  return out
}

/**
 * Talent book/mob costs to raise one talent from `current` to `target`.
 * Talent levels are 1–10; costs are keyed lvl2…lvl10.
 */
export function talentNeeds(
  character: CharacterMaterials,
  current: number,
  target: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  const from = Math.max(1, Math.min(10, current))
  const to = Math.max(1, Math.min(10, target))
  if (to <= from) return out
  for (let level = from + 1; level <= to; level += 1) {
    const key = `lvl${level}` as (typeof TALENT_KEYS)[number]
    addCosts(out, character.talent[key])
  }
  return out
}

export function mergeNeeds(
  ...parts: Array<Record<string, number>>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of parts) {
    for (const [name, count] of Object.entries(part)) {
      out[name] = (out[name] || 0) + count
    }
  }
  return out
}

export function planNeeds(plan: FarmingPlanEntry): Record<string, number> {
  const character = MATERIAL_CHAR_BY_ID[plan.characterId]
  if (!character) return {}
  return mergeNeeds(
    ascensionNeeds(
      character,
      levelToAscension(plan.currentLevel),
      levelToAscension(plan.targetLevel),
    ),
    talentNeeds(
      character,
      plan.talents.normal.current,
      plan.talents.normal.target,
    ),
    talentNeeds(
      character,
      plan.talents.skill.current,
      plan.talents.skill.target,
    ),
    talentNeeds(
      character,
      plan.talents.burst.current,
      plan.talents.burst.target,
    ),
  )
}

export function planProgress(
  plan: FarmingPlanEntry,
  inventory: Record<string, number>,
  checkedMaterials: Record<string, boolean>,
): { pct: number; remainingUnits: number; neededUnits: number } {
  const needs = planNeeds(plan)
  let neededUnits = 0
  let ownedUnits = 0
  for (const [name, needed] of Object.entries(needs)) {
    neededUnits += needed
    if (checkedMaterials[name]) ownedUnits += needed
    else ownedUnits += Math.min(inventory[name] || 0, needed)
  }
  return {
    pct: neededUnits > 0 ? (ownedUnits / neededUnits) * 100 : plan.checked ? 100 : 0,
    remainingUnits: Math.max(0, neededUnits - ownedUnits),
    neededUnits,
  }
}

export function aggregateNeeds(
  plans: FarmingPlanEntry[],
): Record<string, number> {
  return mergeNeeds(...plans.filter((p) => !p.checked).map(planNeeds))
}

export type ResourceProgress = {
  name: string
  needed: number
  owned: number
  remaining: number
  pct: number
  checked: boolean
  info: MaterialInfo | undefined
}

export function resourceProgressList(
  needs: Record<string, number>,
  inventory: Record<string, number>,
  checkedMaterials: Record<string, boolean>,
): ResourceProgress[] {
  return Object.entries(needs)
    .map(([name, needed]) => {
      const owned = Math.max(0, inventory[name] || 0)
      const checked = Boolean(checkedMaterials[name])
      const effectiveOwned = checked ? needed : Math.min(owned, needed)
      const pct = needed > 0 ? Math.min(100, (effectiveOwned / needed) * 100) : 100
      return {
        name,
        needed,
        owned,
        remaining: Math.max(0, needed - (checked ? needed : owned)),
        pct,
        checked,
        info: MATERIAL_BY_NAME[name],
      }
    })
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      if (a.pct !== b.pct) return a.pct - b.pct
      return a.name.localeCompare(b.name)
    })
}

export function overallProgress(resources: ResourceProgress[]): {
  pct: number
  ownedUnits: number
  neededUnits: number
  completeCount: number
  totalCount: number
} {
  let ownedUnits = 0
  let neededUnits = 0
  let completeCount = 0
  for (const row of resources) {
    neededUnits += row.needed
    ownedUnits += row.checked ? row.needed : Math.min(row.owned, row.needed)
    if (row.checked || row.owned >= row.needed) completeCount += 1
  }
  return {
    pct: neededUnits > 0 ? (ownedUnits / neededUnits) * 100 : 0,
    ownedUnits,
    neededUnits,
    completeCount,
    totalCount: resources.length,
  }
}

/** Talent/domain materials available on a given weekday. */
export function materialsForWeekday(day: string): MaterialInfo[] {
  return MATERIAL_LIST.filter((m) => m.daysOfWeek.includes(day)).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}
