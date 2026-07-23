export type Element =
  | 'Anemo'
  | 'Cryo'
  | 'Dendro'
  | 'Electro'
  | 'Geo'
  | 'Hydro'
  | 'Pyro'
  | string

export type WeaponType =
  | 'Sword'
  | 'Claymore'
  | 'Polearm'
  | 'Bow'
  | 'Catalyst'
  | string

export interface KitAttribute {
  name: string
  paramKey?: string
  format?: string
  raw: number | string | null
  unit: 's' | 'energy' | null
}

export interface KitSkill {
  name: string
  description: string
  cooldown: number | null
  energyCost: number | null
  duration: number | null
  attributes: KitAttribute[]
  labels: string[]
  parameters: Record<string, number[]>
}

export interface KitPassive {
  name: string
  description: string
}

export interface KitConstellation {
  level: number
  name: string
  description: string
}

export interface CharacterKit {
  normalAttack: KitSkill | null
  elementalSkill: KitSkill | null
  elementalBurst: KitSkill | null
  passives: KitPassive[]
  constellations: KitConstellation[]
}

export interface CharacterData {
  id: string
  name: string
  element: Element
  weapon: WeaponType
  rarity: number
  constellationName: string
  version: string | null
  iconFile?: string | null
  icon: string | null
  sideIcon: string | null
  kit: CharacterKit
}

export interface CharacterKitsFile {
  source: string
  extractedAt: string
  talentLevelForScalars: number
  count: number
  characters: CharacterData[]
}

/** Order of skill vs burst casts within an on-field window. */
export type CastOrder = 'skill-first' | 'burst-first'

/** One step in a fine-grained inspect combo sequence. */
export type ComboStep = {
  /** Instance id for drag/drop keys */
  id: string
  /** Animation timing action id (e.g. na1, skill, burst) */
  actionId: string
  /** Animation state id; defaults to "default" */
  stateId?: string
  /** Idle seconds after this step (spacing) */
  gapAfter?: number
  /**
   * Optional override for this step's animation lock (seconds).
   * When set, replaces the timing from characterAnimationTimings.
   */
  durationSeconds?: number
}

/** A character placement on the rotation timeline. */
export interface TimelinePlacement {
  id: string
  characterId: string
  /** Start time in seconds */
  start: number
  /** On-field / block duration in seconds */
  duration: number
  /** Include skill cast time in default on-field */
  castSkill: boolean
  /** Include burst cast time in default on-field */
  castBurst: boolean
  /** Skill then burst (default) or burst then skill */
  castOrder: CastOrder
  /** Press vs hold skill when the kit supports both (defaults to hold) */
  skillVariant: 'press' | 'hold'
  /**
   * How many Elemental Skill charges to use this field window
   * (Sucrose EE = 2). Clamped to the character's skillCharges.
   */
  skillCasts: number
  /**
   * Fine combo sequence for inspect timeline. When non-empty, drives the
   * under-block action strip instead of coarse Skill/Burst presets.
   */
  comboSteps: ComboStep[]
  /** Selected kit duration overlays (e.g. "skill:Shield Duration") */
  activeDurations: string[]
  /**
   * Per-overlay duration overrides (seconds), e.g. holding Mona’s bubble
   * longer before a normal attack pops it.
   */
  durationOverrides: Record<string, number>
  /**
   * Show this character's off-field elemental application ticks on the
   * timeline (Ripple, Oz, Guoba, …). Default off when unset.
   */
  showOffFieldApplications?: boolean
}

