import { useCallback, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import {
  clampTalentLevel,
  defaultPlan,
  EMPTY_FARMING_STATE,
  normalizePlan,
  type FarmingPlanEntry,
  type FarmingState,
  type TalentTargets,
} from './types'

export function useFarmingState() {
  const [state, setState] = useLocalStorage<FarmingState>(
    'gc:farming:state',
    EMPTY_FARMING_STATE,
  )

  const plans = useMemo(
    () => state.plans.map((plan) => normalizePlan(plan)),
    [state.plans],
  )

  const plannedIds = useMemo(
    () => new Set(plans.map((p) => p.characterId)),
    [plans],
  )

  const updatePlan = useCallback(
    (characterId: string, patch: Partial<FarmingPlanEntry>) => {
      setState((prev) => ({
        ...prev,
        plans: prev.plans.map((p) => {
          const base = normalizePlan(p)
          if (base.characterId !== characterId) return base
          const next = { ...base, ...patch }
          if (next.currentLevel > next.targetLevel) {
            next.targetLevel = next.currentLevel
          }
          return next
        }),
      }))
    },
    [setState],
  )

  const updateTalents = useCallback(
    (
      characterId: string,
      key: keyof TalentTargets,
      field: 'current' | 'target',
      value: number,
    ) => {
      setState((prev) => ({
        ...prev,
        plans: prev.plans.map((p) => {
          const base = normalizePlan(p)
          if (base.characterId !== characterId) return base
          const nextLevel = clampTalentLevel(value)
          const talents = {
            ...base.talents,
            [key]: { ...base.talents[key], [field]: nextLevel },
          }
          if (talents[key].current > talents[key].target) {
            if (field === 'current') talents[key].target = talents[key].current
            else talents[key].current = talents[key].target
          }
          return { ...base, talents }
        }),
      }))
    },
    [setState],
  )

  const applyTalentPreset = useCallback(
    (
      characterId: string,
      targets: { normal: number; skill: number; burst: number },
    ) => {
      setState((prev) => ({
        ...prev,
        plans: prev.plans.map((p) => {
          const base = normalizePlan(p)
          if (base.characterId !== characterId) return base
          return {
            ...base,
            talents: {
              normal: {
                current: Math.min(base.talents.normal.current, targets.normal),
                target: targets.normal,
              },
              skill: {
                current: Math.min(base.talents.skill.current, targets.skill),
                target: targets.skill,
              },
              burst: {
                current: Math.min(base.talents.burst.current, targets.burst),
                target: targets.burst,
              },
            },
          }
        }),
      }))
    },
    [setState],
  )

  const setOwned = useCallback(
    (name: string, value: number) => {
      const next = Math.max(0, Math.round(value) || 0)
      setState((prev) => {
        const checkedMaterials = { ...prev.checkedMaterials }
        if (checkedMaterials[name]) delete checkedMaterials[name]
        return {
          ...prev,
          inventory: { ...prev.inventory, [name]: next },
          checkedMaterials,
        }
      })
    },
    [setState],
  )

  const toggleMaterialChecked = useCallback(
    (name: string) => {
      setState((prev) => ({
        ...prev,
        checkedMaterials: {
          ...prev.checkedMaterials,
          [name]: !prev.checkedMaterials[name],
        },
      }))
    },
    [setState],
  )

  const addCharacter = useCallback(
    (characterId: string, plan?: FarmingPlanEntry) => {
      setState((prev) => {
        const normalized = prev.plans.map(normalizePlan)
        if (normalized.some((p) => p.characterId === characterId)) return prev
        return {
          ...prev,
          plans: [
            ...normalized,
            plan ? normalizePlan(plan) : defaultPlan(characterId),
          ],
        }
      })
    },
    [setState],
  )

  const removeCharacter = useCallback(
    (characterId: string) => {
      setState((prev) => ({
        ...prev,
        plans: prev.plans
          .map(normalizePlan)
          .filter((p) => p.characterId !== characterId),
      }))
    },
    [setState],
  )

  return {
    state,
    plans,
    plannedIds,
    updatePlan,
    updateTalents,
    applyTalentPreset,
    setOwned,
    toggleMaterialChecked,
    addCharacter,
    removeCharacter,
  }
}
