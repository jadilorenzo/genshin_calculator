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
  defaultOnFieldDuration,
  isComboFieldStyle,
  resolveSkillCasts,
  type SkillCastVariant,
  type TimingMode,
} from './fieldTimings'
import type { CastOrder, ComboStep, TimelinePlacement } from './types'

const FALLBACK_SECONDS = 0.5
const FPS = 60
/** Synthetic filler block for general NA time (duration meant to be edited). */
export const NORMALS_ACTION_ID = 'normals'
export const NORMALS_DEFAULT_SECONDS = 1.5

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
  /** Cancel mode used for this segment. */
  cancelMode: 'auto' | 'full'
  /** Full animation length before cancel (seconds), when known. */
  fullDuration: number | null
  /**
   * When duration used cancel frames into the next action, the cancel key
   * (charge, dash, jump, …). Null when full anim / override / no cancel.
   */
  cancelledInto: keyof AnimationCancelMap | null
  /** True when cancel frames exist into the following step. */
  canCancel: boolean
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
  durationSeconds?: number,
  cancelMode?: 'auto' | 'full',
): ComboStep {
  const isNormals = actionId === NORMALS_ACTION_ID
  const duration =
    durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : isNormals
        ? NORMALS_DEFAULT_SECONDS
        : undefined
  return {
    id: createStepId(),
    actionId,
    stateId,
    gapAfter: gapAfter > 0 ? gapAfter : undefined,
    durationSeconds: duration,
    cancelMode: cancelMode === 'full' ? 'full' : undefined,
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
    const cancelMode = e.cancelMode === 'full' ? 'full' : undefined
    out.push({ id, actionId, stateId, gapAfter, durationSeconds, cancelMode })
  }
  return out
}

/** Palette / strip family for coloring. */
export function comboActionFamily(kindOrId: string): string {
  const x = kindOrId.toLowerCase()
  if (
    x === NORMALS_ACTION_ID ||
    /^na\d/.test(x) ||
    x.startsWith('na_') ||
    x === 'attack'
  ) {
    return 'na'
  }
  if (x === 'ca' || x.startsWith('ca_') || x.startsWith('aim') || x === 'charge')
    return 'ca'
  if (x === 'skill' || x.startsWith('skill')) return 'skill'
  if (x === 'burst' || x.startsWith('burst')) return 'burst'
  if (x === 'dash' || x.startsWith('dash')) return 'dash'
  if (x === 'jump' || x.startsWith('jump')) return 'jump'
  return 'other'
}

