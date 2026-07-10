/** Artifact piece slots. */
export type Slot = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'

/**
 * Main and substat identifiers.
 * Flat HP/ATK are flower/plume mains; percent and combat stats appear elsewhere.
 */
export type Stat =
  | 'hp'
  | 'atk'
  | 'def'
  | 'hpPercent'
  | 'atkPercent'
  | 'defPercent'
  | 'energyRecharge'
  | 'elementalMastery'
  | 'critRate'
  | 'critDamage'
  | 'healingBonus'
  | 'pyroDamage'
  | 'electroDamage'
  | 'cryoDamage'
  | 'hydroDamage'
  | 'dendroDamage'
  | 'anemoDamage'
  | 'geoDamage'
  | 'physicalDamage'

/** Criteria for a desired artifact drop. */
export interface ArtifactTarget {
  /** Probability the drop is the desired set (default 0.5 for a two-set domain). */
  setChance?: number
  slot: Slot
  mainStat: Stat
  /** Substats that must all appear among the artifact's four lines. */
  requiredSubstats?: Stat[]
}

/** Probability breakdown for one 5★ artifact matching the target. */
export interface ArtifactProbability {
  set: number
  slot: number
  mainStat: number
  substats: number
  /** Product of the factors above. */
  total: number
}

/** Resin / run estimates derived from match probability. */
export interface ResinEstimate {
  probabilityPerArtifact: number
  /** Expected matching 5★ artifacts per 20-resin domain run. */
  expectedMatchesPerRun: number
  /** Expected resin to get one matching artifact. */
  expectedResin: number
  /** Resin needed so cumulative chance of ≥1 match reaches `confidence` (0–1). */
  resinForConfidence: (confidence: number) => number
}
