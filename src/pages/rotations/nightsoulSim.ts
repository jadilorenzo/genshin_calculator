/**
 * Approximate Nightsoul point fill along a packed combo (illustrative).
 * Drain intervals in combatMechanics are incomplete — rates are inferred from
 * kit consumption attrs, blessing duration, or periodic drain hints.
 */
import type { PackedCombo } from './comboSequence'
import {
  comboActionFamily,
  packComboSteps,
  seedComboStepsFromCasts,
} from './comboSequence'
import type { NightsoulResource } from './combatMechanics'
import { getCombatCharacter } from './combatMechanicsData'
import { kitHoldChannelSeconds } from './fieldTimings'
import { getCharacter } from './characters'
import type { TimelinePlacement } from './types'

export type NightsoulSample = {
  time: number
  points: number
  fill: number
  max: number
}

/** Skill / form enter restores (or sets) NS points. */
const ENTER_ON_SKILL: Record<string, number | 'max'> = {
  mavuika: 'max',
  chasca: 80,
  ifa: 80,
  citlali: 24,
  mualani: 60,
  xilonen: 45,
  varesa: 'max',
  kinich: 'max',
  ororon: 80,
  iansan: 'max',
  'traveler-pyro': 'max',
}

/**
 * Burst enter (e.g. Mavuika Fighting Spirit → Nightsoul on Q).
 * Typical rotations assume a full convert when casting burst.
 */
const ENTER_ON_BURST: Record<string, number | 'max'> = {
  mavuika: 'max',
}

/** Flat NS gain on burst that does not itself enter a full blessing refill. */
const GAIN_ON_BURST: Record<string, number> = {
  citlali: 24,
}

export function getNightsoulResource(
  characterId: string,
): NightsoulResource | null {
  return getCombatCharacter(characterId)?.resources?.nightsoul ?? null
}

export function hasNightsoulResource(characterId: string): boolean {
  const ns = getNightsoulResource(characterId)
  return Boolean(ns && (ns.maxPoints || ns.maxPointsVariants?.length))
}

