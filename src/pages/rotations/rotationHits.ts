/**
 * Expand a rotation into timed elemental application attempts
 * (on-field hitmarks + infused normals + off-field aura appliers + ICD metadata).
 */
import { getAnimationAction, framesToSeconds } from './animationTimings'
import {
  NORMALS_ACTION_ID,
  comboActionFamily,
  comboStepsTotalSeconds,
  packComboSteps,
  seedComboStepsFromCasts,
  type PackedComboSegment,
} from './comboSequence'
import {
  hasSkillInfusedNormalApp,
  matchElementApp,
  listPhantasmGaugeApps,
  getCombatCharacter,
} from './combatMechanicsData'
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

/** Approximate NA cadence when expanding synthetic Normals filler. */
const NORMALS_HIT_INTERVAL_FALLBACK = 0.4

/**
 * Skill-form infusion windows (Manifest Flame, Paramita, …) after the
 * skill that enters the state. Recasts like Spearstorm do not restart.
 */
const SKILL_INFUSION_SECONDS: Record<string, number> = {
  flins: 10,
  'hu-tao': 9,
  skirk: 9,
  diluc: 12,
  keqing: 5,
  // Nightsoul Blessing / Flamestrider form — spans early tE into the DPS window.
  mavuika: 22,
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

function resolveSkillInfusionDuration(characterId: string): number {
  const mapped = SKILL_INFUSION_SECONDS[characterId]
  if (mapped != null && mapped > 0) return mapped

  const hints = getCombatCharacter(characterId)?.kitHints?.attributes ?? []
  const hit = hints.find((a) => {
    const name = a.name || ''
    return (
      /duration/i.test(name) &&
      /manifest|paramita|infusion|nightsoul blessing|seven-phase|skill.?state/i.test(
        name,
      )
    )
  })
  const n = typeof hit?.raw === 'number' ? hit.raw : Number(hit?.raw)
  if (Number.isFinite(n) && n > 0 && n < 60) return n

  return hasSkillInfusedNormalApp(characterId) ? 10 : 0
}

/** First skill that enters the infused form (not spearstorm / DoT recasts). */
function skillStartsInfusion(actionId: string): boolean {
  const fam = comboActionFamily(actionId)
  if (fam !== 'skill') return false
  const id = actionId.toLowerCase()
  if (/spearstorm|recast|dot|tick|hold_end|plunge/i.test(id)) return false
  return id === 'skill' || id.startsWith('skill')
}

function isInfusedAt(
  characterId: string,
  segments: PackedComboSegment[],
  localTime: number,
): boolean {
  if (!hasSkillInfusedNormalApp(characterId)) return false
  const duration = resolveSkillInfusionDuration(characterId)
  if (duration <= 0) return false

  let infusionUntil = -1
  for (const seg of segments) {
    if (seg.start > localTime + 1e-6) break
    if (skillStartsInfusion(seg.actionId)) {
      infusionUntil = seg.start + duration
    }
  }
  return localTime < infusionUntil - 1e-6
}

/** Flamestrider / Paramita / skill-form animation states are always infused. */
function isInfusedFormState(stateId: string | null | undefined): boolean {
  const s = (stateId || '').toLowerCase()
  if (!s || s === 'default') return false
  return (
    s === 'skill_state' ||
    s.includes('flamestrider') ||
    s.includes('bike') ||
    s.includes('paramita') ||
    s.includes('infusion') ||
    s.includes('nightsoul')
  )
}

function isHitInfused(
  characterId: string,
  segments: PackedComboSegment[],
  localTime: number,
  stateId: string | null | undefined,
  absoluteTime: number,
  infusionActiveUntil: number,
): boolean {
  if (isInfusedFormState(stateId)) return true
  if (absoluteTime < infusionActiveUntil - 1e-6) return true
  return isInfusedAt(characterId, segments, localTime)
}

/** Absolute-time infusion expiry from skill casts in one placement. */
function placementInfusionUntil(placement: TimelinePlacement): number {
  if (!hasSkillInfusedNormalApp(placement.characterId)) return -1
  const duration = resolveSkillInfusionDuration(placement.characterId)
  if (duration <= 0) return -1
  const steps = resolveSteps(placement)
  if (!steps.length) return -1
  const packed = packComboSteps(placement.characterId, steps)
  let until = -1
  for (const seg of packed.segments) {
    if (skillStartsInfusion(seg.actionId)) {
      until = Math.max(until, placement.start + seg.start + duration)
    }
  }
  return until
}

function normalsHitInterval(characterId: string): number {
  const na1 = getAnimationAction(characterId, 'na1', 'default')
  const cancelFrames = na1?.cancels?.attack
  if (typeof cancelFrames === 'number' && cancelFrames > 0) {
    return framesToSeconds(cancelFrames) ?? NORMALS_HIT_INTERVAL_FALLBACK
  }
  if (na1?.seconds != null && na1.seconds > 0) return na1.seconds
  return NORMALS_HIT_INTERVAL_FALLBACK
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

function pushHitFromApp(
  hits: TimedHit[],
  placement: TimelinePlacement,
  actionId: string,
  label: string | null,
  localOffset: number,
  app: ReturnType<typeof matchElementApp>,
  infused: boolean,
): void {
  const direct = directReactionFromTag(app?.attackTag ?? null)
  if (direct) {
    hits.push({
      time: roundTime(placement.start + localOffset),
      characterId: placement.characterId,
      placementId: placement.id,
      actionId,
      abil: app?.abil ?? label,
      element: null,
      gaugeUnits: 0,
      icdTag: app?.icdTag ?? null,
      icdGroup: app?.icdGroup ?? 'Default',
      directReaction: direct,
      attackTag: app?.attackTag ?? null,
    })
    return
  }

  // Explicit null/0U kit markers (e.g. Flins Arcane Light activation knockback):
  // still emit as a 0U elemental application so the initial skill cast is visible.
  if (
    app &&
    (app.gaugeUnits == null || app.gaugeUnits <= 0) &&
    !app.elementDynamic
  ) {
    const element =
      app.element && app.element !== 'Physical'
        ? app.element
        : inferElementFromCharacter(placement.characterId, actionId, infused)
    if (!element || element === 'Physical') return
    hits.push({
      time: roundTime(placement.start + localOffset),
      characterId: placement.characterId,
      placementId: placement.id,
      actionId,
      abil: app.abil ?? label,
      element,
      gaugeUnits: 0,
      icdTag: app.icdTag ?? null,
      icdGroup: app.icdGroup ?? 'Default',
      directReaction: null,
      attackTag: app.attackTag ?? null,
    })
    return
  }

  const element =
    app?.element && !app.elementDynamic
      ? app.element
      : inferElementFromCharacter(placement.characterId, actionId, infused)

  const gauge =
    app?.gaugeUnits != null && app.gaugeUnits > 0
      ? app.gaugeUnits
      : element && element !== 'Physical'
        ? 1
        : 0

  hits.push({
    time: roundTime(placement.start + localOffset),
    characterId: placement.characterId,
    placementId: placement.id,
    actionId,
    abil: app?.abil ?? label,
    element,
    gaugeUnits: gauge,
    icdTag: app?.icdTag ?? null,
    icdGroup: app?.icdGroup ?? 'Default',
    directReaction: null,
    attackTag: app?.attackTag ?? null,
  })
}

/**
 * Approximate applications across a Normals (general) filler block.
 */
function expandNormalsSegmentHits(
  placement: TimelinePlacement,
  seg: PackedComboSegment,
  segments: PackedComboSegment[],
  hits: TimedHit[],
  infusionActiveUntil = -1,
): void {
  const interval = Math.max(0.2, normalsHitInterval(placement.characterId))
  const firstOffset = Math.min(0.12, seg.duration * 0.25)
  for (
    let local = seg.start + firstOffset;
    local < seg.start + seg.duration - 1e-6;
    local = roundTime(local + interval)
  ) {
    const infused = isHitInfused(
      placement.characterId,
      segments,
      local,
      seg.stateId,
      placement.start + local,
      infusionActiveUntil,
    )
    const app = matchElementApp(placement.characterId, 'na1', { infused })
    pushHitFromApp(
      hits,
      placement,
      NORMALS_ACTION_ID,
      infused ? 'Normals (Skill)' : 'Normals',
      local,
      app,
      infused,
    )
  }
}

/**
 * Expand one placement into absolute-time hit attempts.
 * Synthetic "normals" filler emits approximate NA applications (infusion-aware).
 */
export function expandPlacementHits(
  placement: TimelinePlacement,
  opts?: { infusionActiveUntil?: number },
): TimedHit[] {
  const steps = resolveSteps(placement)
  if (!steps.length) return expandOffFieldHits(placement)

  const packed = packComboSteps(placement.characterId, steps)
  const hits: TimedHit[] = []
  const infusionActiveUntil = opts?.infusionActiveUntil ?? -1

  for (const seg of packed.segments) {
    if (seg.actionId === NORMALS_ACTION_ID) {
      expandNormalsSegmentHits(
        placement,
        seg,
        packed.segments,
        hits,
        infusionActiveUntil,
      )
      continue
    }

    const infused = isHitInfused(
      placement.characterId,
      packed.segments,
      seg.start,
      seg.stateId,
      placement.start + seg.start,
      infusionActiveUntil,
    )

    const anim = getAnimationAction(
      placement.characterId,
      seg.actionId,
      seg.stateId || 'default',
    )

    // Phantasm Performance: Nefer self Dendro gauge (1U×2) plus direct Lunar-Bloom
    // reaction markers (kit LB damage). Shade/C6 DirectLunar rows stay separate.
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
              matchElementApp(placement.characterId, seg.actionId, {
                infused,
              }),
            ].filter(Boolean)
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i]!
        const frame = hitmarks[i] ?? hitmarks[0] ?? 0
        const offset = framesToSeconds(frame) ?? 0
        const local = seg.start + offset
        const element =
          app.element && !app.elementDynamic
            ? app.element
            : inferElementFromCharacter(
                placement.characterId,
                seg.actionId,
                infused,
              )
        const gauge =
          app.gaugeUnits != null && app.gaugeUnits > 0
            ? app.gaugeUnits
            : element && element !== 'Physical'
              ? 1
              : 0
        if (!element || gauge <= 0) continue
        hits.push({
          time: roundTime(placement.start + local),
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
        // Phantasm self-hits deal Lunar-Bloom DMG even without a Hydro aura.
        if (
          placement.characterId === 'nefer' &&
          /phantasm performance \(nefer/i.test(app.abil || '')
        ) {
          hits.push({
            time: roundTime(placement.start + local),
            characterId: placement.characterId,
            placementId: placement.id,
            actionId: seg.actionId,
            abil: app.abil ?? seg.label,
            element: null,
            gaugeUnits: 0,
            icdTag: 'None',
            icdGroup: 'None',
            directReaction: 'lunar-bloom',
            attackTag: 'DirectLunarBloom',
          })
        }
      }
      continue
    }

    // Dash / jump are movement cancels. Emitting gauge here would steal aura and
    // advance Flamestrider ICD (breaking KQM C3F D C3F). Timed dash = no app.
    const family = comboActionFamily(seg.actionId)
    if (family === 'dash' || family === 'jump') {
      continue
    }

    const app = matchElementApp(placement.characterId, seg.actionId, {
      infused,
    })
    const hitmarks =
      anim?.hitmarks?.length && anim.hitmarks.some((n) => n != null)
        ? (anim.hitmarks as number[])
        : [0]

    for (const frame of hitmarks) {
      const offset = framesToSeconds(frame) ?? 0
      const local = seg.start + offset
      const hitInfused = isHitInfused(
        placement.characterId,
        packed.segments,
        local,
        seg.stateId,
        placement.start + local,
        infusionActiveUntil,
      )
      const hitApp =
        hitInfused === infused
          ? app
          : matchElementApp(placement.characterId, seg.actionId, {
              infused: hitInfused,
            })
      pushHitFromApp(
        hits,
        placement,
        seg.actionId,
        seg.label,
        local,
        hitApp,
        hitInfused,
      )
    }
  }

  hits.push(...expandOffFieldHits(placement))
  return hits
}

function inferElementFromCharacter(
  characterId: string,
  actionId: string,
  infused = false,
): string | null {
  const character = getCharacter(characterId)
  if (!character) return null
  const family = comboActionFamily(actionId)
  if (
    (family === 'na' || family === 'ca' || actionId === NORMALS_ACTION_ID) &&
    character.weapon !== 'Catalyst'
  ) {
    if (infused) return String(character.element)
    return 'Physical'
  }
  return String(character.element)
}

/** Elemental application attempts (excludes Physical / direct reactions). Includes 0U skill activations. */
export function isElementalApplicationHit(hit: TimedHit): boolean {
  return Boolean(
    hit.element &&
      hit.element !== 'Physical' &&
      !hit.directReaction &&
      hit.gaugeUnits >= 0,
  )
}

export function expandRotationHits(
  placements: TimelinePlacement[],
): TimedHit[] {
  const sorted = [...placements].sort((a, b) => a.start - b.start)
  const infusionUntilByChar = new Map<string, number>()
  const hits: TimedHit[] = []

  for (const placement of sorted) {
    const priorUntil = infusionUntilByChar.get(placement.characterId) ?? -1
    hits.push(
      ...expandPlacementHits(placement, { infusionActiveUntil: priorUntil }),
    )
    const nextUntil = placementInfusionUntil(placement)
    if (nextUntil > priorUntil) {
      infusionUntilByChar.set(placement.characterId, nextUntil)
    }
  }

  hits.sort(
    (a, b) => a.time - b.time || a.characterId.localeCompare(b.characterId),
  )
  return suppressRingWhileFlamestrider(hits, sorted)
}

/**
 * KQM / kit: Ring of Searing Radiance disappears while Mavuika is on
 * Flamestrider (Burst Crucibile / bike CA window). Keep off-field ring ticks
 * only while she is swapped out.
 */
function suppressRingWhileFlamestrider(
  hits: TimedHit[],
  placements: TimelinePlacement[],
): TimedHit[] {
  const bikeWindows: { characterId: string; start: number; end: number }[] = []
  for (const p of placements) {
    if (p.characterId !== 'mavuika') continue
    const steps = p.comboSteps ?? []
    const onBike = steps.some(
      (s) =>
        s.actionId === 'burst' ||
        s.stateId === 'skill_state' ||
        /bike|flamestrider|ca_cycle|ca_bike/i.test(s.actionId),
    )
    if (!onBike) continue
    const dur =
      p.duration != null && p.duration > 0
        ? p.duration
        : comboStepsTotalSeconds(p.characterId, steps) || 8
    bikeWindows.push({
      characterId: p.characterId,
      start: p.start,
      end: p.start + dur,
    })
  }
  if (!bikeWindows.length) return hits

  return hits.filter((h) => {
    if (h.characterId !== 'mavuika' || !h.offField) return true
    if (!/ring|searing radiance/i.test(h.abil || h.actionId)) return true
    return !bikeWindows.some(
      (w) => h.time >= w.start - 1e-6 && h.time <= w.end + 1e-6,
    )
  })
}

function roundTime(t: number) {
  return Math.round(t * 1000) / 1000
}
