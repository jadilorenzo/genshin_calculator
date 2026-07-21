const BANNER_CALENDAR_URL = 'https://api.ennead.cc/mihoyo/genshin/calendar'
const API_SOURCE_TIME_ZONE = 'Asia/Shanghai'
const TYPICAL_BANNER_PHASE_DAYS = 21

const REGION_RESET_UTC = {
  asia: { offsetHours: 8, hour: 18, minute: 0 },
  america: { offsetHours: -5, hour: 18, minute: 0 },
  europe: { offsetHours: 1, hour: 18, minute: 0 },
}

function datePartsInTimeZone(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  return {
    year: Number(parts.find((p) => p.type === 'year').value),
    month: Number(parts.find((p) => p.type === 'month').value),
    day: Number(parts.find((p) => p.type === 'day').value),
  }
}

function adjustBannerTimestampForRegion(apiUnixSeconds, region) {
  if (region === 'asia') return apiUnixSeconds
  const { offsetHours, hour, minute } = REGION_RESET_UTC[region]
  const { year, month, day } = datePartsInTimeZone(apiUnixSeconds * 1000, API_SOURCE_TIME_ZONE)
  return Math.floor(Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0) / 1000)
}

function regionalPhaseTimes(apiStart, apiEnd, region) {
  const regionalStart = adjustBannerTimestampForRegion(apiStart, region)
  return { regionalStart, regionalEnd: regionalStart + (apiEnd - apiStart) }
}

function isCharacterEventWish(banner) {
  return String(banner.name || '')
    .toLowerCase()
    .includes('character event wish')
}

function fiveStarNames(banners) {
  const names = []
  for (const banner of banners) {
    for (const character of banner.characters || []) {
      if (character.rarity === 5 && !names.includes(character.name)) {
        names.push(character.name)
      }
    }
  }
  return names
}

function phaseLengthDays(start, end) {
  const seconds = end - start
  if (!(seconds > 0)) return TYPICAL_BANNER_PHASE_DAYS
  return Math.max(1, Math.round(seconds / (24 * 60 * 60)))
}

function scheduleFromCalendar(data, fromMs, region) {
  const nowSec = fromMs / 1000
  const characterBanners = (data.banners || []).filter(isCharacterEventWish)
  if (characterBanners.length === 0) return null

  const phases = new Map()
  for (const banner of characterBanners) {
    const key = `${banner.start_time}:${banner.end_time}`
    if (!phases.has(key)) phases.set(key, [])
    phases.get(key).push(banner)
  }
  const phaseList = [...phases.values()]

  let selectedPhase = null
  let phaseStartedInRegion = false
  let nextChangeAt = 0
  let currentPhaseStartAt = 0

  for (const phase of phaseList) {
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

  if (!selectedPhase) {
    const asiaActive = phaseList.find((phase) => {
      const banner = phase[0]
      return banner.start_time <= nowSec && banner.end_time > nowSec
    })
    if (asiaActive) {
      const { regionalStart } = regionalPhaseTimes(
        asiaActive[0].start_time,
        asiaActive[0].end_time,
        region,
      )
      if (regionalStart > nowSec) {
        selectedPhase = asiaActive
        phaseStartedInRegion = false
        nextChangeAt = regionalStart
        currentPhaseStartAt =
          regionalStart - (asiaActive[0].end_time - asiaActive[0].start_time)
      }
    }
  }

  if (!selectedPhase) return null

  const upcomingFiveStars = fiveStarNames(selectedPhase)
  return {
    nextChangeAt,
    currentPhaseStartAt,
    phaseLengthDays: phaseLengthDays(selectedPhase[0].start_time, selectedPhase[0].end_time),
    featuredFiveStars: phaseStartedInRegion ? upcomingFiveStars : [],
    upcomingFiveStars,
    phaseStartedInRegion,
    region,
    version: selectedPhase[0].version || '',
  }
}

export async function loadBannerSchedule(region = 'america') {
  const response = await fetch(BANNER_CALENDAR_URL)
  if (!response.ok) return null
  const data = await response.json()
  return scheduleFromCalendar(data, Date.now(), region)
}

export function formatCountdownShort(schedule, fromMs = Date.now()) {
  const totalMs = Math.max(0, schedule.nextChangeAt * 1000 - fromMs)
  if (totalMs <= 0) return 'Banner changing now'
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  const minute = 60 * 1000
  const days = Math.floor(totalMs / day)
  const hours = Math.floor((totalMs % day) / hour)
  const minutes = Math.floor((totalMs % hour) / minute)
  if (days > 0) return `Ends in ${days}d ${hours}h`
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`
  return `Ends in ${minutes}m`
}

export function featuredLine(schedule) {
  const names = schedule.phaseStartedInRegion
    ? schedule.featuredFiveStars
    : schedule.upcomingFiveStars
  if (!names.length) return 'Character Event Wish'
  return names.join(' · ')
}

export function shareDescription(schedule) {
  const names = featuredLine(schedule)
  const countdown = formatCountdownShort(schedule)
  const prefix = schedule.phaseStartedInRegion ? names : `Up next: ${names}`
  return `${prefix} — ${countdown}. Track pity and banner timers on False Moon's Reckoning.`
}
