import type { DurationOption } from './durationOptions'
import type { CharacterData } from './types'

/**
 * Common 4pc timed team/support buffs for rotation overlays.
 * `trigger` is when the set usually procs relative to the wearer's casts.
 */
export const ARTIFACT_DURATION_OPTIONS: DurationOption[] = [
  {
    id: 'artifact:vv',
    label: 'VV RES−',
    source: 'artifact',
    skillName: 'Viridescent Venerer',
    seconds: 10,
    // Swirl refreshes the 10s shred; multi-hit E ≈ skill Duration + 10s.
    trigger: 'skill',
    lengthMode: 'skill-uptime',
  },
  {
    id: 'artifact:noblesse',
    label: 'NO ATK',
    source: 'artifact',
    skillName: 'Noblesse Oblige',
    seconds: 12,
    trigger: 'burst',
  },
  {
    id: 'artifact:instructor',
    label: 'Instructor EM',
    source: 'artifact',
    skillName: 'Instructor',
    seconds: 8,
    trigger: 'skill',
  },
  {
    id: 'artifact:tenacity',
    label: 'ToM ATK',
    source: 'artifact',
    skillName: 'Tenacity of the Millelith',
    seconds: 3,
    // Skill hits refresh every 0.5s → skill Duration + 3s after last hit.
    trigger: 'skill',
    lengthMode: 'skill-uptime',
  },
  {
    id: 'artifact:deepwood',
    label: 'Deepwood RES−',
    source: 'artifact',
    skillName: 'Deepwood Memories',
    seconds: 8,
    // Skill/Burst hits refresh → skill Duration + 8s after last hit.
    trigger: 'skill',
    lengthMode: 'skill-uptime',
  },
  {
    id: 'artifact:petra',
    label: 'Petra DMG%',
    source: 'artifact',
    skillName: 'Archaic Petra',
    seconds: 10,
    trigger: 'skill',
  },
  {
    id: 'artifact:maiden',
    label: 'Maiden Healing',
    source: 'artifact',
    skillName: 'Maiden Beloved',
    seconds: 10,
    trigger: 'skill',
  },
  {
    id: 'artifact:scroll',
    label: 'Scroll DMG%',
    source: 'artifact',
    skillName: 'Scroll of the Hero of Cinder City',
    seconds: 15,
    trigger: 'skill',
  },
  {
    id: 'artifact:scroll-ns',
    label: 'Scroll NS DMG%',
    source: 'artifact',
    skillName: 'Scroll of the Hero of Cinder City',
    seconds: 20,
    trigger: 'skill',
  },
  {
    id: 'artifact:gilded',
    label: 'Gilded EM',
    source: 'artifact',
    skillName: 'Gilded Dreams',
    seconds: 8,
    trigger: 'skill',
  },
  {
    id: 'artifact:song-days',
    label: 'Song Days Past',
    source: 'artifact',
    skillName: 'Song of Days Past',
    seconds: 12,
    trigger: 'first',
  },
  {
    id: 'artifact:nighttime',
    label: 'Nighttime Geo%',
    source: 'artifact',
    skillName: 'Nighttime Whispers in the Echoing Woods',
    seconds: 10,
    trigger: 'skill',
  },
]

function kitBlob(character: CharacterData): string {
  const { kit } = character
  return [
    kit.elementalSkill?.description,
    kit.elementalBurst?.description,
    ...kit.passives.map((p) => p.description),
  ]
    .filter(Boolean)
    .join('\n')
}

function isHealer(character: CharacterData): boolean {
  return /restor(?:es?|ing)\s+HP|\bheals?\b|healing|HP regeneration|regenerates? HP/i.test(
    kitBlob(character),
  )
}

function hasNightsoul(character: CharacterData): boolean {
  return /nightsoul/i.test(kitBlob(character))
}

/** Whether this set is a realistic 4pc choice for the character. */
export function isArtifactRelevant(
  optionId: string,
  character: CharacterData,
): boolean {
  const hasSkill = !!character.kit.elementalSkill
  const hasBurst = !!character.kit.elementalBurst

  switch (optionId) {
    case 'artifact:vv':
      return character.element === 'Anemo'
    case 'artifact:petra':
    case 'artifact:nighttime':
      return character.element === 'Geo'
    case 'artifact:deepwood':
    case 'artifact:gilded':
      return character.element === 'Dendro'
    case 'artifact:maiden':
    case 'artifact:song-days':
      return isHealer(character)
    case 'artifact:scroll':
    case 'artifact:scroll-ns':
      return hasNightsoul(character)
    case 'artifact:noblesse':
      return hasBurst
    case 'artifact:instructor':
    case 'artifact:tenacity':
      return hasSkill
    default:
      return false
  }
}

export function getArtifactDurationOptions(
  character: CharacterData,
): DurationOption[] {
  return ARTIFACT_DURATION_OPTIONS.filter((opt) =>
    isArtifactRelevant(opt.id, character),
  )
}

export function isArtifactDurationId(id: string): boolean {
  return id.startsWith('artifact:')
}
