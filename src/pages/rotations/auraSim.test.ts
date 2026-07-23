import { describe, expect, it } from 'vitest'
import { simulateAura } from './auraSim'
import type { TimedHit } from './rotationHits'

function hit(
  partial: Partial<TimedHit> & Pick<TimedHit, 'time' | 'element' | 'gaugeUnits'>,
): TimedHit {
  return {
    characterId: 'test',
    placementId: 'p1',
    actionId: 'skill',
    abil: 'test',
    icdTag: 'None',
    icdGroup: 'None',
    directReaction: null,
    attackTag: null,
    ...partial,
  }
}

describe('simulateAura', () => {
  it('applies hydro aura then dendro blooms it away', () => {
    const result = simulateAura([
      hit({ time: 0, element: 'Hydro', gaugeUnits: 1 }),
      hit({ time: 1, element: 'Dendro', gaugeUnits: 1, characterId: 'nahida' }),
    ])
    expect(result.reactionCounts.bloom).toBe(1)
    const last = result.auraTimeline[result.auraTimeline.length - 1]
    const hydro = last.auras.find((a) => a.element === 'Hydro')
    expect((hydro?.gauge ?? 0) < 0.5).toBe(true)
  })

  it('converts electro-charged to lunar-charged when enabled', () => {
    const result = simulateAura(
      [
        hit({ time: 0, element: 'Hydro', gaugeUnits: 1 }),
        hit({
          time: 0.5,
          element: 'Electro',
          gaugeUnits: 1,
          characterId: 'ineffa',
        }),
      ],
      { convertElectroCharged: true, endTime: 3 },
    )
    expect(result.reactionCounts['lunar-charged']).toBeGreaterThanOrEqual(1)
    expect(result.reactionCounts['electro-charged'] ?? 0).toBe(0)
  })

  it('respects default ICD (apply, skip, skip)', () => {
    const hits: TimedHit[] = [0, 0.1, 0.2, 0.3].map((time, i) =>
      hit({
        time,
        element: 'Pyro',
        gaugeUnits: 1,
        icdTag: 'NormalAttack',
        icdGroup: 'Default',
        actionId: `na${i + 1}`,
      }),
    )
    const result = simulateAura(hits, { endTime: 1 })
    // First applies; next two blocked; fourth applies → 2 apps
    expect(result.applicationCounts.Pyro).toBe(2)
    expect(result.skippedByIcd).toBe(2)
  })
})
