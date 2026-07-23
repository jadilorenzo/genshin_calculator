/**
 * Expand a rotation into timed elemental application attempts
 * (hitmarks + ICD metadata), then ready for auraSim.
 */
import { getAnimationAction, framesToSeconds } from './animationTimings'
import {
  NORMALS_ACTION_ID,
  comboActionFamily,
  packComboSteps,
  seedComboStepsFromCasts,
} from './comboSequence'
import { matchElementApp } from './combatMechanicsData'
import { kitHoldChannelSeconds } from './fieldTimings'
import { getCharacter } from './characters'
import type { TimelinePlacement } from './types'

export type TimedHit = {
  time: number
  characterId: string
  placementId: string
  actionId: string
  abil: string | null
  element: string | null
  /** Attempted gauge before ICD (U). */
  gaugeUnits: number
  icdTag: string | null
  icdGroup: string | null
  /** Direct reaction damage that doesn't apply aura (e.g. DirectLunarCharged). */
  directReaction: string | null
  attackTag: string | null
}

function resolveSteps(placement: TimelinePlacement) {
  if (Array.isArray(placement.comboSteps) && placement.comboSteps.length > 0) {
    return placement.comboSteps
  }
  const kitHold = kitHoldChannelSeconds(
    getCharacter(placement.characterId)?.kit.elementalSkill ?? null,
  )
  return seedComboStepsFromCasts(placement.characterId, {
    skill: placement.castSkill ?? true,
    burst: placement.castBurst ?? true,
    castOrder: placement.castOrder,
    skillVariant: placement.skillVariant,
    skillCasts: placement.skillCasts,
    kitHoldSeconds: kitHold,
  })
}

function directReactionFromTag(tag: string | null): string | null {
  if (!tag) return null
  const t = tag.toLowerCase()
  if (t.includes('lunarcharged') || t.includes('lunar-charged')) {
    return 'lunar-charged'
  }
  if (t.includes('lunarbloom') || t.includes('lunar-bloom')) {
    return 'lunar-bloom'
  }
  if (t.includes('lunarcrystallize') || t.includes('lunar-crystallize')) {
    return 'lunar-crystallize'
  }
  return null
}

/**
 * Expand one placement into absolute-time hit attempts.
 * Synthetic "normals" filler is skipped (no real hitmarks).
 */
export function expandPlacementHits(placement: TimelinePlacement): TimedHit[] {
  const steps = resolveSteps(placement)
  if (!steps.length) return []

  const packed = packComboSteps(placement.characterId, steps)
  const hits: TimedHit[] = []

  for (const seg of packed.segments) {
    if (seg.actionId === NORMALS_ACTION_ID) continue

    const anim = getAnimationAction(
      placement.characterId,
      seg.actionId,
      seg.stateId || 'default',
    )
    const app = matchElementApp(placement.characterId, seg.actionId)
    const hitmarks =
      anim?.hitmarks?.length && anim.hitmarks.some((n) => n != null)
        ? (anim.hitmarks as number[])
        : [0]

    const element =
      app?.element && !app.elementDynamic
        ? app.element
        : inferElementFromCharacter(placement.characterId, seg.actionId)

    const gauge =
      app?.gaugeUnits != null && app.gaugeUnits > 0
        ? app.gaugeUnits
        : element && element !== 'Physical'
          ? 1
          : 0

    const direct = directReactionFromTag(app?.attackTag ?? null)

    for (const frame of hitmarks) {
      const offset = framesToSeconds(frame) ?? 0
      hits.push({
        time: roundTime(placement.start + seg.start + offset),
        characterId: placement.characterId,
        placementId: placement.id,
        actionId: seg.actionId,
        abil: app?.abil ?? seg.label,
        element: direct ? null : element,
        gaugeUnits: direct ? 0 : gauge,
        icdTag: app?.icdTag ?? null,
        icdGroup: app?.icdGroup ?? 'Default',
        directReaction: direct,
        attackTag: app?.attackTag ?? null,
      })
    }
  }

  return hits
}

function inferElementFromCharacter(
  characterId: string,
  actionId: string,
): string | null {
  const character = getCharacter(characterId)
  if (!character) return null
  const family = comboActionFamily(actionId)
  // Physical NAs / CAs unless catalyst (always elemental)
  if (
    (family === 'na' || family === 'ca') &&
    character.weapon !== 'Catalyst'
  ) {
    return 'Physical'
  }
  return String(character.element)
}

export function expandRotationHits(
  placements: TimelinePlacement[],
): TimedHit[] {
  const sorted = [...placements].sort((a, b) => a.start - b.start)
  const hits = sorted.flatMap(expandPlacementHits)
  hits.sort((a, b) => a.time - b.time || a.characterId.localeCompare(b.characterId))
  return hits
}

function roundTime(t: number) {
  return Math.round(t * 1000) / 1000
}
