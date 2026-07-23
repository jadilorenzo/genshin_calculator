import { describe, expect, it } from 'vitest'
import { listOffFieldAppliers } from './offFieldAppliers'
import { expandPlacementHits } from './rotationHits'
import type { TimelinePlacement } from './types'

function placement(
  partial: Partial<TimelinePlacement> &
    Pick<TimelinePlacement, 'id' | 'characterId' | 'start'>,
): TimelinePlacement {
  return {
    duration: 2,
    castSkill: true,
    castBurst: false,
    castOrder: 'skill-first',
    skillVariant: 'press',
    skillCasts: 1,
    activeDurations: [],
    durationOverrides: {},
    comboSteps: [
      {
        id: 's1',
        actionId: 'skill',
        stateId: 'default',
        gapAfter: 0,
      },
    ],
    ...partial,
  }
}

describe('off-field aura appliers', () => {
  it('catalogues Columbina Gravity Ripple', () => {
    const apps = listOffFieldAppliers('columbina')
    expect(apps.length).toBeGreaterThanOrEqual(1)
    expect(apps[0].element).toBe('Hydro')
    expect(apps[0].resolvedDuration).toBe(25)
    expect(apps[0].intervalSeconds).toBeCloseTo(117 / 60, 3)
  })

  it('emits Hydro ticks across Ripple duration after Columbina E', () => {
    const hits = expandPlacementHits(
      placement({ id: 'p1', characterId: 'columbina', start: 1 }),
    )
    const dots = hits.filter((h) => h.offField)
    expect(dots.length).toBeGreaterThan(8)
    expect(dots.every((h) => h.element === 'Hydro')).toBe(true)
    const last = dots[dots.length - 1]
    expect(last.time).toBeGreaterThan(1 + 20)
    expect(last.time).toBeLessThanOrEqual(1 + 25 + 2)
  })

  it('emits Ineffa Birgitta Electro ticks', () => {
    const hits = expandPlacementHits(
      placement({ id: 'p2', characterId: 'ineffa', start: 0 }),
    )
    const dots = hits.filter((h) => h.offField)
    expect(dots.length).toBeGreaterThan(5)
    expect(dots.every((h) => h.element === 'Electro')).toBe(true)
  })

  it('emits Lauma Frostgrove Dendro ticks for 15s', () => {
    const apps = listOffFieldAppliers('lauma')
    expect(apps.some((a) => a.id === 'frostgrove-sanctuary')).toBe(true)
    const hits = expandPlacementHits(
      placement({ id: 'p3', characterId: 'lauma', start: 0 }),
    )
    const dots = hits.filter((h) => h.offField)
    expect(dots.length).toBeGreaterThanOrEqual(7)
    expect(dots.every((h) => h.element === 'Dendro')).toBe(true)
    expect(dots[dots.length - 1].time).toBeGreaterThanOrEqual(14)
  })

  it('catalogues Citlali Itzpapa Frostfall Cryo ticks', () => {
    const apps = listOffFieldAppliers('citlali')
    expect(apps.some((a) => a.id === 'itzpapa-frostfall')).toBe(true)
    expect(apps[0].element).toBe('Cryo')
    expect(apps[0].intervalSeconds).toBe(1)
    const hits = expandPlacementHits(
      placement({ id: 'p-cit', characterId: 'citlali', start: 0 }),
    )
    const dots = hits.filter((h) => h.offField)
    expect(dots.length).toBeGreaterThanOrEqual(10)
    expect(dots.every((h) => h.element === 'Cryo')).toBe(true)
  })

  it('catalogues Mavuika Ring of Searing Radiance Pyro ticks', () => {
    const apps = listOffFieldAppliers('mavuika')
    expect(apps.some((a) => a.id === 'ring-of-searing-radiance')).toBe(true)
    expect(apps[0].element).toBe('Pyro')
    expect(apps[0].intervalSeconds).toBe(2)
    const hits = expandPlacementHits(
      placement({ id: 'p-mav', characterId: 'mavuika', start: 0 }),
    )
    const dots = hits.filter((h) => h.offField)
    expect(dots.length).toBeGreaterThanOrEqual(5)
    expect(dots.every((h) => h.element === 'Pyro')).toBe(true)
  })

  it('emits Nefer skill + phantasm Dendro gauge apps', () => {
    const hits = expandPlacementHits({
      id: 'p4',
      characterId: 'nefer',
      start: 0,
      duration: 10,
      castSkill: true,
      castBurst: false,
      castOrder: 'skill-first',
      skillVariant: 'press',
      skillCasts: 1,
      activeDurations: [],
      durationOverrides: {},
      comboSteps: [
        { id: '1', actionId: 'skill', stateId: 'default', gapAfter: 0 },
        { id: '2', actionId: 'ca_phantasm', stateId: 'default', gapAfter: 0 },
        { id: '3', actionId: 'ca_phantasm', stateId: 'default', gapAfter: 0 },
      ],
    })
    const dendro = hits.filter((h) => h.element === 'Dendro' && h.gaugeUnits > 0)
    expect(dendro.some((h) => h.actionId === 'skill')).toBe(true)
    const phantasm = dendro.filter((h) => h.actionId === 'ca_phantasm')
    // 2 self-hits per phantasm × 2 CAs
    expect(phantasm.length).toBe(4)
    expect(phantasm.every((h) => /Nefer/i.test(h.abil ?? ''))).toBe(true)
    const lunar = hits.filter((h) => h.directReaction === 'lunar-bloom')
    expect(lunar).toHaveLength(4)
    expect(lunar.every((h) => h.placementId === 'p4')).toBe(true)
  })
})
