import type { TalentTargets } from './types'
import { DEFAULT_TALENTS, DEFAULT_WEAPON } from './types'

export type RecommendedGoal = {
  characterId: string
  tag: string
  blurb: string
  /** Starting progress snapshot for a typical mid-build account. */
  seed?: {
    currentLevel?: number
    targetLevel?: number
    weaponLevel?: number
    talents?: Partial<{
      normal: Partial<TalentTargets['normal']>
      skill: Partial<TalentTargets['skill']>
      burst: Partial<TalentTargets['burst']>
    }>
  }
}

/**
 * Curated starter goals for the farming dashboard.
 * IDs must match characterMaterials / kit slug ids.
 */
export const RECOMMENDED_GOALS: RecommendedGoal[] = [
  {
    characterId: 'columbina',
    tag: 'DPS crown',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
    seed: {
      currentLevel: 70,
      targetLevel: 90,
      weaponLevel: 90,
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 6, target: 10 },
        burst: { current: 6, target: 10 },
      },
    },
  },
  {
    characterId: 'nefer',
    tag: 'New DPS',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
    seed: {
      currentLevel: 1,
      targetLevel: 90,
      weaponLevel: 90,
    },
  },
  {
    characterId: 'furina',
    tag: 'Support',
    blurb: 'Lv 90 · talents 1 / 8 / 8',
    seed: {
      currentLevel: 80,
      targetLevel: 90,
      weaponLevel: 90,
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 8, target: 8 },
        burst: { current: 8, target: 8 },
      },
    },
  },
  {
    characterId: 'mavuika',
    tag: 'DPS crown',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
    seed: {
      currentLevel: 70,
      targetLevel: 90,
      weaponLevel: 90,
    },
  },
  {
    characterId: 'skirk',
    tag: 'DPS',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
  },
  {
    characterId: 'ineffa',
    tag: 'Support',
    blurb: 'Lv 90 · talents 1 / 8 / 8',
    seed: {
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 1, target: 8 },
        burst: { current: 1, target: 8 },
      },
    },
  },
  {
    characterId: 'lauma',
    tag: 'Support',
    blurb: 'Lv 90 · talents 1 / 8 / 8',
    seed: {
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 1, target: 8 },
        burst: { current: 1, target: 8 },
      },
    },
  },
  {
    characterId: 'escoffier',
    tag: 'Support',
    blurb: 'Lv 90 · talents 1 / 8 / 8',
    seed: {
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 1, target: 8 },
        burst: { current: 1, target: 8 },
      },
    },
  },
  {
    characterId: 'citlali',
    tag: 'Support',
    blurb: 'Lv 90 · talents 1 / 8 / 8',
    seed: {
      talents: {
        normal: { current: 1, target: 1 },
        skill: { current: 1, target: 8 },
        burst: { current: 1, target: 8 },
      },
    },
  },
  {
    characterId: 'arlecchino',
    tag: 'Classic DPS',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
  },
  {
    characterId: 'mualani',
    tag: 'DPS',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
  },
  {
    characterId: 'varesa',
    tag: 'DPS',
    blurb: 'Lv 90 · talents 1 / 10 / 10',
  },
]

export function recommendedPlanSeed(rec: RecommendedGoal) {
  const talents = structuredClone(DEFAULT_TALENTS)
  const seedTalents = rec.seed?.talents
  if (seedTalents) {
    for (const key of ['normal', 'skill', 'burst'] as const) {
      const lane = seedTalents[key]
      if (!lane) continue
      if (lane.current != null) talents[key].current = lane.current
      if (lane.target != null) talents[key].target = lane.target
    }
  }
  const currentLevel = rec.seed?.currentLevel ?? 1
  const targetLevel = rec.seed?.targetLevel ?? 90
  const weaponLevel = rec.seed?.weaponLevel ?? 90
  return {
    characterId: rec.characterId,
    currentLevel,
    targetLevel: Math.max(currentLevel, targetLevel),
    weapon: {
      ...structuredClone(DEFAULT_WEAPON),
      currentLevel: Math.min(weaponLevel, targetLevel),
      targetLevel: weaponLevel,
    },
    talents,
    checked: false,
  }
}
