/**
 * Expand a rotation into timed elemental application attempts
 * (on-field hitmarks + off-field aura appliers + ICD metadata).
 */
import { getAnimationAction, framesToSeconds } from './animationTimings'
import {
  NORMALS_ACTION_ID,
  comboActionFamily,
  packComboSteps,
  seedComboStepsFromCasts,
} from './comboSequence'
import { matchElementApp, listPhantasmGaugeApps } from './combatMechanicsData'
import { kitHoldChannelSeconds } from './fieldTimings'
import { listOffFieldAppliers } from './offFieldAppliers'
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
  /** True when this hit comes from an off-field applier (Ripple, Oz, …). */
  offField?: boolean
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
 * Emit ticks for each catalogued off-field applier triggered by this placement.
 * Skill/burst cast time comes from the combo (or cast prefill).
 */
function expandOffFieldHits(placement: TimelinePlacement): TimedHit[] {
  const appliers = listOffFieldAppliers(placement.characterId)
  if (!appliers.length) return []

  const steps = resolveSteps(placement)
  if (!steps.length) return []
  const packed = packComboSteps(placement.characterId, steps)
  const hits: TimedHit[] = []

  for (const applier of appliers) {
    const seg = packed.segments.find(
      (s) => comboActionFamily(s.actionId) === applier.source,
    )
    if (!seg) continue

    const castStart = placement.start + seg.start
    const firstDelay =
      applier.firstTickDelaySeconds ?? applier.intervalSeconds
    const end = castStart + applier.resolvedDuration
    const interval = applier.intervalSeconds
    if (interval <= 0 || applier.resolvedDuration < 0.25) continue

    for (
      let t = castStart + firstDelay;
      t <= end + 1e-6;
      t = roundTime(t + interval)
    ) {
      hits.push({
        time: roundTime(t),
        characterId: placement.characterId,
        placementId: placement.id,
        actionId: `offfield:${applier.id}`,
        abil: applier.abil,
        element: applier.element,
        gaugeUnits: applier.resolvedGauge,
        icdTag: applier.resolvedIcdTag,
        icdGroup: applier.resolvedIcdGroup,
        directReaction: null,
        attackTag: applier.attackTag,
        offField: true,
      })
    }
  }

  return hits
}

/**
 * Expand one placement into absolute-time hit attempts.
 * Synthetic "normals" filler is skipped (no real hitmarks).
 */
export function expandPlacementHits(placement: TimelinePlacement): TimedHit[] {
  const steps = resolveSteps(placement)
  if (!steps.length) return expandOffFieldHits(placement)

  const packed = packComboSteps(placement.characterId, steps)
  const hits: TimedHit[] = []

  for (const seg of packed.segments) {
    if (seg.actionId === NORMALS_ACTION_ID) continue

    const anim = getAnimationAction(
      placement.characterId,
      seg.actionId,
      seg.stateId || 'default',
    )

    // Phantasm Performance: emit Nefer self gauge hits (1U each), not shade/C6 0U lunar.
    if (/phantasm/i.test(seg.actionId)) {
      const phantasmApps = listPhantasmGaugeApps(placement.characterId)
      const hitmarks =
        anim?.hitmarks?.length && anim.hitmarks.some((n) => n != null)
          ? (anim.hitmarks as number[])
          : phantasmApps.map(() => 0)
      const apps =
        phantasmApps.length > 0
          ? phantasmApps
          : [
              matchElementApp(placement.characterId, seg.actionId),
            ].filter(Boolean)
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i]!
        const frame = hitmarks[i] ?? hitmarks[0] ?? 0
        const offset = framesToSeconds(frame) ?? 0
        const element =
          app.element && !app.elementDynamic
            ? app.element
            : inferElementFromCharacter(placement.characterId, seg.actionId)
        const gauge =
          app.gaugeUnits != null && app.gaugeUnits > 0
            ? app.gaugeUnits
            : element && element !== 'Physical'
              ? 1
              : 0
        if (!element || gauge <= 0) continue
        hits.push({
          time: roundTime(placement.start + seg.start + offset),
          characterId: placement.characterId,
          placementId: placement.id,
          actionId: seg.actionId,
          abil: app.abil ?? seg.label,
          element,
          gaugeUnits: gauge,
          icdTag: app.icdTag ?? null,
          icdGroup: app.icdGroup ?? 'Default',
          directReaction: null,
          attackTag: app.attackTag ?? null,
        })
      }
      continue
    }

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

  hits.push(...expandOffFieldHits(placement))
  return hits
}

function inferElementFromCharacter(
  characterId: string,
  actionId: string,
): string | null {
  const character = getCharacter(characterId)
  if (!character) return null
  const family = comboActionFamily(actionId)
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
  hits.sort(
    (a, b) => a.time - b.time || a.characterId.localeCompare(b.characterId),
  )
  return hits
}

function roundTime(t: number) {
  return Math.round(t * 1000) / 1000
}
