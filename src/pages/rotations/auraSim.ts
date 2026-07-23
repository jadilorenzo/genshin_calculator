/**
 * Enemy aura + reaction simulator (gauge theory approximation).
 *
 * Models: aura tax, decay, ICD, transformative/coexistence reactions,
 * Electro-Charged ticks, and Moonsign conversions (Lunar-Charged / Lunar-Bloom).
 */
import { getIcdGroup } from './combatMechanicsData'
import type { TimedHit } from './rotationHits'

export type AuraElement =
  | 'Pyro'
  | 'Hydro'
  | 'Electro'
  | 'Cryo'
  | 'Dendro'
  | 'Anemo'
  | 'Geo'
  | 'Quicken'
  | 'Frozen'
  | 'Burning'

export type ReactionId =
  | 'melt'
  | 'vaporize'
  | 'overload'
  | 'superconduct'
  | 'electro-charged'
  | 'lunar-charged'
  | 'freeze'
  | 'swirl'
  | 'crystallize'
  | 'burning'
  | 'bloom'
  | 'lunar-bloom'
  | 'quicken'
  | 'aggravate'
  | 'spread'
  | 'shatter'

export type AuraSnapshot = {
  time: number
  auras: Array<{ element: AuraElement; gauge: number }>
}

export type ReactionEvent = {
  time: number
  reaction: ReactionId
  triggerElement: string
  auraElement: string | null
  characterId: string
  /** Timeline placement that produced the trigger hit (empty for aura ticks). */
  placementId: string
  actionId: string
  note?: string
}

export type SimOptions = {
  /** Convert EC ↔ Lunar-Charged (Ineffa / Flins). */
  convertElectroCharged?: boolean
  /** Convert Bloom ↔ Lunar-Bloom (Lauma / Nefer). */
  convertBloom?: boolean
  /** Sample aura state this often for the timeline (seconds). */
  sampleInterval?: number
  endTime?: number
}

export type AuraTransition = {
  time: number
  /** Lasting aura elements after the change (empty = cleared). */
  auras: Array<{ element: AuraElement; gauge: number }>
  /** Brief swirl/crystallize icons rendered under the lasting aura row. */
  flash?: Array<{ element: AuraElement; gauge: number }>
}

export type AuraSimResult = {
  events: ReactionEvent[]
  auraTimeline: AuraSnapshot[]
  /** Moments when the aura composition changed (for timeline markers). */
  transitions: AuraTransition[]
  reactionCounts: Record<string, number>
  applicationCounts: Record<string, number>
  skippedByIcd: number
  hitsProcessed: number
}

const AURA_TAX = 0.8
const EC_TICK_INTERVAL = 1.0
const EC_TICK_CONSUME = 0.4

/** Approximate aura duration (s) by original pre-tax GU applied. */
function auraDurationSeconds(preTaxGauge: number): number {
  if (preTaxGauge >= 1.75) return 12
  if (preTaxGauge >= 0.9) return 9.5
  return 7
}

type AuraSlot = {
  element: AuraElement
  gauge: number
  decayPerSec: number
}

type IcdState = {
  windowStart: number
  index: number
}

function normalizeElement(el: string | null | undefined): string | null {
  if (!el) return null
  const x = el.trim()
  if (!x || x === 'Physical' || x === 'None') return null
  return x
}

function decayAuras(auras: AuraSlot[], dt: number) {
  if (dt <= 0) return
  for (const a of auras) {
    a.gauge = Math.max(0, a.gauge - a.decayPerSec * dt)
  }
  for (let i = auras.length - 1; i >= 0; i--) {
    if (auras[i].gauge < 0.01) auras.splice(i, 1)
  }
}

/** Seconds until the next aura fully decays (null if none decaying). */
function timeToNextExpiry(auras: AuraSlot[]): number | null {
  let soonest: number | null = null
  for (const a of auras) {
    if (a.decayPerSec <= 1e-9) continue
    const tte = a.gauge / a.decayPerSec
    if (tte < 1e-6) continue
    if (soonest == null || tte < soonest) soonest = tte
  }
  return soonest
}

