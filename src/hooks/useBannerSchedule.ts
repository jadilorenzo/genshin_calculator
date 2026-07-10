import { useEffect, useState } from 'react'
import {
  fetchBannerSchedule,
  type BannerSchedule,
} from '../model/bannerSchedule.ts'

export type BannerScheduleStatus = 'loading' | 'ready' | 'error'

export function useBannerSchedule(): {
  schedule: BannerSchedule | null
  status: BannerScheduleStatus
  error: string | null
  refresh: () => void
} {
  const [schedule, setSchedule] = useState<BannerSchedule | null>(null)
  const [status, setStatus] = useState<BannerScheduleStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    fetchBannerSchedule()
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setSchedule(null)
          setStatus('error')
          setError('No active character banner found')
          return
        }
        setSchedule(result)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSchedule(null)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to load banner schedule')
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return {
    schedule,
    status,
    error,
    refresh: () => setTick((n) => n + 1),
  }
}
