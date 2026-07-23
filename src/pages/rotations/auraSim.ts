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
  /** Aura elements present after the change (empty = cleared). */
  auras: Array<{ element: AuraElement; gauge: number }>
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
  for (const a of auras) {
    a.gauge = Math.max(0, a.gauge - a.decayPerSec * dt)
  }
  // drop emptied
  for (let i = auras.length - 1; i >= 0; i--) {
    if (auras[i].gauge < 0.01) auras.splice(i, 1)
  }
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
    // Refresh / add gauge (cap roughly at taxed amount if already higher)
    existing.gauge = Math.max(existing.gauge, taxed) + Math.min(taxed, 0.4)
    existing.decayPerSec = Math.max(existing.decayPerSec, decayPerSec)
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

  // 2.5s (or group reset) since last successful application → apply + reset sequence
  if (!existing || hit.time - existing.windowStart >= reset) {
    icd.set(key, { windowStart: hit.time, index: 1 })
    return true
  }

  const applies = seq[existing.index % seq.length] !== 0
  existing.index += 1
  if (applies) existing.windowStart = hit.time
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

  auraTimeline.push(snapshot(0, auras))

  const advanceTo = (target: number) => {
    const dt = target - time
    if (dt > 0) {
      // EC ticks while both auras present during [time, target]
      if (hasAura(auras, 'Hydro') && hasAura(auras, 'Electro')) {
        // decay in small steps with ticks
        let cursor = time
        while (cursor < target - 1e-9) {
          const nextTickAt = ecTick.time + EC_TICK_INTERVAL
          const stepTo = Math.min(target, nextTickAt)
          decayAuras(auras, stepTo - cursor)
          noteTransition(stepTo)
          cursor = stepTo
          if (
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
              time: roundTime(cursor),
              reaction,
              triggerElement: 'tick',
              auraElement: 'Hydro+Electro',
              characterId: '',
              actionId: 'ec-tick',
              note: 'aura tick',
            })
            bumpCount(reactionCounts, reaction)
            ecTick.time = cursor
          }
        }
      } else {
        decayAuras(auras, dt)
        noteTransition(target)
        ecTick.time = target - EC_TICK_INTERVAL
      }
      time = target
    }
  }

  while (hitIdx < hits.length || time < endTime - 1e-9) {
    const nextHit = hits[hitIdx]
    const nextSample =
      Math.floor(time / sampleInterval + 1e-9) * sampleInterval + sampleInterval
    let nextEventTime = Math.min(nextSample, endTime)
    if (nextHit && nextHit.time <= endTime + 1e-9) {
      nextEventTime = Math.min(nextEventTime, nextHit.time)
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
