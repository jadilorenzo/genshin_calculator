import {
  BANNER_CALENDAR_URL,
  countdownToTimestamp,
  scheduleFromCalendar,
  type BannerRegion,
  type BannerSchedule,
} from '../src/model/bannerSchedule.ts'

export type { BannerSchedule }

export async function loadBannerSchedule(
  region: BannerRegion = 'america',
  fetchImpl: typeof fetch = fetch,
): Promise<BannerSchedule | null> {
  const response = await fetchImpl(BANNER_CALENDAR_URL)
  if (!response.ok) return null
  const data = (await response.json()) as { banners?: unknown[] }
  return scheduleFromCalendar(data as Parameters<typeof scheduleFromCalendar>[0], Date.now(), region)
}

export function formatCountdownShort(schedule: BannerSchedule, fromMs = Date.now()): string {
  const parts = countdownToTimestamp(schedule.nextChangeAt, fromMs)
  if (parts.totalMs <= 0) return 'Banner changing now'
  if (parts.days > 0) return `Ends in ${parts.days}d ${parts.hours}h`
  if (parts.hours > 0) return `Ends in ${parts.hours}h ${parts.minutes}m`
  return `Ends in ${parts.minutes}m`
}

export function featuredLine(schedule: BannerSchedule): string {
  const names = schedule.phaseStartedInRegion
    ? schedule.featuredFiveStars
    : schedule.upcomingFiveStars
  if (names.length === 0) return 'Character Event Wish'
  return names.join(' · ')
}

export function shareDescription(schedule: BannerSchedule): string {
  const names = featuredLine(schedule)
  const countdown = formatCountdownShort(schedule)
  const prefix = schedule.phaseStartedInRegion ? names : `Up next: ${names}`
  return `${prefix} — ${countdown}. Track pity and banner timers on False Moon's Reckoning.`
}
