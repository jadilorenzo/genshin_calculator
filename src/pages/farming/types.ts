export type MaterialCost = {
  id: number | null
  name: string
  count: number
}

export type MaterialInfo = {
  name: string
  rarity: number | null
  typeText: string | null
  daysOfWeek: string[]
  domain: string | null
  icon: string | null
}

export type CharacterMaterials = {
  id: string
  name: string
  element: string
  rarity: number | null
  ascension: Record<string, MaterialCost[]>
  talent: Record<string, MaterialCost[]>
}

export type TalentLane = {
  current: number
  target: number
}

export type TalentTargets = {
  normal: TalentLane
  skill: TalentLane
  burst: TalentLane
}

export type WeaponGoal = {
  /** Optional weapon name for your notes. */
  name: string
  currentLevel: number
  targetLevel: number
}

/** One character goal: where you are now vs what you’re building toward. */
export type FarmingPlanEntry = {
  characterId: string
  /** Current character level (1–90). */
  currentLevel: number
  /** Goal character level (1–90). */
  targetLevel: number
  weapon: WeaponGoal
  talents: TalentTargets
  /** Manual “goal complete” check. */
  checked: boolean
}

export type FarmingState = {
  plans: FarmingPlanEntry[]
  /** Owned counts keyed by material name. */
  inventory: Record<string, number>
  /** Materials marked complete in the checklist. */
  checkedMaterials: Record<string, boolean>
}

export const ASCEND_KEYS = [
  'ascend1',
  'ascend2',
  'ascend3',
  'ascend4',
  'ascend5',
  'ascend6',
] as const

export const TALENT_KEYS = [
  'lvl2',
  'lvl3',
  'lvl4',
  'lvl5',
  'lvl6',
  'lvl7',
  'lvl8',
  'lvl9',
  'lvl10',
] as const

/** Common level chips for quick picking (any 1–90 still allowed). */
export const LEVEL_CHIPS = [1, 20, 40, 50, 60, 70, 80, 90] as const

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DEFAULT_WEAPON: WeaponGoal = {
  name: '',
  currentLevel: 1,
  targetLevel: 90,
}

/** Starting blank-ish progress; goal leans DPS crowns. */
export const DEFAULT_TALENTS: TalentTargets = {
  normal: { current: 1, target: 1 },
  skill: { current: 1, target: 10 },
  burst: { current: 1, target: 10 },
}

export const TALENT_PRESETS: Array<{
  id: string
  label: string
  targets: { normal: number; skill: number; burst: number }
}> = [
  { id: 'dps', label: '1 / 10 / 10', targets: { normal: 1, skill: 10, burst: 10 } },
  { id: 'support', label: '1 / 8 / 8', targets: { normal: 1, skill: 8, burst: 8 } },
  { id: 'triple', label: '10 / 10 / 10', targets: { normal: 10, skill: 10, burst: 10 } },
]

export const EMPTY_FARMING_STATE: FarmingState = {
  plans: [],
  inventory: {},
  checkedMaterials: {},
}

/** How many ascension phases are already done at this level. */
export function levelToAscension(level: number): number {
  if (level >= 81) return 6
  if (level >= 71) return 5
  if (level >= 61) return 4
  if (level >= 51) return 3
  if (level >= 41) return 2
  if (level >= 21) return 1
  return 0
}

export function clampCharLevel(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(90, Math.round(value)))
}

export function clampTalentLevel(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(10, Math.round(value)))
}

export function formatTalentGoal(talents: TalentTargets): string {
  return `${talents.normal.target} / ${talents.skill.target} / ${talents.burst.target}`
}

export function formatTalentProgress(talents: TalentTargets): string {
  return `${talents.normal.current} / ${talents.skill.current} / ${talents.burst.current}`
}

export function formatGoalSummary(plan: FarmingPlanEntry): string {
  const weaponBit =
    plan.weapon.targetLevel > 1 || plan.weapon.currentLevel > 1
      ? ` · Weapon ${plan.weapon.targetLevel}`
      : ''
  return `Lv ${plan.targetLevel}${weaponBit} · ${formatTalentGoal(plan.talents)}`
}

export function formatProgressSummary(plan: FarmingPlanEntry): string {
  const weaponBit =
    plan.weapon.targetLevel > 1 || plan.weapon.currentLevel > 1
      ? ` · Weapon ${plan.weapon.currentLevel}`
      : ''
  return `Lv ${plan.currentLevel}${weaponBit} · ${formatTalentProgress(plan.talents)}`
}

export function defaultPlan(characterId: string): FarmingPlanEntry {
  return {
    characterId,
    currentLevel: 1,
    targetLevel: 90,
    weapon: structuredClone(DEFAULT_WEAPON),
    talents: structuredClone(DEFAULT_TALENTS),
    checked: false,
  }
}

/** Migrate older saved shapes into the progress/goal model. */
export function normalizePlan(
  raw: FarmingPlanEntry & {
    currentAscension?: number
    targetAscension?: number
  },
): FarmingPlanEntry {
  const currentLevel = clampCharLevel(
    raw.currentLevel ??
      ([1, 20, 40, 50, 60, 70, 80, 90][raw.currentAscension ?? 0] ?? 1),
  )
  const targetLevel = clampCharLevel(
    raw.targetLevel ??
      ([1, 20, 40, 50, 60, 70, 80, 90][raw.targetAscension ?? 6] ?? 90),
  )
  const weapon: WeaponGoal = {
    name: raw.weapon?.name ?? '',
    currentLevel: clampCharLevel(raw.weapon?.currentLevel ?? 1),
    targetLevel: clampCharLevel(raw.weapon?.targetLevel ?? 90),
  }
  if (weapon.currentLevel > weapon.targetLevel) {
    weapon.targetLevel = weapon.currentLevel
  }
  const talents = raw.talents ?? structuredClone(DEFAULT_TALENTS)
  return {
    characterId: raw.characterId,
    currentLevel,
    targetLevel: Math.max(currentLevel, targetLevel),
    weapon,
    talents: {
      normal: {
        current: clampTalentLevel(talents.normal?.current ?? 1),
        target: clampTalentLevel(talents.normal?.target ?? 1),
      },
      skill: {
        current: clampTalentLevel(talents.skill?.current ?? 1),
        target: clampTalentLevel(talents.skill?.target ?? 10),
      },
      burst: {
        current: clampTalentLevel(talents.burst?.current ?? 1),
        target: clampTalentLevel(talents.burst?.target ?? 10),
      },
    },
    checked: Boolean(raw.checked),
  }
}
