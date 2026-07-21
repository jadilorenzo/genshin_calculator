/** Community mirror of the official HoYoverse event calendar. */
export const BANNER_CALENDAR_URL = 'https://api.ennead.cc/mihoyo/genshin/calendar'

/** Typical character-event phase length when the calendar has no duration. */
export const TYPICAL_BANNER_PHASE_DAYS = 21

/** HoYoverse server groups use different daily reset hours for banner changes. */
export type BannerRegion = 'asia' | 'america' | 'europe'

export const BANNER_REGION_OPTIONS: { id: BannerRegion; label: string; note: string }[] = [
  { id: 'asia', label: 'Asia', note: '18:00 UTC+8' },
  { id: 'america', label: 'Americas', note: '18:00 UTC−5' },
  { id: 'europe', label: 'Europe', note: '18:00 UTC+1' },
]

/** Calendar API timestamps match Asia server reset (18:00 UTC+8). */
const API_SOURCE_TIME_ZONE = 'Asia/Shanghai'

/** HoYoverse uses 18:00 on each server group's fixed UTC offset (not US daylight time). */
const REGION_RESET_UTC: Record<BannerRegion, { offsetHours: number; hour: number; minute: number }> = {
  asia: { offsetHours: 8, hour: 18, minute: 0 },
  america: { offsetHours: -5, hour: 18, minute: 0 },
  europe: { offsetHours: 1, hour: 18, minute: 0 },
}

export function inferBannerRegion(): BannerRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz.startsWith('America/')) return 'america'
    if (tz.startsWith('Europe/')) return 'europe'
    if (tz.startsWith('Asia/') || tz.startsWith('Australia/')) return 'asia'
  } catch {
    // Ignore environments without timezone support.
  }
  return 'america'
}

function datePartsInTimeZone(
  ms: number,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  return {
    year: Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
    day: Number(parts.find((p) => p.type === 'day')!.value),
  }
}

/** Map an API timestamp to 18:00 server time on the same banner date in the chosen region. */
export function adjustBannerTimestampForRegion(
  apiUnixSeconds: number,
  region: BannerRegion,
): number {
  if (region === 'asia') return apiUnixSeconds

  const { offsetHours, hour, minute } = REGION_RESET_UTC[region]
  const { year, month, day } = datePartsInTimeZone(
    apiUnixSeconds * 1000,
    API_SOURCE_TIME_ZONE,
  )
  return Math.floor(
    Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0) / 1000,
  )
}

export function regionalPhaseTimes(
  apiStartUnixSeconds: number,
  apiEndUnixSeconds: number,
  region: BannerRegion,
): { regionalStart: number; regionalEnd: number } {
  const regionalStart = adjustBannerTimestampForRegion(apiStartUnixSeconds, region)
  const duration = apiEndUnixSeconds - apiStartUnixSeconds
  return { regionalStart, regionalEnd: regionalStart + duration }
}

export interface CalendarCharacter {
  id: number
  name: string
  rarity: number
}

export interface BannerFeaturedCharacter {
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
  /** Featured 5★ names on the current character event wishes in your region. */
  featuredFiveStars: string[]
  /** Featured 5★ names for the upcoming phase (always from the live calendar phase). */
  upcomingFiveStars: string[]
  /** All rate-up characters in this phase (5★ and 4★, deduped). */
  phaseCharacters: BannerFeaturedCharacter[]
  /** False during the gap after Asia reset but before your region's reset. */
  phaseStartedInRegion: boolean
  region: BannerRegion
  version: string
  source: string
}

interface CalendarResponse {
  banners?: CalendarBanner[]
}

export type BannerCalendarData = CalendarResponse

export async function fetchBannerCalendar(
  fetchImpl: typeof fetch = fetch,
): Promise<BannerCalendarData> {
  const response = await fetchImpl(BANNER_CALENDAR_URL)
  if (!response.ok) {
    throw new Error(`Banner calendar request failed (${response.status})`)
  }
  return (await response.json()) as BannerCalendarData
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

export interface CountdownParts {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function countdownToTimestamp(
  endUnixSeconds: number,
  fromMs = Date.now(),
): CountdownParts {
  const totalMs = Math.max(0, endUnixSeconds * 1000 - fromMs)
  const second = 1000
  const minute = 60 * second
  const hour = 60 * minute
  const day = 24 * hour
  return {
    totalMs,
    days: Math.floor(totalMs / day),
    hours: Math.floor((totalMs % day) / hour),
    minutes: Math.floor((totalMs % hour) / minute),
    seconds: Math.floor((totalMs % minute) / second),
  }
}

export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Format a banner instant in the viewer's local timezone. */
export function formatBannerDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: getLocalTimeZone(),
  }).format(new Date(unixSeconds * 1000))
}

