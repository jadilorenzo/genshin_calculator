import { getArtifactDurationOptions } from './artifactDurationOptions'
import type { CharacterData, KitSkill } from './types'

/** Kit cast or artifact set that grants the timed effect. */
export type DurationSource = 'skill' | 'burst' | 'artifact'

/** When an artifact (or dual-trigger kit) buff starts relative to casts. */
export type DurationTrigger = 'skill' | 'burst' | 'first' | 'last'

export interface DurationOption {
  id: string
  label: string
  source: DurationSource
  /** Kit skill name, or artifact set name */
  skillName: string
  seconds: number
  /**
   * Cast that starts the timer (after that cast finishes).
   * Defaults from `source` when omitted (`artifact` requires an explicit trigger).
   */
  trigger?: DurationTrigger
}

export function optionTrigger(opt: DurationOption): DurationTrigger {
  if (opt.trigger) return opt.trigger
  if (opt.source === 'burst') return 'burst'
  if (opt.source === 'skill') return 'skill'
  return 'skill'
}

/** Seconds from on-field start until this overlay should begin. */
export function effectStartOffset(
  opt: DurationOption,
  ends: { skillEnd: number; burstEnd: number },
): number {
  const trigger = optionTrigger(opt)
  if (trigger === 'burst') return ends.burstEnd
  if (trigger === 'first' || trigger === 'last') {
    const candidates = [ends.skillEnd, ends.burstEnd].filter((t) => t > 0)
    if (candidates.length === 0) return 0
    return trigger === 'last'
      ? Math.max(...candidates)
      : Math.min(...candidates)
  }
  return ends.skillEnd
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
    if (/^cd$/i.test(attr.name) || /\bcd\b/i.test(attr.name) || /cooldown/i.test(attr.name))
      continue

    const id = `${source}:${attr.name}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      label: attr.name,
      source,
      skillName: skill.name,
      seconds: attr.raw,
      trigger: source,
    })
  }

  // Fallback when kit only exposes a generic duration field
  if (
    skill.duration != null &&
    skill.duration > 0 &&
    !out.some((o) => o.label === 'Duration')
  ) {
    out.push({
      id: `${source}:Duration`,
      label: 'Duration',
      source,
      skillName: skill.name,
      seconds: skill.duration,
      trigger: source,
    })
  }

  return out
}

/** Timed effects from a character kit (shields, skill uptime, etc.). */
export function getKitDurationOptions(character: CharacterData): DurationOption[] {
  return [
    ...optionsFromSkill('skill', character.kit.elementalSkill),
    ...optionsFromSkill('burst', character.kit.elementalBurst),
  ]
}

/** Kit + common artifact set duration overlays. */
export function getDurationOptions(character: CharacterData): DurationOption[] {
  return [
    ...getKitDurationOptions(character),
    ...getArtifactDurationOptions(character),
  ]
}
