/** Community mirror of the official HoYoverse event calendar. */
export const BANNER_CALENDAR_URL = 'https://api.ennead.cc/mihoyo/genshin/calendar'

/** Typical character-event phase length when the calendar has no duration. */
export const TYPICAL_BANNER_PHASE_DAYS = 21

export interface CalendarCharacter {
  id: number
  name: string
  rarity: number
}

export interface CalendarBanner {
  id: number
  name: string
  version: string
  characters: CalendarCharacter[]
  start_time: number
  end_time: number
}

export interface BannerSchedule {
  /** Unix seconds when the current character phase ends / next phase begins. */
  nextChangeAt: number
  /** Unix seconds when the current character phase began. */
  currentPhaseStartAt: number
  /** Whole days remaining (ceil), at least 1 while the banner is still up. */
  daysUntilNext: number
  /**
   * Days until the banner after next begins (current phase end + one phase).
   * Calendar APIs often omit upcoming phases, so this uses the live phase length.
   */
  daysUntilAfterNext: number
  /** Length of the current character phase in whole days. */
  phaseLengthDays: number
  /** Featured 5★ names on the current character event wishes. */
  featuredFiveStars: string[]
  version: string
  source: string
}

interface CalendarResponse {
  banners?: CalendarBanner[]
}

function isCharacterEventWish(banner: CalendarBanner): boolean {
  const name = banner.name.toLowerCase()
  return name.includes('character event wish')
}

export function daysUntilTimestamp(endUnixSeconds: number, fromMs = Date.now()): number {
  const remainingMs = endUnixSeconds * 1000 - fromMs
  if (remainingMs <= 0) return 0
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

export function phaseLengthDays(startUnixSeconds: number, endUnixSeconds: number): number {
  const seconds = endUnixSeconds - startUnixSeconds
  if (!(seconds > 0)) return TYPICAL_BANNER_PHASE_DAYS
  return Math.max(1, Math.round(seconds / (24 * 60 * 60)))
}

/**
 * Pick the soonest-ending active character event wish as the next phase change.
 */
/** Show Pulling day banner within 7 days before a phase ends or the day after it starts. */
export const PULLING_DAY_NOTICE_DAYS_BEFORE = 7
export const PULLING_DAY_NOTICE_DAYS_AFTER = 1

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function isNearBannerDate(
  schedule: BannerSchedule,
  fromMs = Date.now(),
): boolean {
  return pullingDayNoticeKind(schedule, fromMs) !== null
}

export type PullingDayNoticeKind = 'before' | 'after'

/** Which side of a banner change we're near, or null if outside the window. */
export function pullingDayNoticeKind(
  schedule: BannerSchedule,
  fromMs = Date.now(),
): PullingDayNoticeKind | null {
  const endMs = schedule.nextChangeAt * 1000
  const msUntilEnd = endMs - fromMs
  if (msUntilEnd > 0 && msUntilEnd <= PULLING_DAY_NOTICE_DAYS_BEFORE * MS_PER_DAY) {
    return 'before'
  }

  const startMs = schedule.currentPhaseStartAt * 1000
  const msSinceStart = fromMs - startMs
  if (
    msSinceStart >= 0 &&
    msSinceStart <= PULLING_DAY_NOTICE_DAYS_AFTER * MS_PER_DAY
  ) {
    return 'after'
  }

  return null
}

export function scheduleFromCalendar(
  data: CalendarResponse,
  fromMs = Date.now(),
): BannerSchedule | null {
  const nowSec = fromMs / 1000
  const active = (data.banners ?? []).filter(
    (b) => isCharacterEventWish(b) && b.start_time <= nowSec && b.end_time > nowSec,
  )
  if (active.length === 0) return null

  const endTime = Math.min(...active.map((b) => b.end_time))
  const ending = active.filter((b) => b.end_time === endTime)
  const featuredFiveStars = [
    ...new Set(
      ending.flatMap((b) => b.characters.filter((c) => c.rarity === 5).map((c) => c.name)),
    ),
  ]
  const startTime = Math.min(...ending.map((b) => b.start_time))
  const phaseDays = phaseLengthDays(startTime, endTime)
  const daysUntilNext = daysUntilTimestamp(endTime, fromMs)

  return {
    nextChangeAt: endTime,
    currentPhaseStartAt: startTime,
    daysUntilNext,
    daysUntilAfterNext: daysUntilNext + phaseDays,
    phaseLengthDays: phaseDays,
    featuredFiveStars,
    version: ending[0]?.version ?? '',
    source: 'HoYoverse calendar (ennead.cc)',
  }
}

export async function fetchBannerSchedule(
  fetchImpl: typeof fetch = fetch,
): Promise<BannerSchedule | null> {
  const response = await fetchImpl(BANNER_CALENDAR_URL)
  if (!response.ok) {
    throw new Error(`Banner calendar request failed (${response.status})`)
  }
  const data = (await response.json()) as CalendarResponse
  return scheduleFromCalendar(data)
}