/** Clock time only, in the viewer's local timezone. */
export function formatBannerLocalTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: getLocalTimeZone(),
  }).format(new Date(unixSeconds * 1000))
}

function phaseCharacters(banners: CalendarBanner[]): BannerFeaturedCharacter[] {
  const byName = new Map<string, BannerFeaturedCharacter>()
  for (const banner of banners) {
    for (const character of banner.characters) {
      if (!byName.has(character.name)) {
        byName.set(character.name, {
          name: character.name,
          rarity: character.rarity,
        })
      }
    }
  }
  const ordered = [...byName.values()]
  const fiveStars = ordered.filter((character) => character.rarity === 5)
  const fourStars = ordered.filter((character) => character.rarity === 4)
  return [...fiveStars, ...fourStars]
}

function fiveStarNames(banners: CalendarBanner[]): string[] {
  return phaseCharacters(banners)
    .filter((character) => character.rarity === 5)
    .map((character) => character.name)
}

function groupCharacterPhases(banners: CalendarBanner[]): CalendarBanner[][] {
  const phases = new Map<string, CalendarBanner[]>()
  for (const banner of banners) {
    const key = `${banner.start_time}:${banner.end_time}`
    const group = phases.get(key)
    if (group) group.push(banner)
    else phases.set(key, [banner])
  }
  return [...phases.values()]
}

export function scheduleFromCalendar(
  data: CalendarResponse,
  fromMs = Date.now(),
  region: BannerRegion = 'asia',
): BannerSchedule | null {
  const nowSec = fromMs / 1000
  const characterBanners = (data.banners ?? []).filter(isCharacterEventWish)
  if (characterBanners.length === 0) return null

  const phases = groupCharacterPhases(characterBanners)
  const asiaActivePhases = phases.filter((phase) => {
    const banner = phase[0]
    return banner.start_time <= nowSec && banner.end_time > nowSec
  })

  let selectedPhase: CalendarBanner[] | null = null
  let phaseStartedInRegion = false
  let nextChangeAt = 0
  let currentPhaseStartAt = 0

  for (const phase of phases) {
    const { regionalStart, regionalEnd } = regionalPhaseTimes(
      phase[0].start_time,
      phase[0].end_time,
      region,
    )
    if (regionalStart <= nowSec && regionalEnd > nowSec) {
      selectedPhase = phase
      phaseStartedInRegion = true
      nextChangeAt = regionalEnd
      currentPhaseStartAt = regionalStart
      break
    }
  }

  if (!selectedPhase && asiaActivePhases.length > 0) {
    const phase = asiaActivePhases[0]
    const { regionalStart } = regionalPhaseTimes(
      phase[0].start_time,
      phase[0].end_time,
      region,
    )
    if (regionalStart > nowSec) {
      selectedPhase = phase
      phaseStartedInRegion = false
      nextChangeAt = regionalStart
      currentPhaseStartAt = regionalStart - (phase[0].end_time - phase[0].start_time)
    }
  }

  if (!selectedPhase) return null

  const apiStart = selectedPhase[0].start_time
  const apiEnd = selectedPhase[0].end_time
  const upcomingFiveStars = fiveStarNames(selectedPhase)
  const featuredFiveStars = phaseStartedInRegion ? upcomingFiveStars : []
  const characters = phaseCharacters(selectedPhase)
  const phaseDays = phaseLengthDays(apiStart, apiEnd)
  const daysUntilNext = daysUntilTimestamp(nextChangeAt, fromMs)
  const regionLabel = BANNER_REGION_OPTIONS.find((option) => option.id === region)?.label ?? region

  return {
    nextChangeAt,
    currentPhaseStartAt,
    daysUntilNext,
    daysUntilAfterNext: daysUntilNext + phaseDays,
    phaseLengthDays: phaseDays,
    featuredFiveStars,
    upcomingFiveStars,
    phaseCharacters: characters,
    phaseStartedInRegion,
    region,
    version: selectedPhase[0]?.version ?? '',
    source: `HoYoverse calendar (ennead.cc) · ${regionLabel} reset`,
  }
}

export async function fetchBannerSchedule(
  fetchImpl: typeof fetch = fetch,
  region: BannerRegion = 'asia',
): Promise<BannerSchedule | null> {
  const data = await fetchBannerCalendar(fetchImpl)
  return scheduleFromCalendar(data, Date.now(), region)
}
