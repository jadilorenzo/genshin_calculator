import { useLocalStorage } from './useLocalStorage.ts'
import {
  HARD_PITY,
  PRIMOS_PER_PULL,
  pullsFromPrimos,
  totalPullsAvailable,
} from '../model/wishes.ts'

function parseNonNegInt(raw: string, fallback = 0): number {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

/** Shared pity / fates / primos / guarantee state for pull routes. */
export function useWishPlannerInputs() {
  const [pity, setPity] = useLocalStorage('gc:pulls:pity', '0')
  const [savedPulls, setSavedPulls] = useLocalStorage('gc:pulls:savedPulls', '0')
  const [primos, setPrimos] = useLocalStorage('gc:pulls:primos', '0')
  const [guaranteed, setGuaranteed] = useLocalStorage('gc:pulls:guaranteed', false)

  const clampedPity = Math.min(HARD_PITY - 1, parseNonNegInt(pity))
  const safeSaved = parseNonNegInt(savedPulls)
  const safePrimos = parseNonNegInt(primos)
  const pullsFromSavedPrimos = pullsFromPrimos(safePrimos)
  const totalPulls = totalPullsAvailable(safeSaved, safePrimos)
  const remainingToHard = HARD_PITY - clampedPity
  const progress = clampedPity / HARD_PITY

  return {
    pity,
    setPity,
    savedPulls,
    setSavedPulls,
    primos,
    setPrimos,
    guaranteed,
    setGuaranteed,
    clampedPity,
    safeSaved,
    safePrimos,
    pullsFromSavedPrimos,
    totalPulls,
    remainingToHard,
    progress,
    primosPerPull: PRIMOS_PER_PULL,
  }
}