/** Compact strip label (CA, N1, E, Q, …). */
export function shortActionLabel(label: string, kindOrId: string): string {
  const id = kindOrId.toLowerCase()
  const fam = comboActionFamily(kindOrId)
  if (id === NORMALS_ACTION_ID || /normals/i.test(label)) return 'NA'
  if (fam === 'ca') {
    if (id.includes('phantasm')) return 'CA·P'
    if (id.includes('aim')) return 'Aim'
    if (id.includes('bikechargefinal') || /final/i.test(label)) return 'F'
    if (id.includes('ca_cycle') || /cycle|donut|spin/i.test(label)) return 'C'
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
  if (fam === 'jump' || id.includes('jump')) return 'J'
  if (label.length <= 5) return label
  return label.slice(0, 4)
}

function isIndividualNormal(action: AnimationAction): boolean {
  const id = action.id.toLowerCase()
  return /^na\d/.test(id) || id.startsWith('na_')
}

/** Individual NAs + charged / special CA variants for the attack-string fold. */
export function isAttackStringAction(action: AnimationAction): boolean {
  const id = action.id.toLowerCase()
  if (isIndividualNormal(action)) return true
  if (id === 'ca' || id.startsWith('ca_') || id.startsWith('aim')) return true
  return comboActionFamily(action.kind || action.id) === 'ca'
}

function isExcludedMovementAction(action: AnimationAction): boolean {
  const id = action.id.toLowerCase()
  const kind = action.kind.toLowerCase()
  // Jump / dash are allowed — used as animation cancels in combos (Mavuika C4 J C4F).
  return (
    id === 'swap' ||
    id === 'walk' ||
    id.startsWith('swap_') ||
    id.startsWith('walk_') ||
    id.includes('plunge') ||
    kind.includes('plunge') ||
    kind === 'swap' ||
    kind === 'walk'
  )
}

/** Skill / burst / dash / jump chips (attack string lives in its own fold). */
function isAbilityPaletteAction(action: AnimationAction): boolean {
  if (isExcludedMovementAction(action)) return false
  if (isAttackStringAction(action)) return false
  const id = action.id.toLowerCase()
  return (
    id === 'skill' ||
    id.startsWith('skill') ||
    id === 'burst' ||
    id.startsWith('burst') ||
    id === 'dash' ||
    id.startsWith('dash') ||
    id === 'jump' ||
    id.startsWith('jump') ||
    action.kind === 'jump'
  )
}

/** Synthetic Normals filler for the inspect palette. */
export function normalsPaletteAction(): AnimationAction {
  return {
    id: NORMALS_ACTION_ID,
    label: 'Normals (general)',
    kind: 'na',
    frames: Math.round(NORMALS_DEFAULT_SECONDS * FPS),
    seconds: NORMALS_DEFAULT_SECONDS,
    hitmarks: [],
    cancels: {},
    source: 'estimated',
    notes: 'General normal-attack filler — edit duration in the sequence',
  }
}

/**
 * Sequence gates: dependent abilities only appear in the inspect palette when
 * a required earlier step is already in the combo.
 *
 * Rules come from kit copy (“replaced with the special…”, “while X is active…”)
 * and animation notes. `requiresAny` — any one prior actionId unlocks it.
 */
type SequencePrereq = {
  /** Exact action id, or RegExp matched against action id. */
  action: string | RegExp
  requiresAny: string[]
  /** Limit the rule to these characters (omit = all). */
  characterIds?: string[]
}

const SEQUENCE_PREREQUISITES: SequencePrereq[] = [
  // —— Flins (kit): Manifest Flame E → Northland Spearstorm → Thunderous Symphony (sQ)
  {
    action: 'skill_spearstorm',
    requiresAny: ['skill'],
  },
  {
    action: 'burst_mini',
    requiresAny: ['skill_spearstorm'],
    characterIds: ['flins'],
  },

  // —— Freminet (kit): Pressurized Floe thrust → Pers Timer → Shattering Pressure
  {
    action: /^skill_skillpressureframes/,
    requiresAny: ['skill', 'skill_skillthrust'],
    characterIds: ['freminet'],
  },
  {
    action: 'skill_1',
    requiresAny: ['skill', 'skill_skillthrust'],
    characterIds: ['freminet'],
  },

  // —— Nefer (kit): Shadow Dance (E) + Verdant Dew → Phantasm Performance CA
  {
    action: 'ca_phantasm',
    requiresAny: ['skill'],
    characterIds: ['nefer'],
  },

  // —— Xianyun (kit): White Clouds at Dawn → up to 3 Skyladders
  {
    action: 'skill_skillleapframes_0',
    requiresAny: ['skill'],
    characterIds: ['xianyun'],
  },
  {
    action: 'skill_1',
    requiresAny: ['skill', 'skill_skillleapframes_0'],
    characterIds: ['xianyun'],
  },
  {
    action: 'skill_skillleapframes_1',
    requiresAny: ['skill_skillleapframes_0', 'skill_1', 'skill'],
    characterIds: ['xianyun'],
  },
  {
    action: 'skill_2',
    requiresAny: ['skill_1', 'skill_skillleapframes_1'],
    characterIds: ['xianyun'],
  },
  {
    action: 'skill_skillleapframes_2',
    requiresAny: ['skill_skillleapframes_1', 'skill_2'],
    characterIds: ['xianyun'],
  },

  // —— Varesa: Fiery Passion forms (skill-state / enhanced E & CA)
  {
    action: 'skill_fieryskill',
    requiresAny: ['skill'],
    characterIds: ['varesa'],
  },
  {
    action: 'ca_fierycharge',
    requiresAny: ['skill'],
    characterIds: ['varesa'],
  },

  // —— Heizou: skill end cancel after casting / holding E
  {
    action: 'skill_skillend',
    requiresAny: ['skill', 'skill_hold'],
    characterIds: ['shikanoin-heizou'],
  },

  // —— Skill recasts (Keqing stiletto, Dehya field, Fischl Oz, Durin, Mavuika ring/bike, …)
  {
    action: /^skill_skillrecast/,
    requiresAny: ['skill', 'skill_hold', 'skill_press', 'skill_skillpress'],
  },
]

/** Infer gates from animation `notes` when no explicit rule matches. */
function prerequisitesFromActionNotes(
  actionId: string,
  notes: string | undefined,
): string[] | null {
  if (!notes) return null
  // e.g. Flins mini-burst notes already covered explicitly; keep for Varka / future
  if (
    /after using .{0,60}Spearstorm|after .{0,40}Northland Spearstorm/i.test(
      notes,
    )
  ) {
    return ['skill_spearstorm']
  }
  if (
    /while Manifest Flame|during Manifest Flame|Special E during Manifest/i.test(
      notes,
    )
  ) {
    return ['skill']
  }
  if (/Verdant Dew/i.test(notes) && actionId.startsWith('ca_')) {
    return ['skill']
  }
  if (/Special E during|during .{0,20}skill-state/i.test(notes)) {
    return ['skill']
  }
  return null
}

function prereqMatchesAction(rule: SequencePrereq, actionId: string): boolean {
  if (typeof rule.action === 'string') return rule.action === actionId
  return rule.action.test(actionId)
}

/** Prerequisite action ids for this ability, or null if always available. */
export function sequencePrerequisitesFor(
  characterId: string,
  actionId: string,
  notes?: string,
): string[] | null {
  for (const rule of SEQUENCE_PREREQUISITES) {
    if (rule.characterIds && !rule.characterIds.includes(characterId)) continue
    if (!prereqMatchesAction(rule, actionId)) continue
    return rule.requiresAny
  }
  return prerequisitesFromActionNotes(actionId, notes)
}

/** True when `actionId` may be placed after `priorSteps`. */
export function isActionUnlockedByPriorSteps(
  characterId: string,
  actionId: string,
  priorSteps: Array<Pick<ComboStep, 'actionId'>>,
  notes?: string,
): boolean {
  const required = sequencePrerequisitesFor(characterId, actionId, notes)
  if (!required || required.length === 0) return true
  const prior = new Set(priorSteps.map((s) => s.actionId))
  return required.some((id) => prior.has(id))
}

export type PaletteActionEntry = {
  action: AnimationAction
  /** True when prerequisites are not yet in the sequence. */
  locked: boolean
  /** Action ids that unlock this entry (any one). */
  requiresAny: string[] | null
  /** Other palette actions that list this action as a prerequisite. */
  unlocks: AnimationAction[]
}

function sortPaletteActions(actions: AnimationAction[]): AnimationAction[] {
  return [...actions].sort((a, b) => {
    const fa = comboActionFamily(a.kind || a.id)
    const fb = comboActionFamily(b.kind || b.id)
    const order = ['na', 'ca', 'skill', 'burst', 'dash', 'other']
    const d = order.indexOf(fa) - order.indexOf(fb)
    if (d !== 0) return d
    const naA = a.id.match(/^na_?(\d+)/i)
    const naB = b.id.match(/^na_?(\d+)/i)
    if (naA && naB) return Number(naA[1]) - Number(naB[1])
    if (a.id === 'ca' && b.id !== 'ca') return -1
    if (b.id === 'ca' && a.id !== 'ca') return 1
    return a.label.localeCompare(b.label)
  })
}

/** Compact label for a prerequisite action id (e.g. skill → E). */
export function prerequisiteShortLabel(
  characterId: string,
  actionId: string,
  stateId = 'default',
): string {
  const action = getAnimationAction(characterId, actionId, stateId)
  if (action) return shortActionLabel(action.label, action.kind || action.id)
  if (actionId === 'skill' || actionId === 'skill_hold' || actionId === 'skill_press') {
    return 'E'
  }
  if (actionId === 'burst') return 'Q'
  if (actionId === 'skill_spearstorm') return 'E·S'
  if (actionId === 'burst_mini') return 'sQ'
  return actionId.replace(/^skill_?/, 'E·').replace(/^burst_?/, 'Q·')
}

/**
 * Palette entries for a state, including locked (gated) abilities so the UI
 * can show what is waiting on a prior step.
 */
export function listPaletteEntries(
  characterId: string,
  stateId = 'default',
  priorSteps: Array<Pick<ComboStep, 'actionId'>> = [],
): PaletteActionEntry[] {
  const character = getCharacterAnimationTimings(characterId)
  if (!character) {
    return [
      {
        action: normalsPaletteAction(),
        locked: false,
        requiresAny: null,
        unlocks: [],
      },
    ]
  }
  const state =
    character.states.find((s) => s.id === stateId) ?? character.states[0]
  if (!state) {
    return [
      {
        action: normalsPaletteAction(),
        locked: false,
        requiresAny: null,
        unlocks: [],
      },
    ]
  }

  const palette = sortPaletteActions(
    state.actions.filter(
      (a) => isAbilityPaletteAction(a) || isAttackStringAction(a),
    ),
  )
  const entries: PaletteActionEntry[] = palette.map((action) => {
    const requiresAny = sequencePrerequisitesFor(
      characterId,
      action.id,
      action.notes,
    )
    const locked = !isActionUnlockedByPriorSteps(
      characterId,
      action.id,
      priorSteps,
      action.notes,
    )
    return {
      action,
      locked,
      requiresAny,
      unlocks: [],
    }
  })

  for (const entry of entries) {
    entry.unlocks = palette.filter((candidate) => {
      const req = sequencePrerequisitesFor(
        characterId,
        candidate.id,
        candidate.notes,
      )
      return Boolean(req?.includes(entry.action.id))
    })
  }

  return [
    {
      action: normalsPaletteAction(),
      locked: false,
      requiresAny: null,
      unlocks: [],
    },
    ...entries,
  ]
}

/** Actions available in the inspect palette for a state (excludes individual NAs). */
export function listPaletteActions(
  characterId: string,
  stateId = 'default',
  priorSteps: Array<Pick<ComboStep, 'actionId'>> = [],
): AnimationAction[] {
  return listPaletteEntries(characterId, stateId, priorSteps)
    .filter((e) => !e.locked)
    .map((e) => e.action)
}

function cancelKeyForNext(next: AnimationAction | null): keyof AnimationCancelMap | null {
  if (!next) return null
  const fam = comboActionFamily(next.kind || next.id)
  if (fam === 'na' || next.id === NORMALS_ACTION_ID) return 'attack'
  if (fam === 'ca') return 'charge'
  if (fam === 'skill') return 'skill'
  if (fam === 'burst') return 'burst'
  if (fam === 'dash') return 'dash'
  if (fam === 'jump') return 'jump'
  return null
}

function fullActionSeconds(action: AnimationAction): number | null {
  if (action.seconds != null && action.seconds > 0) return action.seconds
  if (action.frames != null && action.frames > 0) {
    return framesToSeconds(action.frames, FPS) ?? action.frames / FPS
  }
  return null
}

/**
 * Cancel frames into `next`, or spin-cycle length for consecutive donut CAs.
 */
export function cancelFramesIntoNext(
  action: AnimationAction,
  next: AnimationAction | null,
): { key: keyof AnimationCancelMap; frames: number } | null {
  const key = cancelKeyForNext(next)
  if (!key) return null
  const mapped = action.cancels?.[key]
  if (typeof mapped === 'number' && mapped > 0) {
    return { key, frames: mapped }
  }
  // Flamestrider CA cycle → next CA: one spin worth of frames.
  if (
    key === 'charge' &&
    typeof action.spinFrames === 'number' &&
    action.spinFrames > 0 &&
    /ca_cycle|cycle|donut|spin/i.test(action.id)
  ) {
    return { key, frames: action.spinFrames }
  }
  return null
}

function resolveStepDuration(
  action: AnimationAction | null,
  next: AnimationAction | null,
  cancelMode: 'auto' | 'full' = 'auto',
): {
  seconds: number
  incomplete: boolean
  cancelledInto: keyof AnimationCancelMap | null
  fullDuration: number | null
} {
  if (!action) {
    return {
      seconds: FALLBACK_SECONDS,
      incomplete: true,
      cancelledInto: null,
      fullDuration: null,
    }
  }
  const full = fullActionSeconds(action)
  if (cancelMode !== 'full') {
    const cancel = cancelFramesIntoNext(action, next)
    if (cancel) {
      return {
        seconds: framesToSeconds(cancel.frames, FPS) ?? cancel.frames / FPS,
        incomplete: false,
        cancelledInto: cancel.key,
        fullDuration: full,
      }
    }
  }
  if (full != null) {
    return {
      seconds: full,
      incomplete: false,
      cancelledInto: null,
      fullDuration: full,
    }
  }
  return {
    seconds: FALLBACK_SECONDS,
    incomplete: true,
    cancelledInto: null,
    fullDuration: null,
  }
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
    const action =
      step.actionId === NORMALS_ACTION_ID
        ? null
        : getAnimationAction(characterId, step.actionId, stateId)
    const nextStep = steps[i + 1]
    const nextAction =
      nextStep && nextStep.actionId !== NORMALS_ACTION_ID
        ? getAnimationAction(
            characterId,
            nextStep.actionId,
            nextStep.stateId || 'default',
          )
        : null
    const isNormals = step.actionId === NORMALS_ACTION_ID
    const cancelMode = step.cancelMode === 'full' ? 'full' : 'auto'
    const canCancel =
      !isNormals &&
      Boolean(action && cancelFramesIntoNext(action, nextAction))
    const resolved = isNormals
      ? {
          seconds: step.durationSeconds ?? NORMALS_DEFAULT_SECONDS,
          incomplete: false,
          cancelledInto: null as keyof AnimationCancelMap | null,
          fullDuration: null as number | null,
        }
      : resolveStepDuration(action, nextAction, cancelMode)
    const overridden =
      typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    const duration = round(
      Math.max(
        0.05,
        overridden ? step.durationSeconds! : resolved.seconds,
      ),
    )
    segments.push({
      stepId: step.id,
      actionId: step.actionId,
      stateId,
      label: isNormals
        ? 'Normals'
        : (action?.label ?? step.actionId),
      kind: isNormals
        ? 'na'
        : (action?.kind ?? comboActionFamily(step.actionId)),
      start: cursor,
      duration,
      durationOverridden: overridden || isNormals,
      incomplete: overridden || isNormals ? false : resolved.incomplete,
      gapAfter: 0,
      cancelMode,
      fullDuration: resolved.fullDuration,
      cancelledInto: overridden ? null : resolved.cancelledInto,
      canCancel,
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
): string | null {
  // Combo DPS: never seed the coarse "expected on-field" skill blob from fieldTimings.
  if (isComboFieldStyle(characterId)) {
    const skill = getAnimationAction(characterId, 'skill', 'default')
    if (skill && skill.source === 'gcsim') return 'skill'
    // Prefer any real short skill variant over the estimated field window
    const hold = getAnimationAction(characterId, 'skill_hold', 'default')
    if (hold && hold.source === 'gcsim') return 'skill_hold'
    return null
  }
  if (skillVariant === 'hold') {
    const hold = getAnimationAction(characterId, 'skill_hold', 'default')
    if (hold) return 'skill_hold'
  }
  return 'skill'
}

function isGenericOnFieldSkillAction(
  characterId: string,
  actionId: string,
): boolean {
  if (!isComboFieldStyle(characterId)) return false
  const action = getAnimationAction(characterId, actionId, 'default')
  if (!action) return false
  return (
    action.source === 'estimated' &&
    /fieldTimings|coarse cast/i.test(action.notes ?? '')
  )
}

/**
 * Seed inspect steps from coarse Skill/Burst cast presets (E×N + Q order).
 * Excludes Normals filler and combo "expected on-field" generic windows.
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
    if (!skillId || skillCasts <= 0) return
    if (isGenericOnFieldSkillAction(characterId, skillId)) return
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

/**
 * Prefill inspect from cast options (E/Q order).
 * Always seeds relative cast actions — never Normals or expected-on-field filler.
 */
export function initialComboStepsForPlacement(
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
  if (!opts.skill && !opts.burst) return []
  return seedComboStepsFromCasts(characterId, opts)
}

/** Total packed seconds for a placement's inspect sequence (0 if empty). */
export function comboStepsTotalSeconds(
  characterId: string,
  steps: ComboStep[] | null | undefined,
): number {
  if (!steps?.length) return 0
  return packComboSteps(characterId, steps).totalSeconds
}

/**
 * On-field duration for a newly added character.
 * Supports: cast sum / seeded actions (e.g. Sucrose double E).
 * Combo DPS: short placeholder until actions are built (or Expected on-field is chosen).
 */
export function initialOnFieldDuration(
  characterId: string,
  opts: {
    skill: boolean
    burst: boolean
    mode?: TimingMode
    humanLag?: number
    skillVariant?: SkillCastVariant
    skillCasts?: number
    kitHoldSeconds?: number | null
  },
  comboSteps?: ComboStep[] | null,
): number {
  const kitHold = opts.kitHoldSeconds ?? null
  const fromActions = comboStepsTotalSeconds(characterId, comboSteps)
  if (fromActions > 0) return Math.max(0.5, fromActions)
  if (isComboFieldStyle(characterId, kitHold)) return 0.5
  return defaultOnFieldDuration(characterId, opts)
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
