import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
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

export interface WishPlannerInputs {
  pity: string
  setPity: Dispatch<SetStateAction<string>>
  savedPulls: string
  setSavedPulls: Dispatch<SetStateAction<string>>
  primos: string
  setPrimos: Dispatch<SetStateAction<string>>
  guaranteed: boolean
  setGuaranteed: Dispatch<SetStateAction<boolean>>
  clampedPity: number
  safeSaved: number
  safePrimos: number
  pullsFromSavedPrimos: number
  totalPulls: number
  remainingToHard: number
  progress: number
  primosPerPull: number
}

const WishPlannerInputsContext = createContext<WishPlannerInputs | null>(null)

export function WishPlannerInputsProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  )

  return (
    <WishPlannerInputsContext.Provider value={value}>
      {children}
    </WishPlannerInputsContext.Provider>
  )
}

/** Shared pity / fates / primos / guarantee — must be under WishPlannerInputsProvider. */
export function useWishPlannerInputs(): WishPlannerInputs {
  const ctx = useContext(WishPlannerInputsContext)
  if (!ctx) {
    throw new Error('useWishPlannerInputs must be used within WishPlannerInputsProvider')
  }
  return ctx
}