function kitNightsoulLimit(characterId: string): number | null {
  const hints = getCombatCharacter(characterId)?.kitHints?.attributes ?? []
  const hit = hints.find((a) => /nightsoul point limit/i.test(a.name))
  const n = typeof hit?.raw === 'number' ? hit.raw : Number(hit?.raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function kitConsumePerSecond(characterId: string): number | null {
  const hints = getCombatCharacter(characterId)?.kitHints?.attributes ?? []
  const hit = hints.find((a) =>
    /nightsoul point consumption|opal fire nightsoul/i.test(a.name),
  )
  const n = typeof hit?.raw === 'number' ? hit.raw : Number(hit?.raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function resolveNightsoulMax(characterId: string): number {
  const ns = getNightsoulResource(characterId)
  const kit = kitNightsoulLimit(characterId)
  if (kit) return kit
  if (ns?.maxPointsVariants?.[0]) return ns.maxPointsVariants[0]
  if (ns?.maxPoints && ns.maxPoints > 0) return ns.maxPoints
  return 0
}

function resolveMappedEnter(
  mapped: number | 'max' | undefined,
  max: number,
): number {
  if (mapped === 'max') return max
  if (typeof mapped === 'number') return Math.min(max, mapped)
  return 0
}

function resolveEnterOnSkill(characterId: string, max: number): number {
  const ns = getNightsoulResource(characterId)
  const blessingEnter = ns?.timedBlessings?.find(
    (b) => b.enterPoints != null && b.enterPoints > 0,
  )?.enterPoints
  if (blessingEnter != null && blessingEnter > 0) {
    return Math.min(max, blessingEnter)
  }
  const fromMap = resolveMappedEnter(ENTER_ON_SKILL[characterId], max)
  if (fromMap > 0) return fromMap
  return max
}

function resolveEnterOnBurst(characterId: string, max: number): number {
  return resolveMappedEnter(ENTER_ON_BURST[characterId], max)
}

function resolveDrainPerSecond(characterId: string, max: number): number {
  const kit = kitConsumePerSecond(characterId)
  if (kit) return kit

  const ns = getNightsoulResource(characterId)
  const blessDur = ns?.timedBlessings?.find(
    (b) => b.durationSeconds != null && b.durationSeconds > 0,
  )?.durationSeconds
  if (blessDur && blessDur > 0) return max / blessDur

  const consumes = (ns?.pointConsumes ?? []).filter((a) => a > 0).sort((a, b) => a - b)
  // Prefer a mid/high consume as per-second bike/ring drain (e.g. Mavuika 10).
  const perSecHint = consumes.find((a) => a >= 3 && a <= 20)
  if (perSecHint != null) return perSecHint

  const drains = ns?.periodicDrainHints ?? []
  const small = drains
    .map((d) => d.amount)
    .filter((a) => a > 0)
    .sort((a, b) => a - b)[0]
  if (small != null) {
    // Extracted amounts are per reduce-tick without interval; treat ≤2 as ~0.1s ticks.
    if (small <= 2) return small / 0.1
    return small
  }

  return max / 12
}

/**
 * Off-field drain while Nightsoul's Blessing persists after swap
 * (e.g. Mavuika Ring of Searing Radiance: 5/s + 3 per 2s hit ≈ 6.5/s).
 */
const OFF_FIELD_DRAIN_PER_SEC: Record<string, number> = {
  mavuika: 6.5,
  citlali: 8, // Itzpapa Opal Fire kit hint
}

function resolveOffFieldDrainPerSecond(characterId: string, max: number): number {
  if (OFF_FIELD_DRAIN_PER_SEC[characterId] != null) {
    return OFF_FIELD_DRAIN_PER_SEC[characterId]
  }
  // Default: blessing continues off-field at ~70% of on-field drain.
  return resolveDrainPerSecond(characterId, max) * 0.7
}

function isOnFieldAt(
  windows: Array<{ start: number; end: number }> | undefined,
  time: number,
): boolean {
  if (!windows?.length) return true
  return windows.some((w) => time >= w.start - 1e-9 && time < w.end - 1e-9)
}

function isSkillEnterAction(actionId: string): boolean {
  const fam = comboActionFamily(actionId)
  if (fam !== 'skill') return false
  // Follow-up / recast frames that are not the blessing enter cast.
  if (
    /spearstorm|pressure|leapframes|skillend|fieryskill|recastframestobike|bikerefresh/i.test(
      actionId,
    )
  ) {
    return false
  }
  return true
}

function isBurstAction(actionId: string): boolean {
  return comboActionFamily(actionId) === 'burst'
}

function resolveEnterAmount(
  characterId: string,
  kind: 'skill' | 'burst',
  max: number,
): number {
  if (kind === 'burst') {
    const enter = resolveEnterOnBurst(characterId, max)
    if (enter > 0) return enter
    return GAIN_ON_BURST[characterId] ?? 0
  }
  return resolveEnterOnSkill(characterId, max)
}

type NightsoulEnterEvent = {
  time: number
  kind: 'skill' | 'burst'
  amount: number
}

function collectEnterEventsFromPacked(
  characterId: string,
  packed: PackedCombo,
  timeOffset: number,
  max: number,
): NightsoulEnterEvent[] {
  const events: NightsoulEnterEvent[] = []
  for (const seg of packed.segments) {
    if (isSkillEnterAction(seg.actionId)) {
      const amount = resolveEnterAmount(characterId, 'skill', max)
      if (amount > 0) {
        events.push({
          time: timeOffset + seg.start,
          kind: 'skill',
          amount,
        })
      }
    } else if (isBurstAction(seg.actionId)) {
      const amount = resolveEnterAmount(characterId, 'burst', max)
      if (amount > 0) {
        events.push({
          time: timeOffset + seg.start,
          kind: 'burst',
          amount,
        })
      }
    }
  }
  return events
}

/**
 * Sample NS fill on an absolute timeline. Drain continues off-field while
 * blessing is active (Ring / companion form), at a separate rate when
 * onFieldWindows are provided.
 */
export function sampleNightsoulTimeline(
  characterId: string,
  events: NightsoulEnterEvent[],
  endTime: number,
  opts?: {
    sampleInterval?: number
    onFieldWindows?: Array<{ start: number; end: number }>
  },
): NightsoulSample[] | null {
  const max = resolveNightsoulMax(characterId)
  if (!(max > 0) || !hasNightsoulResource(characterId)) return null

  const end = Math.max(0, endTime)
  if (end <= 0 && events.length === 0) {
    return [{ time: 0, points: 0, fill: 0, max }]
  }

  const onFieldDrain = resolveDrainPerSecond(characterId, max)
  const offFieldDrain = resolveOffFieldDrainPerSecond(characterId, max)
  const windows = opts?.onFieldWindows
  const sorted = [...events].sort((a, b) => a.time - b.time)
  const samples: NightsoulSample[] = []
  let points = 0
  let blessingActive = false
  let eventIdx = 0
  let t = 0
  const step = Math.max(0.05, opts?.sampleInterval ?? 0.1)

  const push = (time: number) => {
    const clamped = Math.max(0, Math.min(max, points))
    samples.push({
      time,
      points: Math.round(clamped * 10) / 10,
      fill: clamped / max,
      max,
    })
  }

  const applyDrain = (from: number, to: number) => {
    if (!blessingActive || to <= from || points <= 0) return
    // Piecewise drain across on/off-field boundaries inside [from, to].
    let cursor = from
    while (cursor < to - 1e-9 && points > 0) {
      const onField = isOnFieldAt(windows, cursor)
      let nextBoundary = to
      if (windows?.length) {
        for (const w of windows) {
          if (w.start > cursor + 1e-9 && w.start < nextBoundary) {
            nextBoundary = w.start
          }
          if (w.end > cursor + 1e-9 && w.end < nextBoundary) {
            nextBoundary = w.end
          }
        }
      }
      const dt = nextBoundary - cursor
      const rate = onField ? onFieldDrain : offFieldDrain
      points = Math.max(0, points - rate * dt)
      cursor = nextBoundary
      if (points <= 1e-6) {
        points = 0
        blessingActive = false
        break
      }
    }
  }

  const applyEnter = (ev: NightsoulEnterEvent) => {
    if (ENTER_ON_BURST[characterId] != null && ev.kind === 'burst') {
      points = Math.min(max, Math.max(points, ev.amount))
      if (ENTER_ON_BURST[characterId] === 'max') points = max
      blessingActive = true
      return
    }
    if (ev.kind === 'skill') {
      points = Math.min(max, Math.max(points, ev.amount))
      if (ENTER_ON_SKILL[characterId] === 'max') points = max
      blessingActive = true
      return
    }
    points = Math.min(max, points + ev.amount)
    if (points > 0) blessingActive = true
  }

  // Extend past endTime while blessing still has points (off-field linger).
  let simEnd = Math.max(end, sorted[sorted.length - 1]?.time ?? 0)
  push(0)
  while (t < simEnd - 1e-9) {
    const nextEventT =
      eventIdx < sorted.length ? sorted[eventIdx].time : Infinity
    const nextT = Math.min(simEnd, t + step, nextEventT)

    if (nextEventT <= nextT + 1e-9 && eventIdx < sorted.length) {
      const ev = sorted[eventIdx]
      if (ev.time > t) {
        applyDrain(t, ev.time)
        t = ev.time
        push(t)
      }
      applyEnter(ev)
      push(t)
      eventIdx += 1
      const linger = points / Math.max(0.1, offFieldDrain)
      simEnd = Math.max(simEnd, t + linger + 0.05, end)
      continue
    }

    if (nextT > t) {
      applyDrain(t, nextT)
      t = nextT
      push(t)
    } else {
      break
    }

    if (!blessingActive && points <= 0 && eventIdx >= sorted.length) {
      break
    }
  }

  return samples
}

/**
 * Sample approximate Nightsoul fill (0–1) along a packed combo timeline.
 * Returns null when the character has no Nightsoul resource.
 */
export function sampleNightsoulFill(
  characterId: string,
  packed: PackedCombo,
  sampleInterval = 0.1,
): NightsoulSample[] | null {
  const max = resolveNightsoulMax(characterId)
  if (!(max > 0) || !hasNightsoulResource(characterId)) return null
  if (packed.totalSeconds <= 0 || packed.segments.length === 0) {
    return [{ time: 0, points: 0, fill: 0, max }]
  }
  const events = collectEnterEventsFromPacked(characterId, packed, 0, max)
  return sampleNightsoulTimeline(characterId, events, packed.totalSeconds, {
    sampleInterval,
    onFieldWindows: [{ start: 0, end: packed.totalSeconds }],
  })
}

/** Pack combo steps for a placement (explicit inspect steps or cast seed). */
export function packedComboForPlacement(
  placement: Pick<
    TimelinePlacement,
    | 'characterId'
    | 'comboSteps'
    | 'castSkill'
    | 'castBurst'
    | 'castOrder'
    | 'skillVariant'
    | 'skillCasts'
  >,
): PackedCombo {
  if (Array.isArray(placement.comboSteps) && placement.comboSteps.length > 0) {
    return packComboSteps(placement.characterId, placement.comboSteps)
  }
  const kitHold = kitHoldChannelSeconds(
    getCharacter(placement.characterId)?.kit.elementalSkill ?? null,
  )
  const seeded = seedComboStepsFromCasts(placement.characterId, {
    skill: placement.castSkill ?? true,
    burst: placement.castBurst ?? true,
    castOrder: placement.castOrder,
    skillVariant: placement.skillVariant,
    skillCasts: placement.skillCasts,
    kitHoldSeconds: kitHold,
  })
  return packComboSteps(placement.characterId, seeded)
}

export function sampleNightsoulForPlacement(
  placement: Pick<
    TimelinePlacement,
    | 'characterId'
    | 'comboSteps'
    | 'castSkill'
    | 'castBurst'
    | 'castOrder'
    | 'skillVariant'
    | 'skillCasts'
  >,
  sampleInterval = 0.15,
): NightsoulSample[] | null {
  if (!hasNightsoulResource(placement.characterId)) return null
  return sampleNightsoulFill(
    placement.characterId,
    packedComboForPlacement(placement),
    sampleInterval,
  )
}

/**
 * Sample NS for one character across the full rotation, including off-field
 * drain between their field windows (Ring / blessing linger).
 */
export function sampleNightsoulAcrossRotation(
  characterId: string,
  placements: TimelinePlacement[],
  sampleInterval = 0.2,
): NightsoulSample[] | null {
  if (!hasNightsoulResource(characterId)) return null
  const max = resolveNightsoulMax(characterId)
  if (!(max > 0)) return null

  const mine = placements
    .filter((p) => p.characterId === characterId)
    .sort((a, b) => a.start - b.start)
  if (!mine.length) return null

  const onFieldWindows = mine.map((p) => ({
    start: p.start,
    end: p.start + Math.max(0.05, p.duration),
  }))
  const events: NightsoulEnterEvent[] = []
  for (const p of mine) {
    const packed = packedComboForPlacement(p)
    events.push(
      ...collectEnterEventsFromPacked(characterId, packed, p.start, max),
    )
  }
  const fieldEnd = Math.max(...onFieldWindows.map((w) => w.end), 0)
  const rotationEnd = Math.max(
    fieldEnd,
    ...placements.map((p) => p.start + p.duration),
    0,
  )
  return sampleNightsoulTimeline(characterId, events, rotationEnd, {
    sampleInterval,
    onFieldWindows,
  })
}

/** Absolute span where NS is non-zero (for timeline overlay width). */
export function nightsoulActiveSpan(samples: NightsoulSample[]): {
  start: number
  end: number
} | null {
  if (!samples.length) return null
  let start = -1
  let end = samples[0].time
  for (const s of samples) {
    if (s.points > 0.05) {
      if (start < 0) start = s.time
      end = s.time
    } else if (start >= 0) {
      end = s.time
      // keep extending end through the zero sample at deplete
    }
  }
  if (start < 0) return null
  return { start, end: Math.max(end, start + 0.25) }
}

export function nightsoulSummaryLabel(samples: NightsoulSample[]): string {
  if (!samples.length) return '0'
  const peak = samples.reduce(
    (best, s) => (s.fill > best.fill ? s : best),
    samples[0],
  )
  const lastActive =
    [...samples].reverse().find((s) => s.points > 0.05) ??
    samples[samples.length - 1]
  return `${Math.round(peak.points)}/${peak.max} peak · ${Math.round(lastActive.points)} end`
}

/** Solid element colors for Nightsoul intensity gradients. */
export const NIGHTSOUL_ELEMENT_COLORS: Record<string, string> = {
  Pyro: 'rgb(230, 120, 90)',
  Hydro: 'rgb(90, 150, 230)',
  Anemo: 'rgb(110, 200, 180)',
  Electro: 'rgb(170, 130, 230)',
  Dendro: 'rgb(120, 190, 90)',
  Cryo: 'rgb(140, 200, 230)',
  Geo: 'rgb(210, 170, 80)',
}

export function nightsoulElementColor(element: string | null | undefined): string {
  if (!element) return 'rgb(200, 180, 120)'
  return NIGHTSOUL_ELEMENT_COLORS[element] ?? 'rgb(200, 180, 120)'
}

/** CSS linear-gradient stops from left (0%) to right (100%) for fill intensity. */
export function nightsoulFillGradient(
  samples: NightsoulSample[],
  totalSeconds: number,
  element?: string | null,
): string {
  if (!samples.length || !(totalSeconds > 0)) {
    return 'linear-gradient(90deg, transparent, transparent)'
  }
  const color = nightsoulElementColor(element)
  const stops = samples.map((s) => {
    const pct = Math.max(0, Math.min(100, (s.time / totalSeconds) * 100))
    // Cap well below solid kit buff fills (~0.72) so max NS stays a wash, not a bar.
    const alpha = 0.1 + s.fill * 0.42
    return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent) ${pct.toFixed(2)}%`
  })
  // Deduplicate very close stops for shorter CSS
  const compact: string[] = []
  let lastPct = -999
  for (const stop of stops) {
    const pct = Number(stop.match(/([\d.]+)%$/)?.[1] ?? 0)
    if (pct - lastPct < 0.75 && compact.length) continue
    compact.push(stop)
    lastPct = pct
  }
  return `linear-gradient(90deg, ${compact.join(', ')})`
}
