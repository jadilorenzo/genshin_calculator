import { describe, expect, it } from 'vitest'
import {
  cancelFramesIntoNext,
  packComboSteps,
  shortActionLabel,
} from './comboSequence'
import { getAnimationAction } from './animationTimings'

describe('animation cancels', () => {
  it('cancels Mavuika ca_cycle into the next cycle at spinFrames', () => {
    const action = getAnimationAction('mavuika', 'ca_cycle', 'skill_state')!
    const next = getAnimationAction('mavuika', 'ca_cycle', 'skill_state')!
    const cancel = cancelFramesIntoNext(action, next)
    expect(cancel?.key).toBe('charge')
    expect(cancel?.frames).toBe(45)
  })

  it('packs Q C3F D C3F with ICD-aligned cancels', () => {
    const bike = 'skill_state'
    const packed = packComboSteps('mavuika', [
      { id: 'q', actionId: 'burst', stateId: 'default' },
      { id: 'c1', actionId: 'ca_cycle', stateId: bike },
      { id: 'c2', actionId: 'ca_cycle', stateId: bike },
      { id: 'c3', actionId: 'ca_cycle', stateId: bike },
      { id: 'f1', actionId: 'ca_bikechargefinal', stateId: bike },
      { id: 'd', actionId: 'dash', stateId: 'default' },
      { id: 'c4', actionId: 'ca_cycle', stateId: bike },
      { id: 'c5', actionId: 'ca_cycle', stateId: bike },
      { id: 'c6', actionId: 'ca_cycle', stateId: bike },
      { id: 'f2', actionId: 'ca_bikechargefinal', stateId: bike },
    ])
    const cycles = packed.segments.filter((s) => s.actionId === 'ca_cycle')
    const finals = packed.segments.filter(
      (s) => s.actionId === 'ca_bikechargefinal',
    )
    expect(cycles).toHaveLength(6)
    expect(finals).toHaveLength(2)
    // Cycles cancel into next CA / finisher
    expect(cycles[0].cancelledInto).toBe('charge')
    expect(cycles[2].cancelledInto).toBe('charge')
    expect(cycles[0].duration).toBeCloseTo(0.75, 2)
    // Finisher cancels into dash
    expect(finals[0].cancelledInto).toBe('dash')
    expect(shortActionLabel(cycles[0].label, 'ca_cycle')).toBe('C')
    expect(
      shortActionLabel('Charged Attack final', 'ca_bikechargefinal'),
    ).toBe('F')
  })

  it('honors cancelMode full to disable cancel shortening', () => {
    const packed = packComboSteps('mavuika', [
      {
        id: 'c1',
        actionId: 'ca_cycle',
        stateId: 'skill_state',
        cancelMode: 'full',
      },
      { id: 'c2', actionId: 'ca_cycle', stateId: 'skill_state' },
    ])
    expect(packed.segments[0].cancelledInto).toBeNull()
    expect(packed.segments[0].cancelMode).toBe('full')
    expect(packed.segments[0].duration).toBeCloseTo(0.833, 2)
  })
})
