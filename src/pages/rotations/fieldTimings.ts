/**
 * On-field cast / animation lock times (seconds).
 * Prefer gcsim AnimationLength / 60 when available.
 *
 * When a longer skill option exists (hold / charge / skill-state), defaults prefer
 * that longer option; UI can switch to the short cancel/press.
 * Main DPS (`skillPairStyle: 'combo'`) use a single expected on-field duration
 * (not Short/Full). Human mode pads each enabled cast with humanLag
 * (unless a human override exists).
 */
import type { CastOrder } from './types'

export type TimingMode = 'frame' | 'human'
export type SkillCastVariant = 'press' | 'hold'
/** How to label the short vs long skill option in the UI. */
export type SkillPairStyle = 'hold' | 'charge' | 'state' | 'combo' | 'skill-full'
export type { CastOrder }

export const DEFAULT_TIMING_MODE: TimingMode = 'human'
export const DEFAULT_HUMAN_LAG = 0.15
export const MIN_HUMAN_LAG = 0
export const MAX_HUMAN_LAG = 0.75

export interface FieldCastTimings {
  /**
   * Primary skill / field duration.
   * For supports: press/cancel cast. For main DPS (`combo`): expected on-field time.
   */
  skillCast: number
  /** Longer skill option (hold / full charge / full skill-state). Unused for combo. */
  skillHoldCast?: number
  /** Elemental Burst animation lock (standalone; skipped when comboIncludesBurst) */
  burstCast: number
  humanSkillCast?: number
  humanSkillHoldCast?: number
  humanBurstCast?: number
  /** UI labels for short/long skill (default hold → Press/Hold) */
  skillPairStyle?: SkillPairStyle
  /**
   * Expected on-field time (or Full for skill-full dual-role) already weaves burst(s).
   * When true, burstCast is not added while Skill is enabled — for dual-option kits
   * only on the long option, so short support casts still pair with standalone Burst.
   */
  comboIncludesBurst?: boolean
  /**
   * Max Elemental Skill charges (e.g. Sucrose 2). Discrete multi-cast only —
   * ignored for combo-style expected on-field windows.
   */
  skillCharges?: number
  /** Prefer Short/Press when a long option exists (support-primary dual-role). */
  preferPressDefault?: boolean
  note?: string
}

const DEFAULT_TIMINGS: FieldCastTimings = {
  skillCast: 0.6,
  burstCast: 1.5,
}

