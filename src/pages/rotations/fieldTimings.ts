/**
 * On-field cast / animation lock times (seconds).
 * Prefer gcsim AnimationLength / 60 when available.
 *
 * When a longer skill option exists (hold / charge / skill-state), defaults prefer
 * that longer option; UI can switch to the short cancel/press.
 * Human mode pads each enabled cast with humanLag (unless a human override exists).
 */
import type { CastOrder } from './types'

export type TimingMode = 'frame' | 'human'
export type SkillCastVariant = 'press' | 'hold'
/** How to label the short vs long skill option in the UI. */
export type SkillPairStyle = 'hold' | 'charge' | 'state' | 'combo'
export type { CastOrder }

export const DEFAULT_TIMING_MODE: TimingMode = 'human'
export const DEFAULT_HUMAN_LAG = 0.15
export const MIN_HUMAN_LAG = 0
export const MAX_HUMAN_LAG = 0.75

export interface FieldCastTimings {
  /** Short skill option (press / cancel / early exit / short combo) */
  skillCast: number
  /** Longer skill option (hold / full charge / full skill-state / full DPS combo) */
  skillHoldCast?: number
  /** Elemental Burst animation lock (standalone; skipped when comboIncludesBurst) */
  burstCast: number
  humanSkillCast?: number
  humanSkillHoldCast?: number
  humanBurstCast?: number
  /** UI labels for short/long skill (default hold → Press/Hold) */
  skillPairStyle?: SkillPairStyle
  /**
   * Long/short “skill” times are full on-field combos that already weave burst(s).
   * When true, burstCast is not added while Skill is enabled.
   */
  comboIncludesBurst?: boolean
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

