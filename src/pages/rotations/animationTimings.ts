import timingsFile from '../../data/characterAnimationTimings.json'
import type {
  AnimationAction,
  AnimationState,
  CharacterAnimationTimings,
  CharacterAnimationTimingsFile,
} from './animationTimingsTypes'

const data = timingsFile as CharacterAnimationTimingsFile

const byId = new Map<string, CharacterAnimationTimings>(
  data.characters.map((c) => [c.id, c]),
)

export function getAnimationTimingsFile(): CharacterAnimationTimingsFile {
  return data
}

export function getCharacterAnimationTimings(
  characterId: string,
): CharacterAnimationTimings | null {
  return byId.get(characterId) ?? null
}

export function getAnimationState(
  characterId: string,
  stateId = 'default',
): AnimationState | null {
  const character = getCharacterAnimationTimings(characterId)
  if (!character) return null
  return character.states.find((s) => s.id === stateId) ?? null
}

export function getAnimationAction(
  characterId: string,
  actionId: string,
  stateId = 'default',
): AnimationAction | null {
  const state = getAnimationState(characterId, stateId)
  if (!state) return null
  return state.actions.find((a) => a.id === actionId) ?? null
}

/** Frames → seconds helper using the file's fps (60). */
export function framesToSeconds(frames: number | null | undefined, fps = data.fps) {
  if (frames == null) return null
  return Math.round((frames / fps) * 1000) / 1000
}

function actionBucket(actionId: string): string {
  const x = actionId.toLowerCase()
  if (/^na\d/.test(x) || x.startsWith('na_')) return 'na'
  if (x === 'ca' || x.startsWith('ca_') || x.startsWith('aim')) return 'ca'
  if (x === 'skill' || x.startsWith('skill')) return 'skill'
  if (x === 'burst' || x.startsWith('burst')) return 'burst'
  if (x === 'dash' || x.startsWith('dash')) return 'dash'
  return 'other'
}

function isIgnoredForCoreCoverage(
  actionId: string,
  weapon: string | null | undefined,
): boolean {
  const x = actionId.toLowerCase()
  if (
    x === 'jump' ||
    x === 'swap' ||
    x === 'walk' ||
    x.startsWith('jump_') ||
    x.startsWith('swap_') ||
    x.startsWith('walk_') ||
    x.includes('plunge')
  ) {
    return true
  }
  // Claymore CA is intentionally untimed (flexible / rarely simmed).
  const isClaymore = (weapon ?? '').toLowerCase().includes('claymore')
  if (
    isClaymore &&
    (x === 'ca' || x.startsWith('ca_') || x.includes('charge'))
  ) {
    return true
  }
  return false
}

/** Core combo actions we surface warnings for: NA / CA / skill / burst / dash. */
export function isCoreCombatAction(
  actionId: string,
  weapon?: string | null,
): boolean {
  if (isIgnoredForCoreCoverage(actionId, weapon)) return false
  return ['na', 'ca', 'skill', 'burst', 'dash'].includes(actionBucket(actionId))
}

export type CoreTimingGap = {
  stateId: string
  actionId: string
  label: string
}

/** Untimed core actions (excludes jump/swap/walk/plunge and claymore CA). */
export function listCoreTimingGaps(
  characterId: string,
  weapon?: string | null,
): CoreTimingGap[] {
  const character = getCharacterAnimationTimings(characterId)
  if (!character) return []
  const gaps: CoreTimingGap[] = []
  for (const state of character.states) {
    for (const action of state.actions) {
      if (action.frames != null) continue
      if (!isCoreCombatAction(action.id, weapon)) continue
      gaps.push({
        stateId: state.id,
        actionId: action.id,
        label: action.label,
      })
    }
  }
  return gaps
}

export function hasCoreTimingGaps(
  characterId: string,
  weapon?: string | null,
): boolean {
  const character = getCharacterAnimationTimings(characterId)
  if (!character) return true
  return listCoreTimingGaps(characterId, weapon).length > 0
}
