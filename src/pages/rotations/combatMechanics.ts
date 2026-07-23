/**
 * Types for src/data/combatMechanics.json (gcsim ICD / resources / kit hints).
 */
export type IcdGroupDef = {
  resetSeconds: number | null
  gaugeSequence: number[] | null
  note?: string
}

export type ElementApp = {
  abil: string | null
  sourceFile: string
  attackTag: string | null
  icdTag: string | null
  icdGroup: string | null
  element: string | null
  elementDynamic?: boolean
  durability: number | null
  /** durability / 25 — gcsim 25 ≈ 1U */
  gaugeUnits: number | null
}

export type NightsoulResource = {
  maxPoints: number | null
  maxPointsVariants?: number[]
  timedBlessings?: Array<{
    enterPoints: number | null
    durationFrames: number | null
    durationSeconds: number | null
    source?: string
  }>
  pointConsumes?: number[]
  periodicDrainHints?: Array<{ amount: number; note?: string }>
}

export type VerdantDewResource = {
  consumes?: Array<{
    amount: number
    frame: number | null
    seconds: number | null
    sourceFile: string
  }>
  rateMods?: Array<{ durationFrames: number | null; note?: string }>
  usesTeamVerdantDew?: boolean
}

export type CombatCharacterMechanics = {
  id: string
  name: string
  element: string
  gcsimPackage: string | null
  gcsimPr?: { number: number | null; repo: string | null; branch: string | null }
  elementApps: ElementApp[]
  resources?: {
    nightsoul?: NightsoulResource
    verdantDew?: VerdantDewResource
    moonsignContribution?: number
    moonsignAware?: boolean
    arkhe?: boolean
    sourcewaterDroplets?: boolean
    bondOfLife?: boolean
    dendroCore?: boolean
    dendroCoreInteract?: boolean
    usesVerdantDew?: boolean
  }
  kitHints?: {
    durations?: Array<{
      name: string
      source: string
      raw: number | string | null
      unit: string | null
      seconds: number
    }>
    attributes?: Array<{
      name: string
      source: string
      raw: number | string | null
      unit: string | null
    }>
  }
}

export type CombatMechanicsFile = {
  source: string
  extractedAt: string
  fps: number
  gcsimChars: string
  globals: {
    icdGroups: Record<string, IcdGroupDef>
    verdantDew: {
      max: number
      partialFramesPerDew: number | null
      secondsPerDew: number | null
      generationWindowFrames: number | null
      generationWindowSeconds: number | null
      note?: string
      sourceFile?: string
    }
    durabilityNote?: string
    meltNote?: string
  }
  stats: {
    characters: number
    withElementApps: number
    withNightsoul: number
    withVerdantDew: number
  }
  characters: Record<string, CombatCharacterMechanics>
}