  // —— Main DPS on-field combos (Short / Full) ——
  // Durations are typical C0 field windows; Full is the default.
  flins: {
    // KQM: special E + sQ twice in Manifest Flame (~10–11s), NAs fill the 6s Spearstorm CD.
    skillCast: 5.5, // one special cycle
    skillHoldCast: 10.5,
    burstCast: 2.0, // full 80-cost burst if used instead
    humanSkillCast: 5.8,
    humanSkillHoldCast: 11,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Full ≈ E → E sQ → NAs → E sQ inside Manifest Flame',
  },
  neuvillette: {
    // User/KQM-style stretch: E → CA → Q → 2CA (CA ≈ 3.2s each).
    skillCast: 8.0, // C E C Q-ish (~2 CA)
    skillHoldCast: 12.5, // E CA Q 2CA
    burstCast: 1.6,
    humanSkillCast: 8.3,
    humanSkillHoldCast: 13,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Full ≈ E → Charged Attack → Q → 2 Charged Attacks',
  },
  'hu-tao': {
    skillCast: 6.0,
    skillHoldCast: 9.0, // Paramita Papilio duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Full ≈ skill-state NAs / CAs for Paramita duration',
  },
  arlecchino: {
    skillCast: 6.0,
    skillHoldCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  clorinde: {
    skillCast: 5.0,
    skillHoldCast: 7.5, // Night Vigil
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'raiden-shogun': {
    skillCast: 5.0,
    skillHoldCast: 8.0, // Musou Isshin window + resolve
    burstCast: round(110 / 60),
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  xiao: {
    skillCast: 8.0,
    skillHoldCast: 12.0, // plunge spam of burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  wanderer: {
    skillCast: 6.0,
    skillHoldCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  mualani: {
    skillCast: 6.0,
    skillHoldCast: 10.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  mavuika: {
    skillCast: 5.0,
    skillHoldCast: 8.0, // Crucible ~7s + setup
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  alhaitham: {
    skillCast: 7.0,
    skillHoldCast: 11.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'kamisato-ayaka': {
    skillCast: 6.0,
    skillHoldCast: 9.0,
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  skirk: {
    skillCast: 7.0,
    skillHoldCast: 12.5, // Seven-Phase Flash Mode
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  varesa: {
    skillCast: 5.5,
    skillHoldCast: 10.0, // similar mini-burst cycles
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  chasca: {
    skillCast: 6.0,
    skillHoldCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kinich: {
    skillCast: 7.0,
    skillHoldCast: 11.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  gaming: {
    skillCast: 5.0,
    skillHoldCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  wriothesley: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // skill-state duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  navia: {
    skillCast: 5.0,
    skillHoldCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Classic / legacy on-field DPS
  diluc: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // Q infusion window ~8s + NAs
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  keqing: {
    skillCast: 5.0,
    skillHoldCast: 9.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  klee: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // Q duration 10s field
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  ganyu: {
    skillCast: 8.0, // 2 charged shots
    skillHoldCast: 12.0, // frostflake CA spam stretch
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  yoimiya: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // skill duration
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  eula: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // hold E stacks + Q + NAs
    burstCast: 2.2,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'arataki-itto': {
    skillCast: 7.0,
    skillHoldCast: 12.0, // Ushi + burst CA window ~11s
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'kamisato-ayato': {
    skillCast: 4.0,
    skillHoldCast: 6.5, // Takimeguri Kanka 6s + swap buffer
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  tartaglia: {
    skillCast: 6.0, // short melee
    skillHoldCast: 10.0, // typical melee stance field
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
    note: 'Full ≈ melee stance combo (stance max 30s)',
  },
  cyno: {
    skillCast: 6.0,
    skillHoldCast: 10.5, // Pactsworn / burst duration ~10s
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  tighnari: {
    skillCast: 4.5,
    skillHoldCast: 7.5, // E field + 3 CAs
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  lyney: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // charged shot stacks + Q
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  dehya: {
    skillCast: 5.0,
    skillHoldCast: 9.0, // on-field punch / Q window
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  noelle: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // burst geo infusion ~15s, typical ~12
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  ningguang: {
    skillCast: 5.0,
    skillHoldCast: 9.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  yanfei: {
    skillCast: 6.0,
    skillHoldCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  razor: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // burst duration 15s, typical field
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'shikanoin-heizou': {
    skillCast: 4.0,
    skillHoldCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  freminet: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // Pers Timer / burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kaveh: {
    skillCast: 6.0,
    skillHoldCast: 10.0, // bloom driver burst window
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  sethos: {
    skillCast: 5.0,
    skillHoldCast: 8.5, // Twilight Meditation 8s
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  aloy: {
    skillCast: 5.0,
    skillHoldCast: 9.0, // Rushing Ice ~10s
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  amber: {
    skillCast: 4.0,
    skillHoldCast: 7.0,
    burstCast: 1.3,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  kaeya: {
    skillCast: 4.0,
    skillHoldCast: 7.0, // burst duration 8s
    burstCast: 1.3,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  chongyun: {
    skillCast: 5.0,
    skillHoldCast: 9.0, // field duration 10s driver
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  xinyan: {
    skillCast: 5.0,
    skillHoldCast: 8.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Newer / Nod-Krai & regional on-field DPS
  sandrone: {
    skillCast: 6.0,
    skillHoldCast: 11.0,
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  zibai: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // Lunar Phase Shift 15s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  nefer: {
    skillCast: 5.5,
    skillHoldCast: 9.5, // Shadow Dance 9s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  varka: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // Sturm und Drang 12s
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  durin: {
    skillCast: 6.0,
    skillHoldCast: 11.0,
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  columbina: {
    skillCast: 6.0,
    skillHoldCast: 11.0,
    burstCast: 1.6,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  lohen: {
    skillCast: 7.0,
    skillHoldCast: 12.0, // Masterstroke 13s
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  linnea: {
    skillCast: 6.0,
    skillHoldCast: 10.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },

  // Flex on-field drivers / situational main DPS
  'yumemizuki-mizuki': {
    skillCast: 5.0, // one Dreamdrifter
    skillHoldCast: 8.0, // Dreamdrifter + burst weave
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  ifa: {
    skillCast: 5.0,
    skillHoldCast: 9.0, // on-field hover DPS stretch
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  nilou: {
    // Rarely hypercarry; short dance field when on-field
    skillCast: 4.0,
    skillHoldCast: 7.0, // Pirouette / Lunar Prayer
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  emilie: {
    // Usually off-field; on-field poke window
    skillCast: 4.0,
    skillHoldCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'yae-miko': {
    // Usually off-field; on-field turret setup
    skillCast: 4.0,
    skillHoldCast: 6.5, // 3E setup
    burstCast: 1.8,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-pyro': {
    skillCast: 5.0,
    skillHoldCast: 9.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-electro': {
    skillCast: 5.0,
    skillHoldCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-geo': {
    skillCast: 5.0,
    skillHoldCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-dendro': {
    skillCast: 4.0,
    skillHoldCast: 7.0,
    burstCast: 1.4,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-cryo': {
    skillCast: 5.0,
    skillHoldCast: 8.0,
    burstCast: 1.5,
    skillPairStyle: 'combo',
    comboIncludesBurst: true,
  },
  'traveler-hydro': {
    skillCast: 5.0,
    skillHoldCast: 8.0,
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
  if (style === 'combo') return { press: 'Short', hold: 'Full' }
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
  if (kitHoldSeconds != null && kitHoldSeconds > 0) {
    return {
      ...base,
      skillHoldCast: kitHoldSeconds,
      skillPairStyle: base.skillPairStyle ?? 'hold',
    }
  }
  return base
}

export function hasSkillHold(
  characterId: string,
  kitHoldSeconds: number | null = null,
): boolean {
  return getFieldCastTimings(characterId, kitHoldSeconds).skillHoldCast != null
}

export function defaultSkillVariant(
  characterId: string,
  kitHoldSeconds: number | null = null,
): SkillCastVariant {
  // Prefer Full / Charge / Hold whenever a long option exists
  return hasSkillHold(characterId, kitHoldSeconds) ? 'hold' : 'press'
}

/** New placements include Burst; combo windows still don’t double-count it. */
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
  return t.skillPairStyle === 'combo' ? 'Combo' : 'Skill'
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
      comboIncludesBurst: !!t.comboIncludesBurst,
    }
  }
  return {
    skillCast: humanSkill,
    burstCast: t.humanBurstCast ?? round(t.burstCast + lag),
    comboIncludesBurst: !!t.comboIncludesBurst,
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
  let total = 0
  if (opts.skill) total += t.skillCast
  // Combo windows already include woven mini/full bursts
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
  const skill = opts.skill
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
        skillEnd: skill ? round(burstEnd + t.skillCast) : 0,
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
      skillEnd: skill ? t.skillCast : 0,
    }
  }

  // skill-first (default)
  const skillStart = skill ? 0 : 0
  const skillEnd = skill ? t.skillCast : 0
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

/** Normalize persisted placements that predate cast toggles / skill variant. */
export function sanitizePlacementCasts(
  p: TimelinePlacementLike,
  kitHoldSeconds: number | null = null,
): {
  castSkill: boolean
  castBurst: boolean
  castOrder: CastOrder
  skillVariant: SkillCastVariant
  activeDurations: string[]
  /** True when skillVariant was missing and should refresh on-field duration */
  migratedVariant: boolean
} {
  const characterId = p.characterId ?? ''
  const hadVariant = p.skillVariant === 'press' || p.skillVariant === 'hold'
  return {
    castSkill: p.castSkill ?? true,
    castBurst: p.castBurst ?? defaultCastBurst(characterId, kitHoldSeconds),
    castOrder: parseCastOrder(p.castOrder),
    skillVariant: parseSkillVariant(p.skillVariant, characterId, kitHoldSeconds),
    activeDurations: Array.isArray(p.activeDurations) ? p.activeDurations : [],
    migratedVariant: !hadVariant,
  }
}

interface TimelinePlacementLike {
  characterId?: string
  castSkill?: boolean
  castBurst?: boolean
  castOrder?: CastOrder
  skillVariant?: SkillCastVariant
  activeDurations?: string[]
}
