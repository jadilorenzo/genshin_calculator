import { describe, expect, it } from 'vitest'
import {
  TYPICAL_BANNER_PHASE_DAYS,
  adjustBannerTimestampForRegion,
  countdownToTimestamp,
  daysUntilTimestamp,
  isNearBannerDate,
  phaseLengthDays,
  pullingDayNoticeKind,
  regionalPhaseTimes,
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
  it('reads current character banners and featured 5★ names in Asia', () => {
    const from = (1_000 + 10 * DAY) * 1000
    const schedule = scheduleFromCalendar(sample, from, 'asia')
    expect(schedule).not.toBeNull()
    expect(schedule?.nextChangeAt).toBe(1_000 + 21 * DAY)
    expect(schedule?.currentPhaseStartAt).toBe(1_000)
    expect(schedule?.featuredFiveStars).toEqual(['Sandrone', 'Citlali'])
    expect(schedule?.upcomingFiveStars).toEqual(['Sandrone', 'Citlali'])
    expect(schedule?.phaseCharacters).toEqual([
      { name: 'Sandrone', rarity: 5 },
      { name: 'Citlali', rarity: 5 },
      { name: 'Beidou', rarity: 4 },
    ])
    expect(schedule?.phaseStartedInRegion).toBe(true)
    expect(schedule?.region).toBe('asia')
    expect(schedule?.version).toBe('6.7')
    expect(schedule?.phaseLengthDays).toBe(21)
    expect(schedule?.daysUntilNext).toBe(11)
    expect(schedule?.daysUntilAfterNext).toBe(32)
  })

  it('returns null when no character banner is active', () => {
    expect(scheduleFromCalendar(sample, (1_000 + 30 * DAY) * 1000, 'asia')).toBeNull()
  })

  it('treats Asia-active phases as upcoming before the Americas reset', () => {
    const from = (1_000 + 2 * 60 * 60) * 1000
    const schedule = scheduleFromCalendar(sample, from, 'america')
    expect(schedule).not.toBeNull()
    expect(schedule?.phaseStartedInRegion).toBe(false)
    expect(schedule?.featuredFiveStars).toEqual([])
    expect(schedule?.upcomingFiveStars).toEqual(['Sandrone', 'Citlali'])
    expect(schedule?.nextChangeAt).toBeGreaterThan(1_000)
  })
})

describe('adjustBannerTimestampForRegion', () => {
  it('shifts the live Columbina phase start from Asia to Americas reset', () => {
    const apiStart = 1_784_628_000 // 2026-07-21 10:00 UTC (Asia 18:00 UTC+8)
    const americaStart = adjustBannerTimestampForRegion(apiStart, 'america')
    expect(americaStart - apiStart).toBe(13 * 60 * 60) // 18:00 UTC−5 = 23:00 UTC
  })

  it('shifts the live Columbina phase start from Asia to Europe reset', () => {
    const apiStart = 1_784_628_000
    const europeStart = adjustBannerTimestampForRegion(apiStart, 'europe')
    expect(europeStart - apiStart).toBe(7 * 60 * 60) // 18:00 UTC+1 = 17:00 UTC
  })
})

describe('regionalPhaseTimes', () => {
  it('preserves phase duration after shifting the start time', () => {
    const apiStart = 1_000
    const apiEnd = 1_000 + 21 * DAY
    const asia = regionalPhaseTimes(apiStart, apiEnd, 'asia')
    const america = regionalPhaseTimes(apiStart, apiEnd, 'america')
    expect(asia.regionalEnd - asia.regionalStart).toBe(apiEnd - apiStart)
    expect(america.regionalEnd - america.regionalStart).toBe(apiEnd - apiStart)
    expect(america.regionalStart).toBeGreaterThan(asia.regionalStart)
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

describe('countdownToTimestamp', () => {
  it('breaks remaining time into day/hour/minute/second parts', () => {
    const end = 1_000 + 2 * DAY + 3 * 60 * 60 + 4 * 60 + 5
    const from = 1_000 * 1000
    expect(countdownToTimestamp(end, from)).toEqual({
      totalMs: (2 * DAY + 3 * 60 * 60 + 4 * 60 + 5) * 1000,
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    })
  })

  it('never goes negative', () => {
    expect(countdownToTimestamp(1_000, (1_000 + DAY) * 1000).totalMs).toBe(0)
  })
})

describe('pullingDayNoticeKind', () => {
  const schedule = scheduleFromCalendar(sample, (1_000 + 10 * DAY) * 1000, 'asia')!

  it('is before within seven days of phase end', () => {
    const from = (1_000 + 15 * DAY) * 1000
    expect(pullingDayNoticeKind(schedule, from)).toBe('before')
    expect(isNearBannerDate(schedule, from)).toBe(true)
  })

  it('is null mid-phase', () => {
    const from = (1_000 + 5 * DAY) * 1000
    expect(pullingDayNoticeKind(schedule, from)).toBeNull()
  })

  it('is after on the first day of a new phase', () => {
    const newPhase = {
      ...schedule,
      phaseStartedInRegion: true,
      currentPhaseStartAt: 1_000 + 21 * DAY,
      nextChangeAt: 1_000 + 42 * DAY,
      daysUntilNext: 21,
    }
    const from = (1_000 + 21 * DAY + 12 * 60 * 60) * 1000
    expect(pullingDayNoticeKind(newPhase, from)).toBe('after')
  })

  it('is null more than one day after phase start', () => {
    const newPhase = {
      ...schedule,
      phaseStartedInRegion: true,
      currentPhaseStartAt: 1_000 + 21 * DAY,
      nextChangeAt: 1_000 + 42 * DAY,
      daysUntilNext: 21,
    }
    const later = (1_000 + 21 * DAY + 2 * DAY) * 1000
    expect(pullingDayNoticeKind(newPhase, later)).toBeNull()
  })
})