function snapshot(time: number, auras: AuraSlot[]): AuraSnapshot {
  return {
    time,
    auras: auras.map((a) => ({
      element: a.element,
      gauge: Math.round(a.gauge * 100) / 100,
    })),
  }
}

function auraCompositionKey(auras: AuraSlot[]): string {
  return auras
    .filter((a) => a.gauge >= 0.01)
    .map((a) => a.element)
    .sort()
    .join('|')
}

function applyAura(
  auras: AuraSlot[],
  element: AuraElement,
  preTaxGauge: number,
) {
  const taxed = preTaxGauge * AURA_TAX
  if (taxed < 0.01) return
  const duration = auraDurationSeconds(preTaxGauge)
  const decayPerSec = taxed / duration
  const existing = auras.find((a) => a.element === element)
  if (existing) {
    // Refresh gauge and reset decay from the new application strength
    existing.gauge = Math.min(existing.gauge + taxed, taxed * 2)
    existing.decayPerSec = taxed / duration
  } else {
    auras.push({ element, gauge: taxed, decayPerSec })
  }
}

function consumeAura(
  auras: AuraSlot[],
  element: AuraElement,
  amount: number,
): number {
  const slot = auras.find((a) => a.element === element)
  if (!slot) return 0
  const used = Math.min(slot.gauge, amount)
  slot.gauge -= used
  if (slot.gauge < 0.01) {
    const i = auras.indexOf(slot)
    if (i >= 0) auras.splice(i, 1)
  }
  return used
}

function hasAura(auras: AuraSlot[], el: AuraElement) {
  return auras.some((a) => a.element === el && a.gauge >= 0.01)
}

function findAura(auras: AuraSlot[], el: AuraElement) {
  return auras.find((a) => a.element === el && a.gauge >= 0.01) ?? null
}

function bumpCount(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] ?? 0) + n
}

function shouldApplyByIcd(
  icd: Map<string, IcdState>,
  characterId: string,
  hit: TimedHit,
): boolean {
  const tag = hit.icdTag
  if (!tag || tag === 'None') return true
  if (hit.icdGroup === 'None') return true

  const groupName = hit.icdGroup || 'Default'
  const def = getIcdGroup(groupName) ?? getIcdGroup('Default')
  const seq = def?.gaugeSequence?.length ? def.gaugeSequence : [1, 0, 0]
  const reset = def?.resetSeconds ?? 2.5

  const key = `${characterId}::${tag}`
  const existing = icd.get(key)

  // Timer is from the *first hit of the current ICD window* (not last apply).
  // After resetSeconds, the next hit starts a fresh sequence and applies.
  if (!existing || hit.time - existing.windowStart >= reset) {
    icd.set(key, { windowStart: hit.time, index: 1 })
    return true
  }

  const applies = seq[existing.index % seq.length] !== 0
  existing.index += 1
  icd.set(key, existing)
  return applies
}

type ReactionOutcome = {
  reaction: ReactionId
  auraElement: AuraElement
  /** How much of the trigger gauge is consumed (1 = all). */
  triggerConsumed: number
  /** Aura gauge to remove (absolute). */
  auraConsume: number
  coexistence?: boolean
  leftoverApplies?: boolean
}

/**
 * Resolve what happens when `trigger` (gauge G) hits current auras.
 * Returns at most one primary reaction for simplicity (priority order).
 */
