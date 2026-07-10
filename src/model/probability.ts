import {
  DOMAIN_FIVE_STAR_PER_RUN,
  MAIN_STAT_RATES,
  RESIN_PER_RUN,
  SLOT_CHANCE,
} from './rates'
import { probabilityOfRequiredSubstats } from './substats'
import type { ArtifactProbability, ArtifactTarget, ResinEstimate } from './types'

const DEFAULT_SET_CHANCE = 0.5

export function artifactProbability(target: ArtifactTarget): ArtifactProbability {
  const set = target.setChance ?? DEFAULT_SET_CHANCE
  const slot = SLOT_CHANCE
  const mainStat = MAIN_STAT_RATES[target.slot][target.mainStat] ?? 0
  const substats = probabilityOfRequiredSubstats(
    target.mainStat,
    target.requiredSubstats ?? [],
  )
  return {
    set,
    slot,
    mainStat,
    substats,
    total: set * slot * mainStat * substats,
  }
}

/**
 * Converts match probability into expected resin and confidence-based resin.
 * Uses AR45 domain average 5★ drops per run.
 */
export function estimateResin(target: ArtifactTarget): ResinEstimate {
  const { total: probabilityPerArtifact } = artifactProbability(target)
  const expectedMatchesPerRun = DOMAIN_FIVE_STAR_PER_RUN * probabilityPerArtifact
  const expectedResin =
    expectedMatchesPerRun === 0
      ? Number.POSITIVE_INFINITY
      : RESIN_PER_RUN / expectedMatchesPerRun

  return {
    probabilityPerArtifact,
    expectedMatchesPerRun,
    expectedResin,
    resinForConfidence(confidence: number): number {
      if (!(confidence > 0 && confidence < 1)) {
        throw new Error('confidence must be between 0 and 1 (exclusive)')
      }
      if (probabilityPerArtifact <= 0) return Number.POSITIVE_INFINITY
      // Artifacts needed so 1 - (1-p)^n >= confidence
      const artifactsNeeded = Math.log(1 - confidence) / Math.log(1 - probabilityPerArtifact)
      return (artifactsNeeded / DOMAIN_FIVE_STAR_PER_RUN) * RESIN_PER_RUN
    },
  }
}
