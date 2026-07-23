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

  it('resets Default ICD 2.5s after the first hit of the window', () => {
    // C1 @0 apply, C2 @0.7 skip, C3 @1.4 skip, F @2.1 apply (hit 4),
    // C4 @2.6 applies via timer (2.5s from first hit) — not blocked as hit 5.
    const times = [0, 0.7, 1.4, 2.1, 2.6]
    const hits: TimedHit[] = times.map((time, i) =>
      hit({
        time,
        element: 'Pyro',
        gaugeUnits: 1,
        icdTag: 'MavuikaFlamestrider',
        icdGroup: 'Default',
        actionId: `ca${i}`,
      }),
    )
    const result = simulateAura(hits, { endTime: 4 })
    expect(result.applicationCounts.Pyro).toBe(3)
    expect(result.skippedByIcd).toBe(2)
  })

  it('shows Anemo briefly on swirl then recovers to lasting auras', () => {
    const result = simulateAura(
      [
        hit({ time: 0, element: 'Hydro', gaugeUnits: 1 }),
        hit({ time: 0.2, element: 'Electro', gaugeUnits: 1 }),
        hit({ time: 0.5, element: 'Anemo', gaugeUnits: 1, characterId: 'sucrose' }),
      ],
      { endTime: 3, convertElectroCharged: true },
    )
    expect(result.reactionCounts.swirl).toBe(1)
    const swirlMark = result.transitions.find(
      (t) =>
        Math.abs(t.time - 0.5) < 1e-6 &&
        t.flash?.some((a) => a.element === 'Anemo'),
    )
    expect(swirlMark).toBeTruthy()
    expect(swirlMark!.auras.some((a) => a.element === 'Anemo')).toBe(false)
    expect(swirlMark!.auras.some((a) => a.element === 'Hydro')).toBe(true)
    expect(swirlMark!.auras.some((a) => a.element === 'Electro')).toBe(true)
    const lastingAnemo = result.transitions.some((t) =>
      t.auras.some((a) => a.element === 'Anemo'),
    )
    expect(lastingAnemo).toBe(false)
  })

  it('does not apply Anemo aura when swirling nothing', () => {
    const result = simulateAura(
      [hit({ time: 0, element: 'Anemo', gaugeUnits: 1, characterId: 'sucrose' })],
      { endTime: 2 },
    )
    expect(result.transitions.every((t) => t.auras.length === 0)).toBe(true)
  })

  it('emits a cleared transition when aura fully decays', () => {
    const result = simulateAura(
      [hit({ time: 0, element: 'Hydro', gaugeUnits: 1 })],
      { endTime: 12, sampleInterval: 0.5 },
    )
    const cleared = result.transitions.find(
      (t) => t.time > 0 && t.auras.length === 0,
    )
    expect(cleared).toBeTruthy()
    // 1U after tax lasts ~9.5s
    expect(cleared!.time).toBeGreaterThan(8)
    expect(cleared!.time).toBeLessThan(11)
  })

  it('melts when off-field Cryo aura meets on-field Pyro', () => {
    const result = simulateAura(
      [
        hit({
          time: 1,
          element: 'Cryo',
          gaugeUnits: 1,
          characterId: 'citlali',
          actionId: 'offfield:itzpapa-frostfall',
          offField: true,
          icdTag: 'CitlaliFrostfallStorm',
          icdGroup: 'CitlaliFrostfallStorm',
        }),
        hit({
          time: 2,
          element: 'Pyro',
          gaugeUnits: 1,
          characterId: 'mavuika',
          actionId: 'na1',
          abil: 'Flamestrider Normal',
          icdTag: 'None',
          icdGroup: 'None',
        }),
        hit({
          time: 3.5,
          element: 'Cryo',
          gaugeUnits: 1,
          characterId: 'citlali',
          actionId: 'offfield:itzpapa-frostfall',
          offField: true,
          icdTag: 'CitlaliFrostfallStorm',
          icdGroup: 'CitlaliFrostfallStorm',
        }),
        hit({
          time: 4,
          element: 'Pyro',
          gaugeUnits: 1,
          characterId: 'mavuika',
          actionId: 'ca_cycle',
          abil: 'Flamestrider Charged Attack (Cyclic)',
          icdTag: 'None',
          icdGroup: 'None',
        }),
      ],
      { endTime: 6 },
    )
    expect(result.reactionCounts.melt).toBeGreaterThanOrEqual(2)
    expect(result.events.filter((e) => e.reaction === 'melt').length).toBe(
      result.reactionCounts.melt,
    )
  })

  it('records direct Lunar-Bloom from Nefer Phantasm without Hydro aura', () => {
    const result = simulateAura(
      [
        hit({
          time: 1,
          element: null,
          gaugeUnits: 0,
          characterId: 'nefer',
          actionId: 'ca_phantasm',
          abil: 'Phantasm Performance (Nefer 1)',
          directReaction: 'lunar-bloom',
          attackTag: 'DirectLunarBloom',
        }),
        hit({
          time: 1.05,
          element: 'Dendro',
          gaugeUnits: 1,
          characterId: 'nefer',
          actionId: 'ca_phantasm',
          abil: 'Phantasm Performance (Nefer 1)',
          icdTag: 'None',
          icdGroup: 'None',
        }),
      ],
      { endTime: 2, convertBloom: true },
    )
    expect(result.reactionCounts['lunar-bloom']).toBe(1)
    expect(result.events[0]?.placementId).toBe('p1')
  })
})
