import { describe, expect, it } from 'vitest'
import {
  isActionUnlockedByPriorSteps,
  isAttackStringAction,
  listPaletteActions,
  listPaletteEntries,
} from './comboSequence'

describe('combo sequence prerequisites from kit descriptions', () => {
  it('Flins: skill → spearstorm → mini-burst (kit: sQ after Spearstorm)', () => {
    const empty = listPaletteActions('flins', 'default', [])
    expect(empty.map((a) => a.id)).toContain('skill')
    expect(empty.map((a) => a.id)).not.toContain('skill_spearstorm')
    expect(empty.map((a) => a.id)).not.toContain('burst_mini')

    const afterSkill = listPaletteActions('flins', 'default', [
      { actionId: 'skill' },
    ])
    expect(afterSkill.map((a) => a.id)).toContain('skill_spearstorm')
    expect(afterSkill.map((a) => a.id)).not.toContain('burst_mini')

    const afterSpear = listPaletteActions('flins', 'default', [
      { actionId: 'skill' },
      { actionId: 'skill_spearstorm' },
    ])
    expect(afterSpear.map((a) => a.id)).toContain('burst_mini')
  })

  it('shows locked Flins follow-ups with requires / unlocks metadata', () => {
    const entries = listPaletteEntries('flins', 'default', [])
    const skill = entries.find((e) => e.action.id === 'skill')
    const spear = entries.find((e) => e.action.id === 'skill_spearstorm')
    const mini = entries.find((e) => e.action.id === 'burst_mini')
    expect(skill?.locked).toBe(false)
    expect(skill?.unlocks.some((a) => a.id === 'skill_spearstorm')).toBe(true)
    expect(spear?.locked).toBe(true)
    expect(spear?.requiresAny).toContain('skill')
    expect(mini?.locked).toBe(true)
    expect(mini?.requiresAny).toContain('skill_spearstorm')
  })

  it('Nefer: Phantasm CA only after skill (Shadow Dance)', () => {
    expect(isActionUnlockedByPriorSteps('nefer', 'ca_phantasm', [])).toBe(
      false,
    )
    expect(
      isActionUnlockedByPriorSteps('nefer', 'ca_phantasm', [
        { actionId: 'skill' },
      ]),
    ).toBe(true)
  })

  it('Freminet: Shattering Pressure only after thrust / skill', () => {
    expect(
      isActionUnlockedByPriorSteps(
        'freminet',
        'skill_skillpressureframes_0',
        [],
      ),
    ).toBe(false)
    expect(
      isActionUnlockedByPriorSteps('freminet', 'skill_skillpressureframes_0', [
        { actionId: 'skill' },
      ]),
    ).toBe(true)
  })

  it('skill recasts stay gated behind an initial skill', () => {
    expect(
      isActionUnlockedByPriorSteps('keqing', 'skill_skillrecast', []),
    ).toBe(false)
    expect(
      isActionUnlockedByPriorSteps('keqing', 'skill_skillrecast', [
        { actionId: 'skill' },
      ]),
    ).toBe(true)
  })

  it('lists individual NAs and special CAs in palette entries', () => {
    const entries = listPaletteEntries('nefer', 'default', [])
    expect(entries.some((e) => e.action.id === 'normals')).toBe(true)
    expect(entries.some((e) => e.action.id === 'na1')).toBe(true)
    expect(entries.some((e) => e.action.id === 'ca')).toBe(true)
    expect(entries.some((e) => e.action.id === 'ca_phantasm')).toBe(true)
    expect(isAttackStringAction(entries.find((e) => e.action.id === 'na1')!.action)).toBe(
      true,
    )
    expect(
      isAttackStringAction(
        entries.find((e) => e.action.id === 'ca_phantasm')!.action,
      ),
    ).toBe(true)
  })
})
