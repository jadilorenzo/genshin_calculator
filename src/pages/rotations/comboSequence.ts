/**
 * Fine combo sequence packing for the inspect timeline.
 * Durations come from characterAnimationTimings (cancel-into-next when available).
 */
import {
  framesToSeconds,
  getAnimationAction,
  getCharacterAnimationTimings,
} from './animationTimings'
import type { AnimationAction, AnimationCancelMap } from './animationTimingsTypes'
import {
  resolveSkillCasts,
  type SkillCastVariant,
  type TimingMode,
} from './fieldTimings'
import type { CastOrder, ComboStep, TimelinePlacement } from './types'

const FALLBACK_SECONDS = 0.5
const FPS = 60

export type PackedComboSegment = {
  stepId: string
  actionId: string
  stateId: string
  label: string
  kind: string
  start: number
  duration: number
  /** True when durationSeconds override is active on the step */
  durationOverridden: boolean
  incomplete: boolean
  gapAfter: number
}

export type PackedCombo = {
  segments: PackedComboSegment[]
  totalSeconds: number
}

const createStepId = () => `cs-${Math.random().toString(36).slice(2, 10)}`

export function createComboStep(
  actionId: string,
  stateId = 'default',
  gapAfter = 0,
): ComboStep {
  return {
    id: createStepId(),
    actionId,
    stateId,
    gapAfter: gapAfter > 0 ? gapAfter : undefined,
  }
}

export function sanitizeComboSteps(raw: unknown): ComboStep[] {
  if (!Array.isArray(raw)) return []
  const out: ComboStep[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const actionId = typeof e.actionId === 'string' ? e.actionId.trim() : ''
    if (!actionId) continue
    const stateId =
      typeof e.stateId === 'string' && e.stateId.trim()
        ? e.stateId.trim()
        : 'default'
    const id =
      typeof e.id === 'string' && e.id.trim() ? e.id.trim() : createStepId()
    const gapRaw =
      typeof e.gapAfter === 'number' ? e.gapAfter : Number(e.gapAfter)
    const gapAfter =
      Number.isFinite(gapRaw) && gapRaw > 0
        ? Math.min(10, Math.round(gapRaw * 100) / 100)
        : undefined
    const durRaw =
      typeof e.durationSeconds === 'number'
        ? e.durationSeconds
        : Number(e.durationSeconds)
    const durationSeconds =
      Number.isFinite(durRaw) && durRaw > 0
        ? Math.min(30, Math.round(durRaw * 1000) / 1000)
        : undefined
    out.push({ id, actionId, stateId, gapAfter, durationSeconds })
  }
  return out
}

/** Palette / strip family for coloring. */
export function comboActionFamily(kindOrId: string): string {
  const x = kindOrId.toLowerCase()
  if (/^na\d/.test(x) || x.startsWith('na_') || x === 'attack') return 'na'
  if (x === 'ca' || x.startsWith('ca_') || x.startsWith('aim') || x === 'charge')
    return 'ca'
  if (x === 'skill' || x.startsWith('skill')) return 'skill'
  if (x === 'burst' || x.startsWith('burst')) return 'burst'
  if (x === 'dash' || x.startsWith('dash')) return 'dash'
  return 'other'
}

/** Compact strip label (CA, N1, E, Q, …). */
export function shortActionLabel(label: string, kindOrId: string): string {
  const id = kindOrId.toLowerCase()
  const fam = comboActionFamily(kindOrId)
  if (fam === 'ca') {
    if (id.includes('phantasm')) return 'CA·P'
    if (id.includes('aim')) return 'Aim'
    return 'CA'
  }
  if (fam === 'na') {
    const m = id.match(/na[_-]?(\d+)/i) || label.match(/(\d+)/)
    return m ? `N${m[1]}` : 'NA'
  }
  if (fam === 'skill') {
    if (/expected on-field|full/i.test(label)) return 'Field'
    if (id.includes('spearstorm')) return 'E·S'
    if (id.includes('hold') || /hold|charge/i.test(label)) return 'E+'
    return 'E'
  }
  if (fam === 'burst') {
    if (id.includes('mini') || /symphony|mini/i.test(label)) return 'sQ'
    return 'Q'
  }
  if (fam === 'dash') return 'D'
  if (label.length <= 5) return label
  return label.slice(0, 4)
}

function isPaletteAction(action: AnimationAction): boolean {
  const id = action.id.toLowerCase()
  const kind = action.kind.toLowerCase()
  if (
    id === 'jump' ||
    id === 'swap' ||
    id === 'walk' ||
    id.startsWith('jump_') ||
    id.startsWith('swap_') ||
    id.startsWith('walk_') ||
    id.includes('plunge') ||
    kind.includes('plunge') ||
    kind === 'jump' ||
    kind === 'swap' ||
    kind === 'walk'
  ) {
    return false
  }
  return (
    /^na\d/.test(id) ||
    id.startsWith('na_') ||
    id === 'ca' ||
    id.startsWith('ca_') ||
    id.startsWith('aim') ||
    id === 'skill' ||
    id.startsWith('skill') ||
    id === 'burst' ||
    id.startsWith('burst') ||
    id === 'dash' ||
    id.startsWith('dash')
  )
}