function resolveReaction(
  auras: AuraSlot[],
  trigger: string,
  gauge: number,
  opts: SimOptions,
): ReactionOutcome | null {
  if (gauge <= 0) return null

  // Frozen shatter by blunt — skip (no blunt flag)

  // Quicken / Aggravate / Spread
  if (trigger === 'Electro' && hasAura(auras, 'Dendro')) {
    return {
      reaction: 'quicken',
      auraElement: 'Dendro',
      triggerConsumed: 1,
      auraConsume: gauge * AURA_TAX,
      coexistence: true,
    }
  }
  if (trigger === 'Dendro' && hasAura(auras, 'Electro')) {
    return {
      reaction: 'quicken',
      auraElement: 'Electro',
      triggerConsumed: 1,
      auraConsume: gauge * AURA_TAX,
      coexistence: true,
    }
  }
  if (trigger === 'Electro' && hasAura(auras, 'Quicken')) {
    return {
      reaction: 'aggravate',
      auraElement: 'Quicken',
      triggerConsumed: 0,
      auraConsume: 0,
    }
  }
  if (trigger === 'Dendro' && hasAura(auras, 'Quicken')) {
    return {
      reaction: 'spread',
      auraElement: 'Quicken',
      triggerConsumed: 0,
      auraConsume: 0,
    }
  }

  // Bloom / Lunar-Bloom (Dendro ↔ Hydro) — Dendro often eats Hydro
  if (trigger === 'Dendro' && hasAura(auras, 'Hydro')) {
    return {
      reaction: opts.convertBloom ? 'lunar-bloom' : 'bloom',
      auraElement: 'Hydro',
      triggerConsumed: 1,
      auraConsume: gauge * 0.5,
    }
  }
  if (trigger === 'Hydro' && hasAura(auras, 'Dendro')) {
    return {
      reaction: opts.convertBloom ? 'lunar-bloom' : 'bloom',
      auraElement: 'Dendro',
      triggerConsumed: 1,
      auraConsume: gauge * 0.5,
    }
  }

  // Burning
  if (trigger === 'Pyro' && hasAura(auras, 'Dendro')) {
    return {
      reaction: 'burning',
      auraElement: 'Dendro',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }
  if (trigger === 'Dendro' && hasAura(auras, 'Pyro')) {
    return {
      reaction: 'burning',
      auraElement: 'Pyro',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }

  // Melt
  if (trigger === 'Pyro' && hasAura(auras, 'Cryo')) {
    return {
      reaction: 'melt',
      auraElement: 'Cryo',
      triggerConsumed: 1,
      auraConsume: gauge * 0.5,
    }
  }
  if (trigger === 'Cryo' && hasAura(auras, 'Pyro')) {
    return {
      reaction: 'melt',
      auraElement: 'Pyro',
      triggerConsumed: 1,
      auraConsume: gauge * 2,
    }
  }
  if (trigger === 'Pyro' && hasAura(auras, 'Frozen')) {
    return {
      reaction: 'melt',
      auraElement: 'Frozen',
      triggerConsumed: 1,
      auraConsume: gauge * 0.5,
    }
  }

  // Vaporize
  if (trigger === 'Hydro' && hasAura(auras, 'Pyro')) {
    return {
      reaction: 'vaporize',
      auraElement: 'Pyro',
      triggerConsumed: 1,
      auraConsume: gauge * 0.5,
    }
  }
  if (trigger === 'Pyro' && hasAura(auras, 'Hydro')) {
    return {
      reaction: 'vaporize',
      auraElement: 'Hydro',
      triggerConsumed: 1,
      auraConsume: gauge * 2,
    }
  }

  // Overload
  if (trigger === 'Pyro' && hasAura(auras, 'Electro')) {
    return {
      reaction: 'overload',
      auraElement: 'Electro',
      triggerConsumed: 1,
      auraConsume: gauge * 1,
    }
  }
  if (trigger === 'Electro' && hasAura(auras, 'Pyro')) {
    return {
      reaction: 'overload',
      auraElement: 'Pyro',
      triggerConsumed: 1,
      auraConsume: gauge * 1,
    }
  }

  // Superconduct
  if (trigger === 'Cryo' && hasAura(auras, 'Electro')) {
    return {
      reaction: 'superconduct',
      auraElement: 'Electro',
      triggerConsumed: 1,
      auraConsume: gauge * 1,
    }
  }
  if (trigger === 'Electro' && hasAura(auras, 'Cryo')) {
    return {
      reaction: 'superconduct',
      auraElement: 'Cryo',
      triggerConsumed: 1,
      auraConsume: gauge * 1,
    }
  }
  if (trigger === 'Electro' && hasAura(auras, 'Frozen')) {
    return {
      reaction: 'superconduct',
      auraElement: 'Frozen',
      triggerConsumed: 1,
      auraConsume: gauge * 1,
    }
  }

  // Freeze
  if (trigger === 'Cryo' && hasAura(auras, 'Hydro')) {
    return {
      reaction: 'freeze',
      auraElement: 'Hydro',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }
  if (trigger === 'Hydro' && hasAura(auras, 'Cryo')) {
    return {
      reaction: 'freeze',
      auraElement: 'Cryo',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }

  // Electro-Charged / Lunar-Charged
  if (trigger === 'Electro' && hasAura(auras, 'Hydro')) {
    return {
      reaction: opts.convertElectroCharged
        ? 'lunar-charged'
        : 'electro-charged',
      auraElement: 'Hydro',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }
  if (trigger === 'Hydro' && hasAura(auras, 'Electro')) {
    return {
      reaction: opts.convertElectroCharged
        ? 'lunar-charged'
        : 'electro-charged',
      auraElement: 'Electro',
      triggerConsumed: 1,
      auraConsume: 0,
      coexistence: true,
    }
  }

  // Swirl
  if (trigger === 'Anemo') {
    for (const el of ['Pyro', 'Hydro', 'Electro', 'Cryo'] as AuraElement[]) {
      if (hasAura(auras, el)) {
        return {
          reaction: 'swirl',
          auraElement: el,
          triggerConsumed: 1,
          auraConsume: gauge * 0.5,
        }
      }
    }
  }

  // Crystallize
  if (trigger === 'Geo') {
    for (const el of ['Pyro', 'Hydro', 'Electro', 'Cryo'] as AuraElement[]) {
      if (hasAura(auras, el)) {
        return {
          reaction: 'crystallize',
          auraElement: el,
          triggerConsumed: 1,
          auraConsume: gauge * 0.5,
        }
      }
    }
  }

  return null
}

function applyCoexistence(
  auras: AuraSlot[],
  trigger: string,
  gauge: number,
  reaction: ReactionId,
) {
  if (reaction === 'quicken') {
    // Remove pure Dendro/Electro, add Quicken
    const other = trigger === 'Electro' ? 'Dendro' : 'Electro'
    consumeAura(auras, other as AuraElement, gauge * AURA_TAX)
    // Strip trigger-as-aura if present
    const q = findAura(auras, 'Quicken')
    const add = gauge * AURA_TAX
    if (q) q.gauge = Math.max(q.gauge, add)
    else
      auras.push({
        element: 'Quicken',
        gauge: add,
        decayPerSec: add / 12,
      })
    return
  }
  if (reaction === 'freeze') {
    const other = trigger === 'Cryo' ? 'Hydro' : 'Cryo'
    const slot = findAura(auras, other as AuraElement)
    const g = Math.min(slot?.gauge ?? 0, gauge * AURA_TAX)
    if (slot) consumeAura(auras, other as AuraElement, g)
    auras.push({
      element: 'Frozen',
      gauge: Math.max(g, 0.4),
      decayPerSec: 0.4 / 8,
    })
    applyAura(auras, trigger as AuraElement, gauge)
    return
  }
  if (
    reaction === 'electro-charged' ||
    reaction === 'lunar-charged' ||
    reaction === 'burning'
  ) {
    applyAura(auras, trigger as AuraElement, gauge)
  }
}

function roundTime(t: number) {
  return Math.round(t * 1000) / 1000
}

export function simulateAura(
  hits: TimedHit[],
  opts: SimOptions = {},
): AuraSimResult {
  const auras: AuraSlot[] = []
  const icd = new Map<string, IcdState>()
  const events: ReactionEvent[] = []
  const auraTimeline: AuraSnapshot[] = []
  const transitions: AuraTransition[] = []
  const reactionCounts: Record<string, number> = {}
  const applicationCounts: Record<string, number> = {}
  let skippedByIcd = 0
  let hitsProcessed = 0
  let lastComposition = ''

  const sampleInterval = opts.sampleInterval ?? 0.25
  const endTime =
    opts.endTime ??
    (hits.length ? hits[hits.length - 1].time + 2 : 0)

  let time = 0
  let hitIdx = 0
  const ecTick = { time: -EC_TICK_INTERVAL }

  const noteTransition = (at: number) => {
    const key = auraCompositionKey(auras)
    if (key === lastComposition) return
    lastComposition = key
    transitions.push({
      time: roundTime(at),
      auras: snapshot(at, auras).auras,
    })
  }

  /** Swirl/crystallize: lasting auras stay on the main row; Anemo/Geo flash below. */
  const noteFlashTransition = (
    at: number,
    flash: AuraElement,
    flashGauge = 0.15,
  ) => {
    transitions.push({
      time: roundTime(at),
      auras: snapshot(at, auras).auras,
      flash: [{ element: flash, gauge: flashGauge }],
    })
    lastComposition = auraCompositionKey(auras)
  }

  auraTimeline.push(snapshot(0, auras))

  const advanceTo = (target: number) => {
    const goal = roundTime(target)
    if (goal <= time + 1e-12) {
      time = Math.max(time, goal)
      return
    }
    let cursor = time
    let guard = 0
    while (cursor < goal - 1e-9) {
      if (++guard > 200_000) break
      const expiry = timeToNextExpiry(auras)
      const ecActive = hasAura(auras, 'Hydro') && hasAura(auras, 'Electro')
      const nextTickAt = ecActive ? ecTick.time + EC_TICK_INTERVAL : Infinity
      let stepTo = goal
      if (expiry != null) stepTo = Math.min(stepTo, cursor + expiry)
      if (ecActive) stepTo = Math.min(stepTo, nextTickAt)

      const dt = Math.max(0, stepTo - cursor)
      decayAuras(auras, dt)
      const next = roundTime(stepTo)
      // Float rounding can leave cursor == next with empty auras → spin.
      cursor = next > cursor + 1e-12 ? next : roundTime(cursor + 0.001)
      noteTransition(cursor)

      if (
        ecActive &&
        Math.abs(cursor - nextTickAt) < 1e-6 &&
        hasAura(auras, 'Hydro') &&
        hasAura(auras, 'Electro')
      ) {
        consumeAura(auras, 'Hydro', EC_TICK_CONSUME)
        consumeAura(auras, 'Electro', EC_TICK_CONSUME)
        noteTransition(cursor)
        const reaction: ReactionId = opts.convertElectroCharged
          ? 'lunar-charged'
          : 'electro-charged'
        events.push({
          time: cursor,
          reaction,
          triggerElement: 'tick',
          auraElement: 'Hydro+Electro',
          characterId: '',
          placementId: '',
          actionId: 'ec-tick',
          note: 'aura tick',
        })
        bumpCount(reactionCounts, reaction)
        ecTick.time = cursor
      }
    }
    if (!(hasAura(auras, 'Hydro') && hasAura(auras, 'Electro'))) {
      ecTick.time = goal - EC_TICK_INTERVAL
    }
    time = goal
  }

  while (hitIdx < hits.length || time < endTime - 1e-9) {
    const nextHit = hits[hitIdx]
    const nextSample =
      Math.floor(time / sampleInterval + 1e-9) * sampleInterval + sampleInterval
    let nextEventTime = Math.min(nextSample, endTime)
    if (nextHit && nextHit.time <= endTime + 1e-9) {
      nextEventTime = Math.min(nextEventTime, nextHit.time)
    }
    // Step to aura expiry so decay clearances become timeline markers
    const expiry = timeToNextExpiry(auras)
    if (expiry != null) {
      nextEventTime = Math.min(nextEventTime, time + expiry)
    }

    if (time >= endTime - 1e-9 && (!nextHit || nextHit.time > endTime + 1e-9)) {
      break
    }

    if (
      nextHit &&
      nextHit.time <= endTime + 1e-9 &&
      Math.abs(nextHit.time - nextEventTime) < 1e-9
    ) {
      advanceTo(nextHit.time)
      hitsProcessed++

      // Direct kit reaction hits (Ineffa DirectLunarCharged, etc.)
      if (nextHit.directReaction) {
        const reaction = nextHit.directReaction as ReactionId
        events.push({
          time: nextHit.time,
          reaction,
          triggerElement: nextHit.element ?? 'direct',
          auraElement: null,
          characterId: nextHit.characterId,
          placementId: nextHit.placementId,
          actionId: nextHit.actionId,
          note: nextHit.abil ?? 'direct reaction',
        })
        bumpCount(reactionCounts, reaction)
        hitIdx++
        continue
      }

      const element = normalizeElement(nextHit.element)
      if (!element || nextHit.gaugeUnits <= 0) {
        hitIdx++
        continue
      }

      if (!shouldApplyByIcd(icd, nextHit.characterId, nextHit)) {
        skippedByIcd++
        hitIdx++
        continue
      }

      bumpCount(applicationCounts, element)

      // Anemo / Geo: swirl / crystallize only — flash on marker, no lasting aura
      if (element === 'Anemo' || element === 'Geo') {
        const outcome = resolveReaction(
          auras,
          element,
          nextHit.gaugeUnits,
          opts,
        )
        if (outcome) {
          if (outcome.auraConsume > 0) {
            consumeAura(auras, outcome.auraElement, outcome.auraConsume)
          }
          events.push({
            time: nextHit.time,
            reaction: outcome.reaction,
            triggerElement: element,
            auraElement: outcome.auraElement,
            characterId: nextHit.characterId,
            placementId: nextHit.placementId,
            actionId: nextHit.actionId,
          })
          bumpCount(reactionCounts, outcome.reaction)
          noteFlashTransition(nextHit.time, element as AuraElement)
        }
        hitIdx++
        continue
      }

      const outcome = resolveReaction(
        auras,
        element,
        nextHit.gaugeUnits,
        opts,
      )

      if (outcome) {
        const before = findAura(auras, outcome.auraElement)?.gauge ?? 0
        let consumed = 0
        if (outcome.auraConsume > 0) {
          consumed = consumeAura(
            auras,
            outcome.auraElement,
            outcome.auraConsume,
          )
        }
        if (outcome.coexistence) {
          applyCoexistence(
            auras,
            element,
            nextHit.gaugeUnits,
            outcome.reaction,
          )
        } else if (
          outcome.reaction === 'aggravate' ||
          outcome.reaction === 'spread'
        ) {
          // additive reactions — no gauge change
        } else if (
          outcome.auraConsume > 0 &&
          consumed + 0.01 < outcome.auraConsume
        ) {
          const ratio = before / Math.max(outcome.auraConsume, 0.01)
          const left = nextHit.gaugeUnits * (1 - Math.min(1, ratio))
          if (left > 0.05) applyAura(auras, element as AuraElement, left)
        }

        events.push({
          time: nextHit.time,
          reaction: outcome.reaction,
          triggerElement: element,
          auraElement: outcome.auraElement,
          characterId: nextHit.characterId,
          placementId: nextHit.placementId,
          actionId: nextHit.actionId,
        })
        bumpCount(reactionCounts, outcome.reaction)

        if (
          (outcome.reaction === 'electro-charged' ||
            outcome.reaction === 'lunar-charged') &&
          hasAura(auras, 'Hydro') &&
          hasAura(auras, 'Electro')
        ) {
          ecTick.time = nextHit.time
        }
      } else {
        applyAura(auras, element as AuraElement, nextHit.gaugeUnits)
      }

      noteTransition(nextHit.time)
      hitIdx++
    } else {
      if (nextEventTime <= time + 1e-12) break
      advanceTo(nextEventTime)
      const last = auraTimeline[auraTimeline.length - 1]
      const snap = snapshot(roundTime(time), auras)
      if (
        !last ||
        last.auras.length !== snap.auras.length ||
        last.auras.some(
          (a, i) =>
            a.element !== snap.auras[i]?.element ||
            Math.abs(a.gauge - (snap.auras[i]?.gauge ?? 0)) > 0.05,
        )
      ) {
        auraTimeline.push(snap)
      }
    }
  }

  return {
    events,
    auraTimeline,
    transitions,
    reactionCounts,
    applicationCounts,
    skippedByIcd,
    hitsProcessed,
  }
}

export function formatReactionLabel(id: string): string {
  const labels: Record<string, string> = {
    melt: 'Melt',
    vaporize: 'Vaporize',
    overload: 'Overload',
    superconduct: 'Superconduct',
    'electro-charged': 'Electro-Charged',
    'lunar-charged': 'Lunar-Charged',
    freeze: 'Freeze',
    swirl: 'Swirl',
    crystallize: 'Crystallize',
    burning: 'Burning',
    bloom: 'Bloom',
    'lunar-bloom': 'Lunar-Bloom',
    quicken: 'Quicken',
    aggravate: 'Aggravate',
    spread: 'Spread',
    shatter: 'Shatter',
  }
  return labels[id] ?? id
}

/** Compact labels for timeline chips. */
export function formatReactionShortLabel(id: string): string {
  const labels: Record<string, string> = {
    melt: 'Melt',
    vaporize: 'Vape',
    overload: 'OL',
    superconduct: 'SC',
    'electro-charged': 'EC',
    'lunar-charged': 'LC',
    freeze: 'Frz',
    swirl: 'Swirl',
    crystallize: 'Cry',
    burning: 'Burn',
    bloom: 'Bloom',
    'lunar-bloom': 'LB',
    quicken: 'Qkn',
    aggravate: 'Agg',
    spread: 'Spr',
    shatter: 'Shat',
  }
  return labels[id] ?? formatReactionLabel(id)
}

/** Accent color for reaction timeline chips. */
export function reactionAccentColor(id: string): string {
  const colors: Record<string, string> = {
    melt: 'rgba(230, 110, 70, 0.92)',
    vaporize: 'rgba(90, 150, 230, 0.92)',
    overload: 'rgba(210, 90, 70, 0.92)',
    superconduct: 'rgba(130, 160, 230, 0.92)',
    'electro-charged': 'rgba(160, 110, 230, 0.92)',
    'lunar-charged': 'rgba(150, 130, 240, 0.95)',
    freeze: 'rgba(150, 210, 240, 0.92)',
    swirl: 'rgba(110, 200, 180, 0.92)',
    crystallize: 'rgba(210, 170, 80, 0.92)',
    burning: 'rgba(220, 100, 50, 0.92)',
    bloom: 'rgba(100, 180, 90, 0.92)',
    'lunar-bloom': 'rgba(80, 170, 120, 0.95)',
    quicken: 'rgba(140, 200, 100, 0.92)',
    aggravate: 'rgba(170, 130, 230, 0.92)',
    spread: 'rgba(120, 190, 90, 0.92)',
    shatter: 'rgba(180, 210, 230, 0.92)',
  }
  return colors[id] ?? 'rgba(180, 180, 180, 0.9)'
}
