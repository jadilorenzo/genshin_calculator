import { describe, expect, it } from 'vitest'
import { matchElementApp } from './combatMechanicsData'
import { expandPlacementHits, isElementalApplicationHit } from './rotationHits'
import type { TimelinePlacement } from './types'

function placement(
  partial: Partial<TimelinePlacement> &
    Pick<TimelinePlacement, 'id' | 'characterId' | 'start'>,
): TimelinePlacement {
  return {
    duration: 12,
    castSkill: true,
    castBurst: false,
    castOrder: 'skill-first',
    skillVariant: 'press',
    skillCasts: 1,
    activeDurations: [],
    durationOverrides: {},
    comboSteps: [],
    ...partial,
  }
}

describe('infused NA elemental applications', () => {
  it('matches Physical Normal before Manifest Flame and Electro after', () => {
    const plain = matchElementApp('flins', 'na1', { infused: false })
    const infused = matchElementApp('flins', 'na1', { infused: true })
    expect(plain?.element).toBe('Physical')
    expect(infused?.element).toBe('Electro')
    expect(infused?.abil?.toLowerCase()).toMatch(/skill/)
  })

  it('prefers Northland Spearstorm for skill_spearstorm, not base skill', () => {
    const spear = matchElementApp('flins', 'skill_spearstorm')
    const base = matchElementApp('flins', 'skill')
    expect(spear?.abil).toMatch(/Spearstorm/i)
    expect(base?.abil?.toLowerCase()).not.toMatch(/spearstorm/)
  })

  it('emits Electro apps from Flins NAs after skill (and after Spearstorm)', () => {
    const hits = expandPlacementHits(
      placement({
        id: 'flins-1',
        characterId: 'flins',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
          {
            id: 'b',
            actionId: 'skill_spearstorm',
            stateId: 'default',
            gapAfter: 0,
          },
          { id: 'c', actionId: 'na1', stateId: 'default', gapAfter: 0 },
          { id: 'd', actionId: 'na2', stateId: 'default', gapAfter: 0 },
        ],
      }),
    )
    const naHits = hits.filter((h) => /^na\d/.test(h.actionId))
    expect(naHits.length).toBeGreaterThanOrEqual(2)
    expect(naHits.every((h) => h.element === 'Electro')).toBe(true)
    expect(naHits.every((h) => isElementalApplicationHit(h))).toBe(true)
  })

  it('emits Physical (non-elemental) NAs before Flins skill', () => {
    const hits = expandPlacementHits(
      placement({
        id: 'flins-2',
        characterId: 'flins',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'na1', stateId: 'default', gapAfter: 0 },
          { id: 'b', actionId: 'skill', stateId: 'default', gapAfter: 0 },
        ],
      }),
    )
    const firstNa = hits.find((h) => h.actionId === 'na1')
    expect(firstNa?.element).toBe('Physical')
    expect(isElementalApplicationHit(firstNa!)).toBe(false)
  })

  it('expands Normals filler into infused Electro apps during Manifest Flame', () => {
    const hits = expandPlacementHits(
      placement({
        id: 'flins-3',
        characterId: 'flins',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
          {
            id: 'b',
            actionId: 'skill_spearstorm',
            stateId: 'default',
            gapAfter: 0,
          },
          {
            id: 'c',
            actionId: 'normals',
            stateId: 'default',
            durationSeconds: 2.5,
            gapAfter: 0,
          },
        ],
      }),
    )
    const normalApps = hits.filter((h) => h.actionId === 'normals')
    expect(normalApps.length).toBeGreaterThanOrEqual(3)
    expect(normalApps.every((h) => h.element === 'Electro')).toBe(true)
    expect(normalApps.every((h) => isElementalApplicationHit(h))).toBe(true)
  })

  it('includes Flins Arcane Light initial skill as a 0U Electro application', () => {
    const hits = expandPlacementHits(
      placement({
        id: 'flins-4',
        characterId: 'flins',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
        ],
      }),
    )
    const skillHits = hits.filter((h) => h.actionId === 'skill')
    expect(skillHits).toHaveLength(1)
    expect(skillHits[0].element).toBe('Electro')
    expect(skillHits[0].gaugeUnits).toBe(0)
    expect(isElementalApplicationHit(skillHits[0])).toBe(true)

    const spear = expandPlacementHits(
      placement({
        id: 'flins-5',
        characterId: 'flins',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
          {
            id: 'b',
            actionId: 'skill_spearstorm',
            stateId: 'default',
            gapAfter: 0,
          },
        ],
      }),
    )
    const spearHits = spear.filter((h) => h.actionId === 'skill_spearstorm')
    expect(spearHits.some((h) => h.element === 'Electro' && h.gaugeUnits > 0)).toBe(
      true,
    )
  })
})
