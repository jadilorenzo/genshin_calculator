import { describe, expect, it } from 'vitest'
import { packComboSteps } from './comboSequence'
import {
  hasNightsoulResource,
  nightsoulActiveSpan,
  nightsoulFillGradient,
  resolveNightsoulMax,
  sampleNightsoulAcrossRotation,
  sampleNightsoulFill,
} from './nightsoulSim'

describe('nightsoulSim', () => {
  it('detects Natlan nightsoul characters', () => {
    expect(hasNightsoulResource('mavuika')).toBe(true)
    expect(hasNightsoulResource('citlali')).toBe(true)
    expect(hasNightsoulResource('bennett')).toBe(false)
  })

  it('fills on skill then drains for Mavuika', () => {
    const packed = packComboSteps('mavuika', [
      { id: '1', actionId: 'skill', stateId: 'default' },
      {
        id: '2',
        actionId: 'normals',
        stateId: 'default',
        durationSeconds: 6,
      },
    ])
    const samples = sampleNightsoulFill('mavuika', packed, 0.25)
    expect(samples).not.toBeNull()
    expect(resolveNightsoulMax('mavuika')).toBe(80)
    const afterSkill = samples!.find((s) => s.time >= 0.05)
    expect(afterSkill!.fill).toBeGreaterThan(0.8)
    const last = samples![samples!.length - 1]
    expect(last.fill).toBeLessThan(afterSkill!.fill)
  })

  it('fills on burst for Mavuika (Fighting Spirit → Nightsoul)', () => {
    const packed = packComboSteps('mavuika', [
      { id: '1', actionId: 'burst', stateId: 'default' },
      {
        id: '2',
        actionId: 'normals',
        stateId: 'default',
        durationSeconds: 4,
      },
    ])
    const samples = sampleNightsoulFill('mavuika', packed, 0.2)
    expect(samples).not.toBeNull()
    const peak = samples!.reduce((b, s) => (s.fill > b.fill ? s : b), samples![0])
    expect(peak.points).toBe(80)
    expect(peak.fill).toBe(1)
    const last = samples![samples!.length - 1]
    expect(last.points).toBeLessThan(80)
    expect(last.points).toBeGreaterThan(0)
  })

  it('stays empty before any enter (no phantom drain from 0)', () => {
    const packed = packComboSteps('mavuika', [
      {
        id: '1',
        actionId: 'normals',
        stateId: 'default',
        durationSeconds: 2,
      },
    ])
    const samples = sampleNightsoulFill('mavuika', packed, 0.5)
    expect(samples!.every((s) => s.points === 0)).toBe(true)
  })

  it('builds a gradient string from samples', () => {
    const packed = packComboSteps('xilonen', [
      { id: '1', actionId: 'skill', stateId: 'default' },
      {
        id: '2',
        actionId: 'normals',
        stateId: 'default',
        durationSeconds: 3,
      },
    ])
    const samples = sampleNightsoulFill('xilonen', packed, 0.5)
    const css = nightsoulFillGradient(samples!, packed.totalSeconds, 'Geo')
    expect(css.startsWith('linear-gradient(90deg')).toBe(true)
    expect(css.includes('rgb(210, 170, 80)')).toBe(true)
  })

  it('keeps draining Mavuika NS off-field after tE (Ring)', () => {
    const samples = sampleNightsoulAcrossRotation(
      'mavuika',
      [
        {
          id: 'm1',
          characterId: 'mavuika',
          start: 0,
          duration: 0.75,
          castSkill: true,
          castBurst: false,
          castOrder: 'skill-first',
          skillVariant: 'press',
          skillCasts: 1,
          comboSteps: [{ id: 's', actionId: 'skill', stateId: 'default' }],
          activeDurations: [],
          durationOverrides: {},
          showNightsoulFill: true,
        },
        {
          id: 'x1',
          characterId: 'xilonen',
          start: 1,
          duration: 8,
          castSkill: true,
          castBurst: false,
          castOrder: 'skill-first',
          skillVariant: 'press',
          skillCasts: 1,
          comboSteps: [],
          activeDurations: [],
          durationOverrides: {},
        },
      ],
      0.25,
    )
    expect(samples).not.toBeNull()
    const atEnter = samples!.find((s) => s.time >= 0.05 && s.points > 70)
    expect(atEnter).toBeTruthy()
    // Still draining ~4s after Mavuika left the field
    const midOff = samples!.find((s) => s.time >= 4 && s.time <= 5)
    expect(midOff!.points).toBeGreaterThan(0)
    expect(midOff!.points).toBeLessThan(atEnter!.points)
    const span = nightsoulActiveSpan(samples!)
    expect(span).not.toBeNull()
    expect(span!.end).toBeGreaterThan(8)
  })
})
