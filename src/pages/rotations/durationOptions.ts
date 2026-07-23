import { getArtifactDurationOptions } from './artifactDurationOptions'
import type { CharacterData, KitSkill } from './types'

/** Kit cast or artifact set that grants the timed effect. */
export type DurationSource = 'skill' | 'burst' | 'artifact'

/** When an artifact (or dual-trigger kit) buff starts relative to casts. */
export type DurationTrigger = 'skill' | 'burst' | 'first' | 'last'

export type DurationKind = 'effect' | 'cooldown'

/**
 * How overlay length is chosen when no manual override is set.
 * - fixed: use `seconds`
 * - skill-uptime: skill Duration (kit) + `seconds` linger after the last
 *   refresh (e.g. Deepwood covering the whole E, then 8s after). Falls back
 *   to `seconds` when the kit has no Duration.
 */
export type DurationLengthMode = 'fixed' | 'skill-uptime'

export interface DurationOption {
  id: string
  label: string
  source: DurationSource
  /** Kit skill name, or artifact set name */
  skillName: string
  seconds: number
  /**
   * Cast that starts the timer (after that cast finishes for effects;
   * at cast start for cooldowns).
   * Defaults from `source` when omitted (`artifact` requires an explicit trigger).
   */
  trigger?: DurationTrigger
  /** Cooldown bars render muted; effects use element tint. */
  kind?: DurationKind
  /**
   * When `skill-uptime`, bar covers skill Duration plus `seconds` after the
   * last trigger (refreshed shred for the whole E, then the set timer).
   * Falls back to `seconds` alone if the kit has no Duration.
   */
  lengthMode?: DurationLengthMode
}

export function optionTrigger(opt: DurationOption): DurationTrigger {
  if (opt.trigger) return opt.trigger
  if (opt.source === 'burst') return 'burst'
  if (opt.source === 'skill') return 'skill'
  return 'skill'
}

export function isCooldownOption(opt: DurationOption): boolean {
  return opt.kind === 'cooldown'
}

const MIN_OVERLAY_SECONDS = 0.5
const MAX_OVERLAY_SECONDS = 90

function clampOverlaySeconds(n: number): number {
  return Math.min(MAX_OVERLAY_SECONDS, Math.max(MIN_OVERLAY_SECONDS, n))
}

function isCooldownAttrName(name: string): boolean {
  return /^cd$/i.test(name) || /\bcd\b/i.test(name) || /cooldown/i.test(name)
}

/** Wearer's Elemental Skill Duration from kit attributes (seconds), if any. */
export function kitSkillUptimeSeconds(
  character: CharacterData | null | undefined,
): number | null {
  const skill = character?.kit.elementalSkill
  if (!skill) return null

  const durationAttr = skill.attributes.find(
    (attr) =>
      attr.unit === 's' &&
      typeof attr.raw === 'number' &&
      attr.raw > 0 &&
      /^duration$/i.test(attr.name),
  )
  if (typeof durationAttr?.raw === 'number') return durationAttr.raw

  const softAttr = skill.attributes.find(
    (attr) =>
      attr.unit === 's' &&
      typeof attr.raw === 'number' &&
      attr.raw > 0 &&
      !isCooldownAttrName(attr.name) &&
      /duration|uptime|field time|sanctuary|domain|skill duration/i.test(
        attr.name,
      ),
  )
  if (typeof softAttr?.raw === 'number') return softAttr.raw

  if (typeof skill.duration === 'number' && skill.duration > 0) {
    return skill.duration
  }
  return null
}

/** Default overlay length before manual overrides (may use skill Duration). */
export function defaultOverlaySeconds(
  opt: DurationOption,
  character?: CharacterData | null,
): number {
  if (opt.lengthMode === 'skill-uptime') {
    const uptime = kitSkillUptimeSeconds(character)
    if (uptime != null) {
      // Skill application window + set linger after the last trigger.
      return clampOverlaySeconds(uptime + opt.seconds)
    }
  }
  return clampOverlaySeconds(opt.seconds)
}

/** Kit default duration, or a placement override when set. */
export function resolveOverlaySeconds(
  opt: DurationOption,
  overrides?: Record<string, number> | null,
  character?: CharacterData | null,
): number {
  const raw = overrides?.[opt.id]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return clampOverlaySeconds(raw)
  }
  return defaultOverlaySeconds(opt, character)
}

export function isOverlayDurationAdjusted(
  opt: DurationOption,
  overrides?: Record<string, number> | null,
  character?: CharacterData | null,
): boolean {
  return (
    Math.abs(
      resolveOverlaySeconds(opt, overrides, character) -
        defaultOverlaySeconds(opt, character),
    ) > 0.001
  )
}