/** Character-specific cast locks keyed by character kit id (slug). */
const TIMINGS_BY_ID: Record<string, FieldCastTimings> = {
  ineffa: {
    skillCast: round(32 / 60),
    burstCast: round(127 / 60),
    humanSkillCast: 0.7,
    humanBurstCast: 2.3,
  },
  // Charge / absorb on-field (not a simple press cast)
  jahoda: {
    // Cancel E early (EE / NA cancel) vs full flask absorb — KQM “few seconds”;
    // community ~2.5–5s depending on aura. Default to full charge.
    skillCast: 1.0,
    skillHoldCast: 3.0,
    burstCast: 1.2,
    humanSkillCast: 1.15,
    humanSkillHoldCast: 3.5,
    skillPairStyle: 'charge',
    note: 'Flask absorb needs field time · Cancel skips the charge',
  },
  'traveler-anemo': {
    skillCast: 1.0,
    skillHoldCast: 3.5,
    burstCast: 1.5,
    skillPairStyle: 'charge',
  },
  faruzan: {
    skillCast: 0.7,
    skillHoldCast: 2.0, // E + charged Hurricane Arrow
    burstCast: 1.5,
    skillPairStyle: 'charge',
    note: 'Charge ≈ E then aimed Hurricane Arrow',
  },
  charlotte: {
    skillCast: round(30 / 60),
    skillHoldCast: 2.2,
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  // Skill-state / channel field time (supports)
  sayu: {
    skillCast: 0.8,
    skillHoldCast: 3.0, // typical short hold (max 10)
    burstCast: 1.5,
    skillPairStyle: 'hold',
    note: 'Hold max is 10s · default uses a short roll',
  },
  kirara: {
    skillCast: 0.8,
    skillHoldCast: 2.5,
    burstCast: 1.4,
    skillPairStyle: 'hold',
  },
  lynette: {
    skillCast: 0.7,
    skillHoldCast: 2.5,
    burstCast: 1.4,
    skillPairStyle: 'hold',
  },
  jean: {
    skillCast: round(46 / 60),
    skillHoldCast: 5,
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  yelan: {
    skillCast: round(42 / 60),
    skillHoldCast: 3,
    burstCast: round(90 / 60),
    skillPairStyle: 'hold',
  },
  bennett: {
    skillCast: round(42 / 60),
    skillHoldCast: round(98 / 60),
    burstCast: round(53 / 60),
    skillPairStyle: 'hold',
  },
  zhongli: {
    skillCast: round(38 / 60),
    skillHoldCast: round(96 / 60),
    burstCast: round(101 / 60),
    skillPairStyle: 'hold',
  },
  'kaedehara-kazuha': {
    skillCast: round(69 / 60),
    skillHoldCast: round(175 / 60),
    burstCast: round(95 / 60),
    skillPairStyle: 'hold',
  },
  venti: {
    skillCast: round(98 / 60),
    skillHoldCast: round(289 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  candace: {
    skillCast: round(26 / 60),
    skillHoldCast: round(113 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  diona: {
    skillCast: round(34 / 60),
    skillHoldCast: round(49 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  nahida: {
    skillCast: round(32 / 60),
    skillHoldCast: round(63 / 60),
    burstCast: round(80 / 60),
    skillPairStyle: 'hold',
  },
  xingqiu: {
    skillCast: round(67 / 60),
    burstCast: round(40 / 60),
  },
  // Two-charge support E — default uses both (EE)
  sucrose: {
    skillCast: round(68 / 60),
    burstCast: round(65 / 60),
    humanSkillCast: 1.3,
    humanBurstCast: 1.25,
    skillCharges: 2,
    note: '2 skill charges · default EE then Q',
  },
  furina: {
    skillCast: round(54 / 60),
    burstCast: round(121 / 60),
  },
  fischl: {
    skillCast: round(30 / 60),
    burstCast: round(50 / 60),
  },
  raiden: {
    skillCast: round(35 / 60),
    burstCast: round(110 / 60),
  },
  shenhe: {
    skillCast: 0.7,
    skillHoldCast: round(100 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  lisa: {
    skillCast: 0.5,
    skillHoldCast: round(120 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  beidou: {
    skillCast: 0.5,
    skillHoldCast: round(150 / 60),
    burstCast: 1.5,
    skillPairStyle: 'hold',
  },
  xilonen: {
    skillCast: 1.2,
    skillHoldCast: 3.0,
    burstCast: 1.5,
    skillPairStyle: 'state',
  },

  // —— Main DPS expected on-field windows ——
  // Durations are typical C0 expected field time (woven burst included when flagged).
  flins: {
    // KQM: special E + sQ twice in Manifest Flame (~10–11s), NAs fill the 6s Spearstorm CD.
    skillCast: 10.5,
    burstCast: 2.0, // full 80-cost burst if used instead
    humanSkillCast: 11,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Expected ≈ E → E sQ → NAs → E sQ inside Manifest Flame',
  },
  neuvillette: {
    // User/KQM-style stretch: E → CA → Q → 2CA (CA ≈ 3.2s each).
    skillCast: 12.5, // E CA Q 2CA
    burstCast: 1.6,
    humanSkillCast: 13,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Expected ≈ E → Charged Attack → Q → 2 Charged Attacks',
  },
  'hu-tao': {
    skillCast: 9.0, // Paramita Papilio duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Expected ≈ skill-state NAs / CAs for Paramita duration',
  },
  arlecchino: {
    skillCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  clorinde: {
    skillCast: 7.5, // Night Vigil
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'raiden-shogun': {
    skillCast: 8.0, // Musou Isshin window + resolve
    burstCast: round(110 / 60),
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  xiao: {
    skillCast: 12.0, // plunge spam of burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    skillCharges: 2,
  },
  wanderer: {
    skillCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  mualani: {
    skillCast: 10.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  mavuika: {
    skillCast: 8.0, // Crucible ~7s + setup
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  alhaitham: {
    skillCast: 11.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'kamisato-ayaka': {
    skillCast: 9.0,
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  skirk: {
    skillCast: 12.5, // Seven-Phase Flash Mode
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  varesa: {
    skillCast: 10.0, // similar mini-burst cycles
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    skillCharges: 2,
  },
  chasca: {
    skillCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kinich: {
    skillCast: 11.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  gaming: {
    skillCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  wriothesley: {
    skillCast: 10.0, // skill-state duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  navia: {
    skillCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Classic / legacy on-field DPS
  diluc: {
    skillCast: 10.0, // Q infusion window ~8s + NAs
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  keqing: {
    skillCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  klee: {
    skillCast: 12.0, // Q duration 10s field
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    skillCharges: 2,
  },
  ganyu: {
    skillCast: 12.0, // frostflake CA spam stretch
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  yoimiya: {
    skillCast: 10.0, // skill duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  eula: {
    skillCast: 10.0, // hold E stacks + Q + NAs
    burstCast: 2.2,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'arataki-itto': {
    skillCast: 12.0, // Ushi + burst CA window ~11s
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'kamisato-ayato': {
    skillCast: 6.5, // Takimeguri Kanka 6s + swap buffer
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  tartaglia: {
    skillCast: 10.0, // typical melee stance field
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Expected ≈ melee stance combo (stance max 30s)',
  },
  cyno: {
    skillCast: 10.5, // Pactsworn / burst duration ~10s
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  tighnari: {
    skillCast: 7.5, // E field + 3 CAs
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  lyney: {
    skillCast: 10.0, // charged shot stacks + Q
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  dehya: {
    skillCast: 9.0, // on-field punch / Q window
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  noelle: {
    skillCast: 12.0, // burst geo infusion ~15s, typical ~12
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  ningguang: {
    skillCast: 9.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  yanfei: {
    skillCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  razor: {
    skillCast: 12.0, // burst duration 15s, typical field
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'shikanoin-heizou': {
    skillCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  freminet: {
    skillCast: 10.0, // Pers Timer / burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kaveh: {
    skillCast: 10.0, // bloom driver burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  sethos: {
    skillCast: 8.5, // Twilight Meditation 8s
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  aloy: {
    skillCast: 9.0, // Rushing Ice ~10s
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  amber: {
    skillCast: 7.0,
    burstCast: 1.3,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kaeya: {
    skillCast: 7.0, // burst duration 8s
    burstCast: 1.3,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  chongyun: {
    skillCast: 9.0, // field duration 10s driver
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  xinyan: {
    skillCast: 8.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Newer / Nod-Krai & regional on-field DPS
  sandrone: {
    skillCast: 11.0,
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  zibai: {
    skillCast: 12.0, // Lunar Phase Shift 15s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  nefer: {
    skillCast: 9.5, // Shadow Dance 9s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  varka: {
    skillCast: 12.0, // Sturm und Drang 12s
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  durin: {
    skillCast: 11.0,
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  columbina: {
    // Support-primary (E/Q then swap) with optional on-field Lunar-Bloom DPS stretch.
    skillCast: round(41 / 60),
    skillHoldCast: 11.0,
    burstCast: round(131 / 60),
    humanSkillCast: 0.85,
    humanSkillHoldCast: 11.3,
    humanBurstCast: 2.4,
    skillPairStyle: 'skill-full',
    comboIncludesBurst: true,
    preferPressDefault: true,
    note: 'Skill ≈ Eternal Tides cast · Full ≈ on-field DPS window',
  },
  lohen: {
    skillCast: 12.0, // Masterstroke 13s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  linnea: {
    skillCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Flex on-field drivers / situational main DPS
  'yumemizuki-mizuki': {
    skillCast: 8.0, // Dreamdrifter + burst weave
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  ifa: {
    skillCast: 9.0, // on-field hover DPS stretch
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  nilou: {
    // Rarely hypercarry; short dance field when on-field
    skillCast: 7.0, // Pirouette / Lunar Prayer
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  emilie: {
    // Usually off-field; on-field poke window
    skillCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'yae-miko': {
    // Usually off-field; on-field turret setup
    skillCast: 6.5, // 3E setup
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-pyro': {
    skillCast: 9.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-electro': {
    skillCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-geo': {
    skillCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-dendro': {
    skillCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-cryo': {
    skillCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-hydro': {
    skillCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
}


export function skillVariantLabels(style: SkillPairStyle = 'hold'): {
  press: string
  hold: string
} {
  if (style === 'charge') return { press: 'Cancel', hold: 'Charge' }
  if (style === 'state') return { press: 'Short', hold: 'Full' }
  // Combo kits no longer expose a pair — label kept for strip fallbacks only.
  if (style === 'combo') {
    return { press: 'Expected on-field', hold: 'Expected on-field' }
  }
  // Support cast vs on-field DPS window (e.g. Columbina)
  if (style === 'skill-full') return { press: 'Skill', hold: 'Full' }
  return { press: 'Press', hold: 'Hold' }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function clampHumanLag(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_HUMAN_LAG
  return round(Math.min(MAX_HUMAN_LAG, Math.max(MIN_HUMAN_LAG, raw)))
}

export function parseTimingMode(raw: unknown): TimingMode {
  return raw === 'frame' ? 'frame' : 'human'
}

/** Pull hold-channel seconds from kit attribute names when present. */
export function kitHoldChannelSeconds(skill: {
  attributes: { name: string; unit: string | null; raw: number | string | null }[]
  duration: number | null
} | null): number | null {
  if (!skill) return null
  for (const attr of skill.attributes) {
    if (attr.unit !== 's') continue
    if (typeof attr.raw !== 'number' || !(attr.raw > 0)) continue
    if (
      /max duration.*hold|hold.*max duration|hold max duration|hold duration|max duration \(hold\)/i.test(
        attr.name,
      )
    ) {
      return round(attr.raw)
    }
  }
  for (const attr of skill.attributes) {
    if (attr.unit !== 's') continue
    if (typeof attr.raw !== 'number' || !(attr.raw > 0) || attr.raw > 8) continue
    if (/dreamdrifter|windwheel|nightsoul point time/i.test(attr.name)) {
      return round(attr.raw)
    }
  }
  return null
}

export function getFieldCastTimings(
  characterId: string,
  kitHoldSeconds: number | null = null,
): FieldCastTimings {
  const base = TIMINGS_BY_ID[characterId] ?? DEFAULT_TIMINGS
  if (base.skillHoldCast != null) return base
  // Main DPS expected windows are a single duration — don't invent Press/Hold from kit.
  if (base.skillPairStyle === 'combo') return base
  if (kitHoldSeconds != null && kitHoldSeconds > 0) {
    return {
      ...base,
      skillHoldCast: kitHoldSeconds,
      skillPairStyle: base.skillPairStyle ?? 'hold',
    }
  }
  return base
}

/** Main DPS expected-on-field style (long skillCast window). */
export function isComboFieldStyle(
  characterId: string,
  kitHoldSeconds: number | null = null,
): boolean {
  return getFieldCastTimings(characterId, kitHoldSeconds).skillPairStyle === 'combo'
}

/**
 * Supports / dual-role kits get cast-sequence prefills (e.g. Sucrose EE + Q).
 * Combo DPS do not — build actions, then Fit to actions.
 */
export function prefersSupportCastPrefill(
  characterId: string,
  kitHoldSeconds: number | null = null,
): boolean {
  return !isComboFieldStyle(characterId, kitHoldSeconds)
}

export function hasSkillHold(
  characterId: string,
  kitHoldSeconds: number | null = null,
): boolean {
  return getFieldCastTimings(characterId, kitHoldSeconds).skillHoldCast != null
}

/** Max Elemental Skill charges (1 when unspecified). */
export function getSkillCharges(
  characterId: string,
  kitHoldSeconds: number | null = null,
): number {
  const n = getFieldCastTimings(characterId, kitHoldSeconds).skillCharges ?? 1
  if (!Number.isFinite(n)) return 1
  return Math.min(4, Math.max(1, Math.round(n)))
}

/**
 * Whether multi-charge casting multiplies on-field time.
 * Expected on-field windows already include charge usage — don't double them.
 */
export function usesDiscreteSkillCharges(
  characterId: string,
  kitHoldSeconds: number | null = null,
  _skillVariant?: SkillCastVariant,
): boolean {
  if (getSkillCharges(characterId, kitHoldSeconds) <= 1) return false
  const t = getFieldCastTimings(characterId, kitHoldSeconds)
  if (t.skillPairStyle === 'combo') return false
  return true
}

export function defaultSkillCasts(
  characterId: string,
  kitHoldSeconds: number | null = null,
): number {
  if (!usesDiscreteSkillCharges(characterId, kitHoldSeconds)) return 1
  return getSkillCharges(characterId, kitHoldSeconds)
}

export function clampSkillCasts(
  raw: unknown,
  characterId: string,
  kitHoldSeconds: number | null = null,
): number {
  const max = getSkillCharges(characterId, kitHoldSeconds)
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.round(raw)
      : defaultSkillCasts(characterId, kitHoldSeconds)
  return Math.min(max, Math.max(1, n))
}

/**
 * How many discrete skill animations to pack for this placement.
 * Returns 1 when skill is off or charges aren't discrete.
 */
export function resolveSkillCasts(
  characterId: string,
  opts: {
    skill: boolean
    skillCasts?: number
    skillVariant?: SkillCastVariant
    kitHoldSeconds?: number | null
  },
): number {
  if (!opts.skill) return 0
  const kitHold = opts.kitHoldSeconds ?? null
  if (!usesDiscreteSkillCharges(characterId, kitHold, opts.skillVariant)) {
    return 1
  }
  return clampSkillCasts(opts.skillCasts, characterId, kitHold)
}

export function defaultSkillVariant(
  characterId: string,
  kitHoldSeconds: number | null = null,
): SkillCastVariant {
  const t = getFieldCastTimings(characterId, kitHoldSeconds)
  if (!hasSkillHold(characterId, kitHoldSeconds)) return 'press'
  // Support-primary dual-role chars default to the short skill cast.
  if (t.preferPressDefault) return 'press'
  // Prefer Charge / Hold / Full whenever a long option exists
  return 'hold'
}

/** New placements include Burst; woven on-field windows still don’t double-count it. */
export function defaultCastBurst(
  _characterId?: string,
  _kitHoldSeconds?: number | null,
): boolean {
  return true
}

export function skillToggleLabel(
  characterId: string,
  kitHoldSeconds: number | null = null,
): string {
  const t = getFieldCastTimings(characterId, kitHoldSeconds)
  return t.skillPairStyle === 'combo' ? 'Expected on-field' : 'Skill'
}

export function parseSkillVariant(
  raw: unknown,
  characterId: string,
  kitHoldSeconds: number | null = null,
): SkillCastVariant {
  if (raw === 'press' || raw === 'hold') {
    if (raw === 'hold' && !hasSkillHold(characterId, kitHoldSeconds)) return 'press'
    return raw
  }
  return defaultSkillVariant(characterId, kitHoldSeconds)
}

/** Effective skill/burst cast times for the active timing mode + skill variant. */
export function effectiveCastTimes(
  characterId: string,
  mode: TimingMode,
  humanLag = DEFAULT_HUMAN_LAG,
  skillVariant: SkillCastVariant = 'hold',
  kitHoldSeconds: number | null = null,
): { skillCast: number; burstCast: number; comboIncludesBurst: boolean } {
  const t = getFieldCastTimings(characterId, kitHoldSeconds)
  const lag = clampHumanLag(humanLag)
  const resolvedVariant =
    skillVariant === 'hold' && t.skillHoldCast == null ? 'press' : skillVariant
  const useHold = resolvedVariant === 'hold' && t.skillHoldCast != null
  const frameSkill = useHold ? t.skillHoldCast! : t.skillCast
  const humanSkill = useHold
    ? (t.humanSkillHoldCast ?? round(frameSkill + lag))
    : (t.humanSkillCast ?? round(t.skillCast + lag))

  if (mode === 'frame') {
    return {
      skillCast: frameSkill,
      burstCast: t.burstCast,
      // Woven burst on single expected windows, or on the long option of dual kits.
      comboIncludesBurst:
        !!t.comboIncludesBurst && (t.skillHoldCast == null || useHold),
    }
  }
  return {
    skillCast: humanSkill,
    burstCast: t.humanBurstCast ?? round(t.burstCast + lag),
    comboIncludesBurst:
      !!t.comboIncludesBurst && (t.skillHoldCast == null || useHold),
  }
}

export function defaultOnFieldDuration(
  characterId: string,
  opts: {
    skill: boolean
    burst: boolean
    mode?: TimingMode
    humanLag?: number
    skillVariant?: SkillCastVariant
    skillCasts?: number
    kitHoldSeconds?: number | null
  },
): number {
  const mode = opts.mode ?? DEFAULT_TIMING_MODE
  const variant =
    opts.skillVariant ??
    defaultSkillVariant(characterId, opts.kitHoldSeconds ?? null)
  const t = effectiveCastTimes(
    characterId,
    mode,
    opts.humanLag,
    variant,
    opts.kitHoldSeconds ?? null,
  )
  const skillCasts = resolveSkillCasts(characterId, {
    skill: opts.skill,
    skillCasts: opts.skillCasts,
    skillVariant: variant,
    kitHoldSeconds: opts.kitHoldSeconds ?? null,
  })
  let total = 0
  if (opts.skill && skillCasts > 0) total += t.skillCast * skillCasts
  // Expected on-field windows already include woven mini/full bursts
  if (opts.burst && !(opts.skill && t.comboIncludesBurst)) total += t.burstCast
  return Math.max(0.5, round(total))
}

export function parseCastOrder(raw: unknown): CastOrder {
  return raw === 'burst-first' ? 'burst-first' : 'skill-first'
}

/**
 * Seconds from on-field start until each ability's animation starts and finishes.
 * Buffs / shred usually begin at *end*; cooldowns begin at *start*.
 */
export function castTimingOffsets(
  characterId: string,
  opts: {
    skill: boolean
    burst: boolean
    castOrder?: CastOrder
    mode?: TimingMode
    humanLag?: number
    skillVariant?: SkillCastVariant
    skillCasts?: number
    kitHoldSeconds?: number | null
  },
): {
  skillStart: number
  skillEnd: number
  burstStart: number
  burstEnd: number
} {
  const mode = opts.mode ?? DEFAULT_TIMING_MODE
  const variant =
    opts.skillVariant ??
    defaultSkillVariant(characterId, opts.kitHoldSeconds ?? null)
  const t = effectiveCastTimes(
    characterId,
    mode,
    opts.humanLag,
    variant,
    opts.kitHoldSeconds ?? null,
  )
  const skillCasts = resolveSkillCasts(characterId, {
    skill: opts.skill,
    skillCasts: opts.skillCasts,
    skillVariant: variant,
    kitHoldSeconds: opts.kitHoldSeconds ?? null,
  })
  const skill = opts.skill && skillCasts > 0
  const skillSpan = skill ? round(t.skillCast * skillCasts) : 0
  const wovenBurst = skill && !!t.comboIncludesBurst
  const burstStandalone = opts.burst && !wovenBurst
  const order = opts.castOrder ?? 'skill-first'

  if (order === 'burst-first') {
    if (burstStandalone) {
      const burstStart = 0
      const burstEnd = t.burstCast
      return {
        burstStart,
        burstEnd,
        skillStart: skill ? burstEnd : 0,
        skillEnd: skill ? round(burstEnd + skillSpan) : 0,
      }
    }
    if (wovenBurst) {
      const end = t.skillCast
      return { skillStart: 0, skillEnd: end, burstStart: 0, burstEnd: end }
    }
    return {
      burstStart: 0,
      burstEnd: 0,
      skillStart: skill ? 0 : 0,
      skillEnd: skill ? skillSpan : 0,
    }
  }

  // skill-first (default)
  const skillStart = skill ? 0 : 0
  const skillEnd = skill ? skillSpan : 0
  if (burstStandalone) {
    return {
      skillStart,
      skillEnd,
      burstStart: skillEnd,
      burstEnd: round(skillEnd + t.burstCast),
    }
  }
  if (wovenBurst) {
    return { skillStart, skillEnd, burstStart: skillStart, burstEnd: skillEnd }
  }
  return { skillStart, skillEnd, burstStart: 0, burstEnd: 0 }
}

/**
 * Seconds from on-field start until each ability's animation finishes.
 * Timed kit effects (Omen, Pale Hymn, etc.) begin at these offsets.
 */
export function castEndOffsets(
  characterId: string,
  opts: Parameters<typeof castTimingOffsets>[1],
): { skillEnd: number; burstEnd: number } {
  const t = castTimingOffsets(characterId, opts)
  return { skillEnd: t.skillEnd, burstEnd: t.burstEnd }
}

export type FieldActionKind = 'skill' | 'burst'

export type FieldActionSegment = {
  id: string
  kind: FieldActionKind
  label: string
  /** Seconds from on-field start */
  start: number
  duration: number
}

/**
 * Non-overlapping action segments under an on-field window.
 * Mirrors roster skill/burst presets (separate bars).
 * For woven DPS windows, burst is carved out of the expected on-field length by cast order.
 * Time outside these presets is left empty (no filler segment).
 */
export function fieldActionSegments(
  characterId: string,
  fieldDuration: number,
  opts: Parameters<typeof castTimingOffsets>[1],
): FieldActionSegment[] {
  const field = Math.max(0, fieldDuration)
  if (field <= 0) return []

  const base = getFieldCastTimings(
    characterId,
    opts.kitHoldSeconds ?? null,
  )
  const t = effectiveCastTimes(
    characterId,
    opts.mode ?? DEFAULT_TIMING_MODE,
    opts.humanLag,
    opts.skillVariant ??
      defaultSkillVariant(characterId, opts.kitHoldSeconds ?? null),
    opts.kitHoldSeconds ?? null,
  )
  const skillOn = !!opts.skill
  const burstOn = !!opts.burst
  const woven = skillOn && !!t.comboIncludesBurst
  const order = opts.castOrder ?? 'skill-first'
  const variant =
    opts.skillVariant ??
    defaultSkillVariant(characterId, opts.kitHoldSeconds ?? null)
  const pair = skillVariantLabels(base.skillPairStyle ?? 'hold')
  const skillLabel =
    base.skillPairStyle === 'combo'
      ? 'Expected on-field'
      : base.skillHoldCast != null
        ? variant === 'hold'
          ? pair.hold
          : pair.press
        : 'Skill'

  type Raw = { kind: FieldActionKind; label: string; start: number; end: number }
  const raw: Raw[] = []

  if (woven) {
    // Expected on-field window from skill timing; burst preset is a separate slice.
    const windowEnd = t.skillCast
    if (burstOn && t.burstCast > 0) {
      const burstLen = Math.min(t.burstCast, windowEnd)
      if (order === 'burst-first') {
        raw.push({
          kind: 'burst',
          label: 'Burst',
          start: 0,
          end: burstLen,
        })
        if (windowEnd > burstLen) {
          raw.push({
            kind: 'skill',
            label: skillLabel,
            start: burstLen,
            end: windowEnd,
          })
        }
      } else {
        const skillEnd = Math.max(0, windowEnd - burstLen)
        if (skillEnd > 0) {
          raw.push({
            kind: 'skill',
            label: skillLabel,
            start: 0,
            end: skillEnd,
          })
        }
        raw.push({
          kind: 'burst',
          label: 'Burst',
          start: skillEnd,
          end: windowEnd,
        })
      }
    } else if (skillOn) {
      raw.push({
        kind: 'skill',
        label: skillLabel,
        start: 0,
        end: windowEnd,
      })
    }
  } else {
    const skillCasts = resolveSkillCasts(characterId, {
      skill: skillOn,
      skillCasts: opts.skillCasts,
      skillVariant: variant,
      kitHoldSeconds: opts.kitHoldSeconds ?? null,
    })
    const multi = skillCasts > 1
    const burstSeg =
      burstOn && t.burstCast > 0
        ? {
            kind: 'burst' as const,
            label: 'Burst',
            len: t.burstCast,
          }
        : null

    type Step = { kind: FieldActionKind; label: string; len: number }
    const steps: Step[] = []
    const pushSkills = () => {
      for (let i = 0; i < skillCasts; i += 1) {
        steps.push({
          kind: 'skill',
          label: multi ? `Skill ${i + 1}` : skillLabel,
          len: t.skillCast,
        })
      }
    }
    const pushBurst = () => {
      if (burstSeg) steps.push({ kind: 'burst', label: burstSeg.label, len: burstSeg.len })
    }

    if (order === 'burst-first') {
      pushBurst()
      pushSkills()
    } else {
      pushSkills()
      pushBurst()
    }

    let cursor = 0
    for (const step of steps) {
      if (step.len <= 0) continue
      const start = cursor
      const end = round(cursor + step.len)
      raw.push({ kind: step.kind, label: step.label, start, end })
      cursor = end
    }
  }

  const segments: FieldActionSegment[] = []
  for (const seg of raw) {
    const start = Math.max(0, Math.min(field, seg.start))
    const end = Math.max(start, Math.min(field, seg.end))
    if (end <= start) continue
    segments.push({
      id: `${seg.kind}-${segments.length}`,
      kind: seg.kind,
      label: seg.label,
      start,
      duration: round(end - start),
    })
  }

  return segments
}

/** Normalize persisted placements that predate cast toggles / skill variant. */
export function sanitizePlacementCasts(
  p: TimelinePlacementLike,
  kitHoldSeconds: number | null = null,
): {
  castSkill: boolean
  castBurst: boolean
  castOrder: CastOrder
  skillVariant: SkillCastVariant
  skillCasts: number
  comboSteps: import('./types').ComboStep[]
  activeDurations: string[]
  durationOverrides: Record<string, number>
  /** True when skillVariant was missing and should refresh on-field duration */
  migratedVariant: boolean
} {
  const characterId = p.characterId ?? ''
  const hadVariant = p.skillVariant === 'press' || p.skillVariant === 'hold'
  const hadSkillCasts = typeof p.skillCasts === 'number' && Number.isFinite(p.skillCasts)
  const skillVariant = parseSkillVariant(
    p.skillVariant,
    characterId,
    kitHoldSeconds,
  )
  const skillCasts = clampSkillCasts(p.skillCasts, characterId, kitHoldSeconds)
  const needsChargeBackfill =
    !hadSkillCasts &&
    usesDiscreteSkillCharges(characterId, kitHoldSeconds, skillVariant)
  return {
    castSkill: p.castSkill ?? true,
    castBurst: p.castBurst ?? defaultCastBurst(characterId, kitHoldSeconds),
    castOrder: parseCastOrder(p.castOrder),
    skillVariant,
    skillCasts,
    comboSteps: sanitizeComboStepsLocal(p.comboSteps),
    activeDurations: Array.isArray(p.activeDurations) ? p.activeDurations : [],
    durationOverrides: sanitizeOverrides(p.durationOverrides),
    migratedVariant: !hadVariant || needsChargeBackfill,
  }
}

function sanitizeComboStepsLocal(raw: unknown): import('./types').ComboStep[] {
  if (!Array.isArray(raw)) return []
  const out: import('./types').ComboStep[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const actionId = typeof e.actionId === 'string' ? e.actionId.trim() : ''
    if (!actionId) continue
    const stateId =
      typeof e.stateId === 'string' && e.stateId.trim()
        ? e.stateId.trim()
        : 'default'
    const id =
      typeof e.id === 'string' && e.id.trim()
        ? e.id.trim()
        : `cs-${Math.random().toString(36).slice(2, 10)}`
    const gapRaw =
      typeof e.gapAfter === 'number' ? e.gapAfter : Number(e.gapAfter)
    const gapAfter =
      Number.isFinite(gapRaw) && gapRaw > 0
        ? Math.min(10, Math.round(gapRaw * 100) / 100)
        : undefined
    const durRaw =
      typeof e.durationSeconds === 'number'
        ? e.durationSeconds
        : Number(e.durationSeconds)
    const durationSeconds =
      Number.isFinite(durRaw) && durRaw > 0
        ? Math.min(30, Math.round(durRaw * 1000) / 1000)
        : undefined
    out.push({ id, actionId, stateId, gapAfter, durationSeconds })
  }
  return out
}

function sanitizeOverrides(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (!id || !Number.isFinite(n) || n <= 0) continue
    out[id] = Math.min(60, Math.max(0.5, n))
  }
  return out
}

interface TimelinePlacementLike {
  characterId?: string
  castSkill?: boolean
  castBurst?: boolean
  castOrder?: CastOrder
  skillVariant?: SkillCastVariant
  skillCasts?: number
  comboSteps?: unknown
  activeDurations?: string[]
  durationOverrides?: Record<string, number>
}
