import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useLocalStorage } from './useLocalStorage.ts'
import {
  MAIN_STAT_RATES,
  type ArtifactTarget,
  type Slot,
  type Stat,
  type SubstatMode,
} from '../model'

function mainStatsForSlot(slot: Slot): Stat[] {
  return Object.keys(MAIN_STAT_RATES[slot]) as Stat[]
}

export interface ArtifactTargetContextValue {
  slot: Slot
  mainStat: Stat
  availableMains: Stat[]
  requiredSubstats: Stat[]
  substatMode: SubstatMode
  setSubstatMode: (mode: SubstatMode) => void
  onSetOnly: boolean
  setOnSetOnly: (value: boolean) => void
  target: ArtifactTarget
  handleSlotChange: (next: Slot) => void
  handleMainChange: (next: Stat) => void
  toggleSubstat: (stat: Stat) => void
}

const ArtifactTargetContext = createContext<ArtifactTargetContextValue | null>(null)

export function ArtifactTargetProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useLocalStorage<Slot>('gc:artifacts:slot', 'circlet')
  const availableMains = mainStatsForSlot(slot)
  const [mainStat, setMainStat] = useLocalStorage<Stat>(
    'gc:artifacts:mainStat',
    availableMains[0] ?? 'critRate',
  )
  const [requiredSubstats, setRequiredSubstats] = useLocalStorage<Stat[]>(
    'gc:artifacts:requiredSubstats',
    [],
  )
  const [substatMode, setSubstatMode] = useLocalStorage<SubstatMode>(
    'gc:artifacts:substatMode',
    'all',
  )
  const [onSetOnly, setOnSetOnly] = useLocalStorage('gc:artifacts:onSetOnly', true)

  const resolvedMain = availableMains.includes(mainStat)
    ? mainStat
    : (availableMains[0] ?? 'hp')

  const target = useMemo(
    () => ({
      setChance: onSetOnly ? 0.5 : 1,
      slot,
      mainStat: resolvedMain,
      requiredSubstats,
      substatMode,
    }),
    [onSetOnly, slot, resolvedMain, requiredSubstats, substatMode],
  )

  const handleSlotChange = useCallback(
    (next: Slot) => {
      setSlot(next)
      const mains = mainStatsForSlot(next)
      const nextMain = mains.includes(mainStat) ? mainStat : mains[0]
      setMainStat(nextMain)
      setRequiredSubstats((prev) => prev.filter((s) => s !== nextMain))
    },
    [mainStat, setSlot, setMainStat, setRequiredSubstats],
  )

  const handleMainChange = useCallback(
    (next: Stat) => {
      setMainStat(next)
      setRequiredSubstats((prev) => prev.filter((s) => s !== next))
    },
    [setMainStat, setRequiredSubstats],
  )

  const toggleSubstat = useCallback(
    (stat: Stat) => {
      setRequiredSubstats((prev) => {
        if (prev.includes(stat)) return prev.filter((s) => s !== stat)
        if (prev.length >= 4) return prev
        return [...prev, stat]
      })
    },
    [setRequiredSubstats],
  )

  const value = useMemo(
    () => ({
      slot,
      mainStat: resolvedMain,
      availableMains,
      requiredSubstats,
      substatMode,
      setSubstatMode,
      onSetOnly,
      setOnSetOnly,
      target,
      handleSlotChange,
      handleMainChange,
      toggleSubstat,
    }),
    [
      slot,
      resolvedMain,
      availableMains,
      requiredSubstats,
      substatMode,
      setSubstatMode,
      onSetOnly,
      setOnSetOnly,
      target,
      handleSlotChange,
      handleMainChange,
      toggleSubstat,
    ],
  )

  return (
    <ArtifactTargetContext.Provider value={value}>{children}</ArtifactTargetContext.Provider>
  )
}

/** Shared artifact target — must be used under ArtifactTargetProvider. */
export function useArtifactTarget(): ArtifactTargetContextValue {
  const ctx = useContext(ArtifactTargetContext)
  if (!ctx) {
    throw new Error('useArtifactTarget must be used within ArtifactTargetProvider')
  }
  return ctx
}
