import { NavLink, useLocation } from 'react-router-dom'
import { useBannerSchedule } from '../hooks/useBannerSchedule.ts'
import { pullingDayNoticeKind } from '../model/bannerSchedule.ts'

export function BannerPullingDayNotice() {
  const location = useLocation()
  const { schedule, status } = useBannerSchedule()

  if (location.pathname.includes('/banners/day') || location.pathname.includes('/pulls/day'))
    return null
  if (status !== 'ready' || !schedule) return null

  const kind = pullingDayNoticeKind(schedule)
  if (!kind) return null

  const featured =
    schedule.featuredFiveStars.length > 0
      ? schedule.featuredFiveStars.join(' / ')
      : schedule.upcomingFiveStars.length > 0
        ? schedule.upcomingFiveStars.join(' / ')
        : 'Character banner'

  const copy =
    kind === 'before'
      ? schedule.phaseStartedInRegion
        ? schedule.daysUntilNext <= 1
          ? `Banner changes soon${featured ? ` (${featured})` : ''}. Log pulls live on Pulling day.`
          : `Banner changes in ${schedule.daysUntilNext} days${featured ? ` (${featured})` : ''}. Plan with Pulling day.`
        : schedule.daysUntilNext <= 1
          ? `Banner change soon in your region${featured ? ` — up next: ${featured}` : ''}. Log pulls live on Pulling day.`
          : `Banner change in ${schedule.daysUntilNext} days in your region${featured ? ` — up next: ${featured}` : ''}. Plan with Pulling day.`
      : schedule.phaseStartedInRegion
        ? `${featured} banner just starting… Track pity live on Pulling day.`
        : `${featured ? `${featured} ` : ''}banner starting in your region… Track pity live on Pulling day.`

  return (
    <aside className="banner-pulling-day-notice" aria-label="Banner reminder">
      <p>{copy}</p>
      <NavLink to="/banners/day" className="chip compact">
        Pulling day →
      </NavLink>
    </aside>
  )
}
