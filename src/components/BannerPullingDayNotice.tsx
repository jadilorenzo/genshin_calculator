import { NavLink, useLocation } from 'react-router-dom'
import { useBannerSchedule } from '../hooks/useBannerSchedule.ts'
import { pullingDayNoticeKind } from '../model/bannerSchedule.ts'

export function BannerPullingDayNotice() {
  const location = useLocation()
  const { schedule, status } = useBannerSchedule()

  if (location.pathname.includes('/pulls/day')) return null
  if (status !== 'ready' || !schedule) return null

  const kind = pullingDayNoticeKind(schedule)
  if (!kind) return null

  const featured =
    schedule.featuredFiveStars.length > 0
      ? schedule.featuredFiveStars.join(' / ')
      : 'Character banner'

  const copy =
    kind === 'before'
      ? schedule.daysUntilNext <= 1
        ? `Banner changes soon${featured ? ` (${featured})` : ''}. Log pulls live on Pulling day.`
        : `Banner changes in ${schedule.daysUntilNext} days${featured ? ` (${featured})` : ''}. Plan with Pulling day.`
      : `${featured} banner just starting… Track pity live on Pulling day.`

  return (
    <aside className="banner-pulling-day-notice" aria-label="Banner reminder">
      <p>{copy}</p>
      <NavLink to="/pulls/day" className="chip compact">
        Pulling day →
      </NavLink>
    </aside>
  )
}
