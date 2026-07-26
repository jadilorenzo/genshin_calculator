import raw from '../../data/characterMaterials.json'
import type {
  CharacterMaterials,
  FarmingPlanEntry,
  MaterialCost,
  MaterialInfo,
} from './types'
import { ASCEND_KEYS, TALENT_KEYS, WEEKDAYS, levelToAscension } from './types'
import { WEAPON_MATERIAL_INFO, weaponNeeds } from './weaponCosts'

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
  Object.fromEntries([
    ...MATERIAL_LIST.map((m) => [m.name, m] as const),
    ...Object.entries(WEAPON_MATERIAL_INFO),
  ])

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
  const grouped = planNeedsGrouped(plan)
  return mergeNeeds(grouped.ascension, grouped.talent, grouped.weapon)
}

export type MaterialGroupId = 'ascension' | 'talent' | 'weapon'

export const MATERIAL_GROUP_ORDER: MaterialGroupId[] = [
  'ascension',
  'talent',
  'weapon',
]

export const MATERIAL_GROUP_LABELS: Record<MaterialGroupId, string> = {
  ascension: 'Ascension',
  talent: 'Talents',
  weapon: 'Weapon',
}

/** Needs split by source so the checklist can group without reshuffling. */
export function planNeedsGrouped(plan: FarmingPlanEntry): Record<
  MaterialGroupId,
  Record<string, number>
> {
  const character = MATERIAL_CHAR_BY_ID[plan.characterId]
  if (!character) {
    return { ascension: {}, talent: {}, weapon: {} }
  }
  return {
    ascension: ascensionNeeds(
      character,
      levelToAscension(plan.currentLevel),
      levelToAscension(plan.targetLevel),
    ),
    talent: mergeNeeds(
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
    ),
    weapon: weaponNeeds(plan.weapon),
  }
}

export function planProgress(
  plan: FarmingPlanEntry,
  inventory: Record<string, number>,
  checkedMaterials: Record<string, boolean>,
): { pct: number; remainingUnits: number; neededUnits: number } {
  return materialsProgressFromGroups(
    resourceProgressGrouped(plan, inventory, checkedMaterials),
  )
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

export type ResourceGroup = {
  id: MaterialGroupId
  label: string
  rows: ResourceProgress[]
}

function toResourceRows(
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
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function resourceProgressList(
  needs: Record<string, number>,
  inventory: Record<string, number>,
  checkedMaterials: Record<string, boolean>,
): ResourceProgress[] {
  return toResourceRows(needs, inventory, checkedMaterials)
}

/** Grouped checklist rows — stable alpha order within each group. */
export function resourceProgressGrouped(
  plan: FarmingPlanEntry,
  inventory: Record<string, number>,
  checkedMaterials: Record<string, boolean>,
): ResourceGroup[] {
  // Unbuilt / not-obtained goals assume you have none of the mats yet.
  const effectiveInventory = plan.notObtained ? {} : inventory
  const effectiveChecked = plan.notObtained ? {} : checkedMaterials
  const grouped = planNeedsGrouped(plan)
  return MATERIAL_GROUP_ORDER.map((id) => ({
    id,
    label: MATERIAL_GROUP_LABELS[id],
    rows: toResourceRows(grouped[id], effectiveInventory, effectiveChecked),
  })).filter((group) => group.rows.length > 0)
}

export function overallProgress(resources: ResourceProgress[]): {
  /** Equal weight per material — not by raw unit count (avoids Mora skew). */
  pct: number
  ownedUnits: number
  neededUnits: number
  completeCount: number
  totalCount: number
} {
  let ownedUnits = 0
  let neededUnits = 0
  let completeCount = 0
  let pctSum = 0
  for (const row of resources) {
    neededUnits += row.needed
    ownedUnits += row.checked ? row.needed : Math.min(row.owned, row.needed)
    if (row.checked || row.owned >= row.needed) completeCount += 1
    pctSum += row.pct
  }
  return {
    pct: resources.length > 0 ? pctSum / resources.length : 0,
    ownedUnits,
    neededUnits,
    completeCount,
    totalCount: resources.length,
  }
}

/** Equal weight per group (ascension / talents / weapon), then equal weight per mat inside. */
export function materialsProgressFromGroups(groups: ResourceGroup[]): {
  pct: number
  completeCount: number
  totalCount: number
} {
  let completeCount = 0
  let totalCount = 0
  if (groups.length === 0) {
    return { pct: 0, completeCount: 0, totalCount: 0 }
  }
  let groupPctSum = 0
  for (const group of groups) {
    totalCount += group.rows.length
    if (group.rows.length === 0) continue
    let rowPctSum = 0
    for (const row of group.rows) {
      rowPctSum += row.pct
      if (row.checked || row.owned >= row.needed) completeCount += 1
    }
    groupPctSum += rowPctSum / group.rows.length
  }
  return {
    pct: groupPctSum / groups.length,
    completeCount,
    totalCount,
  }
}

const DAY_SHORT: Record<string, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
}

/** Incomplete talent mats that drop in domains today. */
export function farmableTalentToday(
  groups: ResourceGroup[],
  today: string = WEEKDAYS[new Date().getDay()],
): {
  rows: ResourceProgress[]
  domain: string | null
  names: string[]
} | null {
  const talentGroup = groups.find((g) => g.id === 'talent')
  if (!talentGroup) return null
  const rows = talentGroup.rows.filter((row) => {
    if (row.owned >= row.needed || row.checked) return false
    const days = row.info?.daysOfWeek
    if (!days?.length || !days.includes(today)) return false
    const type = row.info?.typeText?.toLowerCase() ?? ''
    return type.includes('talent')
  })
  if (rows.length === 0) return null
  const domain =
    rows.find((r) => r.info?.domain)?.info?.domain ?? null
  return {
    rows,
    domain,
    names: rows.map((r) => r.name),
  }
}

/** Compact schedule label for checklist rows (e.g. "Can farm today", "Mon · Thu"). */
export function farmScheduleLabel(
  info: MaterialInfo | undefined,
  today: string = WEEKDAYS[new Date().getDay()],
): string | null {
  const days = info?.daysOfWeek
  if (!days?.length) return null
  if (days.includes(today)) {
    const kind = info?.typeText?.toLowerCase().includes('talent')
      ? 'talent'
      : info?.typeText?.toLowerCase().includes('weapon')
        ? 'weapon'
        : null
    return kind ? `Can farm ${kind}` : 'Can farm today'
  }
  return `Farmed ${days.map((d) => DAY_SHORT[d] ?? d.slice(0, 3)).join(' · ')}`
}
