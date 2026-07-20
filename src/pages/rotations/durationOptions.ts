import type { CharacterData, KitSkill } from './types'

export type DurationSource = 'skill' | 'burst'

export interface DurationOption {
  id: string
  label: string
  source: DurationSource
  skillName: string
  seconds: number
}

function optionsFromSkill(
  source: DurationSource,
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
    })
  }

  return out
}

/** Timed effects from a character kit (shields, skill uptime, etc.). */
export function getDurationOptions(character: CharacterData): DurationOption[] {
  return [
    ...optionsFromSkill('skill', character.kit.elementalSkill),
    ...optionsFromSkill('burst', character.kit.elementalBurst),
  ]
}
