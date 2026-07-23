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

  it('packs Q C4 J C4F with cancel durations under full CA length', () => {
    const bike = 'skill_state'
    const packed = packComboSteps('mavuika', [
      { id: 'q', actionId: 'burst', stateId: 'default' },
      { id: 'c1', actionId: 'ca_cycle', stateId: bike },
      { id: 'c2', actionId: 'ca_cycle', stateId: bike },
      { id: 'c3', actionId: 'ca_cycle', stateId: bike },
      { id: 'c4', actionId: 'ca_cycle', stateId: bike },
      { id: 'j', actionId: 'jump_bikejump', stateId: bike },
      { id: 'c5', actionId: 'ca_cycle', stateId: bike },
      { id: 'c6', actionId: 'ca_cycle', stateId: bike },
      { id: 'c7', actionId: 'ca_cycle', stateId: bike },
      { id: 'c8', actionId: 'ca_cycle', stateId: bike },
      { id: 'f', actionId: 'ca_bikechargefinal', stateId: bike },
    ])
    const cycles = packed.segments.filter((s) => s.actionId === 'ca_cycle')
    expect(cycles.length).toBe(8)
    // Intermediate cycles cancel into next CA (~0.75s), not full 0.833s
    expect(cycles[0].cancelledInto).toBe('charge')
    expect(cycles[0].canCancel).toBe(true)
    expect(cycles[0].duration).toBeCloseTo(0.75, 2)
    expect(cycles[0].duration).toBeLessThan(cycles[0].fullDuration!)
    // Last cycle before final also cancels into final CA
    expect(cycles[7].cancelledInto).toBe('charge')
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
