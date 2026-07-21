import { useEffect, useMemo, useState } from 'react'
import {
  fetchBannerCalendar,
  scheduleFromCalendar,
  type BannerCalendarData,
  type BannerSchedule,
} from '../model/bannerSchedule.ts'
import { useBannerRegion } from './useBannerRegion.tsx'

export type BannerScheduleStatus = 'loading' | 'ready' | 'error'

export function useBannerSchedule(): {
  schedule: BannerSchedule | null
  status: BannerScheduleStatus
  error: string | null
  refresh: () => void
} {
  const [region] = useBannerRegion()
  const [calendar, setCalendar] = useState<BannerCalendarData | null>(null)
  const [status, setStatus] = useState<BannerScheduleStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    fetchBannerCalendar()
      .then((data) => {
        if (cancelled) return
        setCalendar(data)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setCalendar(null)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to load banner schedule')
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const schedule = useMemo(() => {
    if (!calendar) return null
    return scheduleFromCalendar(calendar, Date.now(), region)
  }, [calendar, region])

  return {
    schedule,
    status: status === 'ready' && !schedule ? 'error' : status,
    error:
      status === 'ready' && !schedule
        ? 'No active character banner found'
        : error,
    refresh: () => setTick((n) => n + 1),
  }
}
