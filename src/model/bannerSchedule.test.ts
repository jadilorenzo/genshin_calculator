import { describe, expect, it } from 'vitest'
import {
  TYPICAL_BANNER_PHASE_DAYS,
  daysUntilTimestamp,
  phaseLengthDays,
  scheduleFromCalendar,
} from './bannerSchedule.ts'

const DAY = 24 * 60 * 60

const sample = {
  banners: [
    {
      id: 1,
      name: 'Character Event Wish',
      version: '6.7',
      characters: [
        { id: 1, name: 'Sandrone', rarity: 5 },
        { id: 2, name: 'Beidou', rarity: 4 },
      ],
      start_time: 1_000,
      end_time: 1_000 + 21 * DAY,
    },
    {
      id: 2,
      name: 'Character Event Wish 2',
      version: '6.7',
      characters: [
        { id: 3, name: 'Citlali', rarity: 5 },
        { id: 2, name: 'Beidou', rarity: 4 },
      ],
      start_time: 1_000,
      end_time: 1_000 + 21 * DAY,
    },
    {
      id: 3,
      name: 'Weapon Event Wish',
      version: '6.7',
      characters: [],
      start_time: 1_000,
      end_time: 1_000 + 21 * DAY,
    },
  ],
}

describe('scheduleFromCalendar', () => {
  it('reads current character banners and featured 5★ names', () => {
    const from = (1_000 + 10 * DAY) * 1000
    const schedule = scheduleFromCalendar(sample, from)
    expect(schedule).not.toBeNull()
    expect(schedule?.nextChangeAt).toBe(1_000 + 21 * DAY)
    expect(schedule?.featuredFiveStars).toEqual(['Sandrone', 'Citlali'])
    expect(schedule?.version).toBe('6.7')
    expect(schedule?.phaseLengthDays).toBe(21)
    expect(schedule?.daysUntilNext).toBe(11)
    expect(schedule?.daysUntilAfterNext).toBe(32)
  })

  it('returns null when no character banner is active', () => {
    expect(scheduleFromCalendar(sample, (1_000 + 30 * DAY) * 1000)).toBeNull()
  })
})

describe('phaseLengthDays', () => {
  it('rounds banner duration to whole days', () => {
    expect(phaseLengthDays(0, 21 * DAY)).toBe(21)
  })

  it('falls back to the typical phase length', () => {
    expect(phaseLengthDays(10, 5)).toBe(TYPICAL_BANNER_PHASE_DAYS)
  })
})

describe('daysUntilTimestamp', () => {
  it('ceils partial days so planners keep a buffer', () => {
    const end = 1_000
    const from = (end - 10.2 * 24 * 60 * 60) * 1000
    expect(daysUntilTimestamp(end, from)).toBe(11)
  })
})
