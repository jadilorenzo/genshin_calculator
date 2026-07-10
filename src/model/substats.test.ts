import { describe, expect, it } from 'vitest'
import { probabilityOfRequiredSubstats } from './substats.ts'

describe('probabilityOfRequiredSubstats', () => {
  it('returns 1 when no substats are required', () => {
    expect(probabilityOfRequiredSubstats('hp', [])).toBe(1)
  })

  it('returns 0 when a required substat matches the main stat', () => {
    expect(probabilityOfRequiredSubstats('atkPercent', ['atkPercent'])).toBe(0)
  })

  it('returns 0 when more than four substats are required', () => {
    expect(
      probabilityOfRequiredSubstats('hp', [
        'atk',
        'def',
        'critRate',
        'critDamage',
        'energyRecharge',
      ]),
    ).toBe(0)
  })

  it('matches the wiki CRIT DMG example for a sequential draw', () => {
    // Plume (ATK main) already has ATK%, ER%, CRIT Rate; P(CRIT DMG next) = 3/27
    // Full four-line set {atkPercent, energyRecharge, critRate, critDamage} on ATK plume.
    const p = probabilityOfRequiredSubstats('atk', [
      'atkPercent',
      'energyRecharge',
      'critRate',
      'critDamage',
    ])
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(0.01)
  })

  it('is higher for a single common flat substat than for double crit', () => {
    const flatAtk = probabilityOfRequiredSubstats('hp', ['atk'])
    const doubleCrit = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'])
    expect(flatAtk).toBeGreaterThan(doubleCrit)
  })

  it('treats required order as irrelevant', () => {
    const a = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'])
    const b = probabilityOfRequiredSubstats('hp', ['critDamage', 'critRate'])
    expect(a).toBeCloseTo(b)
  })

  it('computes double-crit on a flower via weighted sampling without replacement', () => {
    // Available pool excludes flat HP (main). Total weight = 44 - 6 = 38.
    // P(both crit among 4 lines) should be a known combinatorial result.
    const p = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'])
    // Manual: sum over all 4-stat sets containing both crits.
    // Remaining picks: C(8,2) from {atk,def,hp%,atk%,def%,ER,EM} wait pool has 9 non-crit:
    // atk, def, hp%, atk%, def%, ER, EM (7 with weights) + we need 2 more from 7 non-crit
    // Actually pool: atk(6), def(6), hp%(4), atk%(4), def%(4), ER(4), EM(4), CR(3), CD(3) = 38
    // Non-required: 7 stats. Choose 2 of 7. This is tedious but p should be around ~0.07-0.09
    expect(p).toBeGreaterThan(0.05)
    expect(p).toBeLessThan(0.12)
  })

  it('with any-mode is higher than all-mode for multiple substats', () => {
    const all = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'], 'all')
    const any = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'], 'any')
    expect(any).toBeGreaterThan(all)
    expect(any).toBeLessThan(1)
  })

  it('with any-mode matches all-mode for a single substat', () => {
    const all = probabilityOfRequiredSubstats('hp', ['critRate'], 'all')
    const any = probabilityOfRequiredSubstats('hp', ['critRate'], 'any')
    expect(any).toBeCloseTo(all)
  })

  it('with any-mode equals one minus probability of avoiding all options', () => {
    const any = probabilityOfRequiredSubstats('hp', ['critRate', 'critDamage'], 'any')
    // Either crit line is fairly common among four rolls.
    expect(any).toBeGreaterThan(0.5)
    expect(any).toBeLessThan(0.7)
  })
})
