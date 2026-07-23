import { describe, expect, it } from 'vitest'
import { hasSkillInfusedNormalApp, matchElementApp } from './combatMechanicsData'
import { simulateAura } from './auraSim'
import {
  expandPlacementHits,
  expandRotationHits,
  isElementalApplicationHit,
} from './rotationHits'
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

  it('emits Flamestrider Pyro NAs after Mavuika skill (not Physical)', () => {
    expect(hasSkillInfusedNormalApp('mavuika')).toBe(true)
    const plain = matchElementApp('mavuika', 'na1', { infused: false })
    const infused = matchElementApp('mavuika', 'na1', { infused: true })
    expect(plain?.element).toBe('Physical')
    expect(infused?.element).toBe('Pyro')
    expect(infused?.abil).toMatch(/Flamestrider/i)

    const hits = expandPlacementHits(
      placement({
        id: 'mav-1',
        characterId: 'mavuika',
        start: 0,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
          { id: 'b', actionId: 'na1', stateId: 'default', gapAfter: 0 },
          { id: 'c', actionId: 'na2', stateId: 'default', gapAfter: 0 },
          {
            id: 'd',
            actionId: 'ca_cycle',
            stateId: 'default',
            gapAfter: 0,
          },
        ],
      }),
    )
    const naHits = hits.filter((h) => /^na\d/.test(h.actionId))
    expect(naHits.length).toBeGreaterThanOrEqual(2)
    expect(naHits.every((h) => h.element === 'Pyro')).toBe(true)
    expect(naHits.every((h) => isElementalApplicationHit(h))).toBe(true)
    const ca = hits.find((h) => h.actionId === 'ca_cycle')
    expect(ca?.element).toBe('Pyro')
  })

  it('keeps Flamestrider CA Pyro on a later placement after early skill (tE → DPS)', () => {
    const bike = 'skill_state'
    const hits = expandRotationHits([
      placement({
        id: 'mav-te',
        characterId: 'mavuika',
        start: 0,
        duration: 0.5,
        comboSteps: [
          { id: 'a', actionId: 'skill', stateId: 'default', gapAfter: 0 },
        ],
      }),
      placement({
        id: 'mav-dps',
        characterId: 'mavuika',
        start: 8,
        duration: 10,
        castSkill: false,
        castBurst: true,
        comboSteps: [
          { id: 'q', actionId: 'burst', stateId: 'default', gapAfter: 0 },
          {
            id: 'c1',
            actionId: 'ca_cycle',
            stateId: bike,
            gapAfter: 0,
          },
          {
            id: 'c2',
            actionId: 'ca_cycle',
            stateId: bike,
            gapAfter: 0,
          },
          {
            id: 'f',
            actionId: 'ca_bikechargefinal',
            stateId: bike,
            gapAfter: 0,
          },
        ],
      }),
    ])
    const cycles = hits.filter((h) => h.actionId === 'ca_cycle')
    const fin = hits.find((h) => h.actionId === 'ca_bikechargefinal')
    expect(cycles.length).toBe(2)
    expect(cycles.every((h) => h.element === 'Pyro')).toBe(true)
    expect(cycles.every((h) => /cyclic/i.test(h.abil || ''))).toBe(true)
    expect(fin?.element).toBe('Pyro')
    expect(fin?.abil).toMatch(/final/i)

    // Ring ticks while off-field after tE, but not during Flamestrider DPS
    const rings = hits.filter((h) => /searing radiance/i.test(h.abil || ''))
    expect(rings.some((h) => h.time < 8)).toBe(true)
    expect(rings.every((h) => h.time < 8 || h.time > 18)).toBe(true)
  })

  it('KQM C3F D C3F: dash emits no gauge; ICD apps on C1 + F each block', () => {
    const bike = 'skill_state'
    const hits = expandPlacementHits(
      placement({
        id: 'mav-c3f',
        characterId: 'mavuika',
        start: 0,
        castSkill: true,
        castBurst: true,
        comboSteps: [
          { id: 'q', actionId: 'burst', stateId: 'default', gapAfter: 0 },
          { id: 'c1', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          { id: 'c2', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          { id: 'c3', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          {
            id: 'f1',
            actionId: 'ca_bikechargefinal',
            stateId: bike,
            gapAfter: 0,
          },
          { id: 'd', actionId: 'dash', stateId: 'default', gapAfter: 0 },
          { id: 'c4', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          { id: 'c5', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          { id: 'c6', actionId: 'ca_cycle', stateId: bike, gapAfter: 0 },
          {
            id: 'f2',
            actionId: 'ca_bikechargefinal',
            stateId: bike,
            gapAfter: 0,
          },
        ],
      }),
    )
    expect(hits.some((h) => h.actionId === 'dash')).toBe(false)
    const fs = hits.filter((h) => h.icdTag === 'MavuikaFlamestrider')
    expect(fs).toHaveLength(8) // 6C + 2F
    const sim = simulateAura(fs, { endTime: 20 })
    // Default ICD: apply on 1st, 4th, 7th, … of the Flamestrider tag
    expect(sim.applicationCounts.Pyro).toBe(4) // C1, F1, C4, F2
    expect(sim.skippedByIcd).toBe(4)
  })
})