/** Actions available in the inspect palette for a state. */
export function listPaletteActions(
  characterId: string,
  stateId = 'default',
): AnimationAction[] {
  const character = getCharacterAnimationTimings(characterId)
  if (!character) return []
  const state =
    character.states.find((s) => s.id === stateId) ?? character.states[0]
  if (!state) return []
  return state.actions.filter(isPaletteAction).sort((a, b) => {
    const fa = comboActionFamily(a.kind || a.id)
    const fb = comboActionFamily(b.kind || b.id)
    const order = ['na', 'ca', 'skill', 'burst', 'dash', 'other']
    const d = order.indexOf(fa) - order.indexOf(fb)
    if (d !== 0) return d
    return a.label.localeCompare(b.label)
  })
}

function cancelKeyForNext(next: AnimationAction | null): keyof AnimationCancelMap | null {
  if (!next) return null
  const fam = comboActionFamily(next.kind || next.id)
  if (fam === 'na') return 'attack'
  if (fam === 'ca') return 'charge'
  if (fam === 'skill') return 'skill'
  if (fam === 'burst') return 'burst'
  if (fam === 'dash') return 'dash'
  return null
}

function resolveStepDuration(
  action: AnimationAction | null,
  next: AnimationAction | null,
): { seconds: number; incomplete: boolean } {
  if (!action) return { seconds: FALLBACK_SECONDS, incomplete: true }
  const key = cancelKeyForNext(next)
  if (key && action.cancels) {
    const frames = action.cancels[key]
    if (typeof frames === 'number' && frames > 0) {
      return {
        seconds: framesToSeconds(frames, FPS) ?? frames / FPS,
        incomplete: false,
      }
    }
  }
  if (action.seconds != null && action.seconds > 0) {
    return { seconds: action.seconds, incomplete: false }
  }
  if (action.frames != null && action.frames > 0) {
    return {
      seconds: framesToSeconds(action.frames, FPS) ?? action.frames / FPS,
      incomplete: false,
    }
  }
  return { seconds: FALLBACK_SECONDS, incomplete: true }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Pack combo steps into non-overlapping timeline segments. */
export function packComboSteps(
  characterId: string,
  steps: ComboStep[],
): PackedCombo {
  const segments: PackedComboSegment[] = []
  let cursor = 0

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]
    const stateId = step.stateId || 'default'
    const action = getAnimationAction(characterId, step.actionId, stateId)
    const nextStep = steps[i + 1]
    const nextAction = nextStep
      ? getAnimationAction(
          characterId,
          nextStep.actionId,
          nextStep.stateId || 'default',
        )
      : null
    const { seconds, incomplete } = resolveStepDuration(action, nextAction)
    const overridden =
      typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    const duration = round(
      Math.max(0.05, overridden ? step.durationSeconds! : seconds),
    )
    segments.push({
      stepId: step.id,
      actionId: step.actionId,
      stateId,
      label: action?.label ?? step.actionId,
      kind: action?.kind ?? comboActionFamily(step.actionId),
      start: cursor,
      duration,
      durationOverridden: overridden,
      incomplete: overridden ? false : incomplete,
      gapAfter: 0,
    })
    cursor = round(cursor + duration)

    const gap =
      typeof step.gapAfter === 'number' && step.gapAfter > 0 ? step.gapAfter : 0
    if (gap > 0) {
      segments[segments.length - 1].gapAfter = round(gap)
      cursor = round(cursor + gap)
    }
  }

  return { segments, totalSeconds: round(cursor) }
}

function skillActionId(
  characterId: string,
  skillVariant: SkillCastVariant,
): string {
  if (skillVariant === 'hold') {
    const hold = getAnimationAction(characterId, 'skill_hold', 'default')
    if (hold) return 'skill_hold'
  }
  return 'skill'
}

/**
 * Seed inspect steps from coarse Skill/Burst cast presets (E×N + Q order).
 */
export function seedComboStepsFromCasts(
  characterId: string,
  opts: {
    skill: boolean
    burst: boolean
    castOrder?: CastOrder
    skillVariant?: SkillCastVariant
    skillCasts?: number
    kitHoldSeconds?: number | null
  },
): ComboStep[] {
  const variant = opts.skillVariant ?? 'hold'
  const skillCasts = resolveSkillCasts(characterId, {
    skill: opts.skill,
    skillCasts: opts.skillCasts,
    skillVariant: variant,
    kitHoldSeconds: opts.kitHoldSeconds ?? null,
  })
  const skillId = skillActionId(characterId, variant)
  const steps: ComboStep[] = []
  const pushSkills = () => {
    for (let i = 0; i < skillCasts; i += 1) {
      steps.push(createComboStep(skillId, 'default'))
    }
  }
  const pushBurst = () => {
    if (opts.burst) steps.push(createComboStep('burst', 'default'))
  }
  if ((opts.castOrder ?? 'skill-first') === 'burst-first') {
    pushBurst()
    pushSkills()
  } else {
    pushSkills()
    pushBurst()
  }
  return steps
}

/** Total packed seconds for a placement's inspect sequence (0 if empty). */
export function comboStepsTotalSeconds(
  characterId: string,
  steps: ComboStep[] | null | undefined,
): number {
  if (!steps?.length) return 0
  return packComboSteps(characterId, steps).totalSeconds
}

export function placementUsesComboSteps(
  placement: Pick<TimelinePlacement, 'comboSteps'>,
): boolean {
  return Array.isArray(placement.comboSteps) && placement.comboSteps.length > 0
}

/** Cast opts helper type re-export for seed callers. */
export type SeedCastOpts = {
  skill: boolean
  burst: boolean
  castOrder?: CastOrder
  mode?: TimingMode
  humanLag?: number
  skillVariant?: SkillCastVariant
  skillCasts?: number
  kitHoldSeconds?: number | null
}
