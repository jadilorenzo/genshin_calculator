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

export type WeaponRarity = 4 | 5

export type WeaponGoal = {
  /** 4★ or 5★ — drives ore + mora costs (domain mats need a specific weapon). */
  rarity: WeaponRarity
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
  /** True when you don’t own the character yet — progress stays at baseline. */
  notObtained: boolean
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
  rarity: 5,
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
      ? ` · ${plan.weapon.rarity}★ Weapon ${plan.weapon.targetLevel}`
      : ''
  return `Lv ${plan.targetLevel}${weaponBit} · ${formatTalentGoal(plan.talents)}`
}

export function formatProgressSummary(plan: FarmingPlanEntry): string {
  if (plan.notObtained) {
    const weaponBit =
      plan.weapon.targetLevel > 1 || plan.weapon.currentLevel > 1
        ? ` · ${plan.weapon.rarity}★ Weapon ${plan.weapon.currentLevel}`
        : ''
    return `Not obtained${weaponBit}`
  }
  const weaponBit =
    plan.weapon.targetLevel > 1 || plan.weapon.currentLevel > 1
      ? ` · ${plan.weapon.rarity}★ Weapon ${plan.weapon.currentLevel}`
      : ''
  return `Lv ${plan.currentLevel}${weaponBit} · ${formatTalentProgress(plan.talents)}`
}

/** How far the current build is toward the goal (levels + talents), not materials. */
export function buildProgress(plan: FarmingPlanEntry): {
  pct: number
  parts: Array<{
    id: string
    label: string
    done: boolean
    pct: number
    /** False when target is already 1 — not part of overall built %. */
    countsTowardBuilt: boolean
  }>
} {
  const parts = [
    {
      id: 'character',
      label: 'Lv',
      pct: levelLane(plan.currentLevel, plan.targetLevel),
      done: plan.currentLevel >= plan.targetLevel,
      countsTowardBuilt: plan.targetLevel > 1,
    },
    {
      id: 'weapon',
      label: 'Wpn',
      pct: levelLane(plan.weapon.currentLevel, plan.weapon.targetLevel),
      done: plan.weapon.currentLevel >= plan.weapon.targetLevel,
      countsTowardBuilt: plan.weapon.targetLevel > 1,
    },
    {
      id: 'normal',
      label: 'NA',
      pct: levelLane(plan.talents.normal.current, plan.talents.normal.target),
      done: plan.talents.normal.current >= plan.talents.normal.target,
      countsTowardBuilt: plan.talents.normal.target > 1,
    },
    {
      id: 'skill',
      label: 'Skill',
      pct: levelLane(plan.talents.skill.current, plan.talents.skill.target),
      done: plan.talents.skill.current >= plan.talents.skill.target,
      countsTowardBuilt: plan.talents.skill.target > 1,
    },
    {
      id: 'burst',
      label: 'Burst',
      pct: levelLane(plan.talents.burst.current, plan.talents.burst.target),
      done: plan.talents.burst.current >= plan.talents.burst.target,
      countsTowardBuilt: plan.talents.burst.target > 1,
    },
  ]
  const scored = parts.filter((part) => part.countsTowardBuilt)
  const pct =
    scored.length === 0
      ? parts.every((part) => part.done)
        ? 100
        : 0
      : scored.reduce((sum, part) => sum + part.pct, 0) / scored.length
  return { pct, parts }
}

/** Progress from level 1 toward target — starting at 1 is 0%, not 1/target. */
function levelLane(current: number, target: number): number {
  if (target <= 1) return current >= target ? 100 : 0
  const capped = Math.min(Math.max(current, 1), target)
  return Math.min(100, Math.max(0, ((capped - 1) / (target - 1)) * 100))
}

export function defaultPlan(characterId: string): FarmingPlanEntry {
  return {
    characterId,
    currentLevel: 1,
    targetLevel: 90,
    weapon: structuredClone(DEFAULT_WEAPON),
    talents: structuredClone(DEFAULT_TALENTS),
    notObtained: false,
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
    rarity: raw.weapon?.rarity === 4 ? 4 : 5,
    currentLevel: clampCharLevel(raw.weapon?.currentLevel ?? 1),
    targetLevel: clampCharLevel(raw.weapon?.targetLevel ?? 90),
  }
  if (weapon.currentLevel > weapon.targetLevel) {
    weapon.targetLevel = weapon.currentLevel
  }
  const talents = raw.talents ?? structuredClone(DEFAULT_TALENTS)
  const notObtained = Boolean(raw.notObtained)
  return {
    characterId: raw.characterId,
    currentLevel: notObtained ? 1 : currentLevel,
    targetLevel: Math.max(notObtained ? 1 : currentLevel, targetLevel),
    weapon,
    talents: {
      normal: {
        current: notObtained
          ? 1
          : clampTalentLevel(talents.normal?.current ?? 1),
        target: clampTalentLevel(talents.normal?.target ?? 1),
      },
      skill: {
        current: notObtained
          ? 1
          : clampTalentLevel(talents.skill?.current ?? 1),
        target: clampTalentLevel(talents.skill?.target ?? 10),
      },
      burst: {
        current: notObtained
          ? 1
          : clampTalentLevel(talents.burst?.current ?? 1),
        target: clampTalentLevel(talents.burst?.target ?? 10),
      },
    },
    notObtained,
    checked: Boolean(raw.checked),
  }
}