export function sanitizeDurationOverrides(
  raw: unknown,
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (!id || !Number.isFinite(n) || n <= 0) continue
    out[id] = Math.min(MAX_OVERLAY_SECONDS, Math.max(MIN_OVERLAY_SECONDS, n))
  }
  return out
}

export interface CastTimingWindow {
  skillStart: number
  skillEnd: number
  burstStart: number
  burstEnd: number
}

/** Seconds from on-field start until this overlay should begin. */
export function effectStartOffset(
  opt: DurationOption,
  timing: CastTimingWindow,
): number {
  const trigger = optionTrigger(opt)
  const cooldown = isCooldownOption(opt)

  if (cooldown) {
    if (trigger === 'burst') return timing.burstStart
    if (trigger === 'first' || trigger === 'last') {
      const starts: number[] = []
      if (timing.skillEnd > 0) starts.push(timing.skillStart)
      if (timing.burstEnd > 0) starts.push(timing.burstStart)
      if (starts.length === 0) return 0
      return trigger === 'last' ? Math.max(...starts) : Math.min(...starts)
    }
    return timing.skillStart
  }

  if (trigger === 'burst') return timing.burstEnd
  if (trigger === 'first' || trigger === 'last') {
    const candidates = [timing.skillEnd, timing.burstEnd].filter((t) => t > 0)
    if (candidates.length === 0) return 0
    return trigger === 'last'
      ? Math.max(...candidates)
      : Math.min(...candidates)
  }
  return timing.skillEnd
}

function cooldownLabel(source: 'skill' | 'burst', attrName: string): string {
  if (/^cd$/i.test(attrName) || /^cooldown$/i.test(attrName)) {
    return source === 'burst' ? 'Burst CD' : 'Skill CD'
  }
  return attrName
}

function optionsFromSkill(
  source: 'skill' | 'burst',
  skill: KitSkill | null,
): DurationOption[] {
  if (!skill) return []
  const out: DurationOption[] = []
  const seen = new Set<string>()

  for (const attr of skill.attributes) {
    if (attr.unit !== 's') continue
    if (typeof attr.raw !== 'number' || !(attr.raw > 0)) continue

    const cooldown = isCooldownAttrName(attr.name)
    const id = `${source}:${attr.name}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      label: cooldown ? cooldownLabel(source, attr.name) : attr.name,
      source,
      skillName: skill.name,
      seconds: attr.raw,
      trigger: source,
      kind: cooldown ? 'cooldown' : 'effect',
    })
  }

  // Fallback when kit only exposes a top-level cooldown
  if (
    skill.cooldown != null &&
    skill.cooldown > 0 &&
    !out.some((o) => o.kind === 'cooldown' && o.source === source)
  ) {
    const id = `${source}:CD`
    if (!seen.has(id)) {
      out.push({
        id,
        label: source === 'burst' ? 'Burst CD' : 'Skill CD',
        source,
        skillName: skill.name,
        seconds: skill.cooldown,
        trigger: source,
        kind: 'cooldown',
      })
    }
  }

  // Fallback when kit only exposes a generic duration field
  if (
    skill.duration != null &&
    skill.duration > 0 &&
    !out.some((o) => o.kind !== 'cooldown' && o.label === 'Duration')
  ) {
    out.push({
      id: `${source}:Duration`,
      label: 'Duration',
      source,
      skillName: skill.name,
      seconds: skill.duration,
      trigger: source,
      kind: 'effect',
    })
  }

  return out
}

/** Timed effects from a character kit (shields, skill uptime, CDs, etc.). */
export function getKitDurationOptions(character: CharacterData): DurationOption[] {
  return [
    ...optionsFromSkill('skill', character.kit.elementalSkill),
    ...optionsFromSkill('burst', character.kit.elementalBurst),
  ]
}

/** Kit effects only (no cooldowns). */
export function getKitEffectOptions(character: CharacterData): DurationOption[] {
  return getKitDurationOptions(character).filter((o) => o.kind !== 'cooldown')
}

/** Skill / burst cooldown overlays. */
export function getKitCooldownOptions(character: CharacterData): DurationOption[] {
  return getKitDurationOptions(character).filter((o) => o.kind === 'cooldown')
}

/** Kit + common artifact set duration overlays. */
export function getDurationOptions(character: CharacterData): DurationOption[] {
  return [
    ...getKitDurationOptions(character),
    ...getArtifactDurationOptions(character),
  ]
}
