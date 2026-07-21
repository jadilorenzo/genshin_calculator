import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useBannerRegion } from '../../hooks/useBannerRegion.tsx'
import { useBannerSchedule } from '../../hooks/useBannerSchedule.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  BANNER_REGION_OPTIONS,
  countdownToTimestamp,
  formatBannerDateTime,
  isNearBannerDate,
  type CountdownParts,
} from '../../model/bannerSchedule.ts'
import { SITE_ORIGIN } from '../../siteMeta.ts'
import { BannerFeaturedRoster } from './BannerFeaturedRoster.tsx'

function CountdownDisplay({ parts }: { parts: CountdownParts }) {
  const units: { label: string; value: number }[] = [
    { label: 'd', value: parts.days },
    { label: 'h', value: parts.hours },
    { label: 'm', value: parts.minutes },
    { label: 's', value: parts.seconds },
  ]

  return (
    <div className="banner-countdown-digits" aria-live="polite">
      {units.map(({ label, value }) => (
        <div key={label} className="banner-countdown-unit">
          <span className="banner-countdown-value">{value}</span>
          <span className="banner-countdown-label">{label}</span>
        </div>
      ))}
    </div>
  )
}

export default function BannerCountdownPage() {
  useDocumentTitle(PAGE_TITLES.bannerCountdown)
  const [region, setRegion] = useBannerRegion()
  const { schedule, status, error, refresh } = useBannerSchedule()
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const { nextEnd, afterNextEnd } = useMemo(() => {
    if (!schedule) return { nextEnd: null, afterNextEnd: null }
    return {
      nextEnd: countdownToTimestamp(schedule.nextChangeAt, now),
      afterNextEnd: countdownToTimestamp(
        schedule.nextChangeAt + schedule.phaseLengthDays * 24 * 60 * 60,
        now,
      ),
    }
  }, [schedule, now])

  const regionNote = BANNER_REGION_OPTIONS.find((option) => option.id === region)?.note
  const shareUrl = `${SITE_ORIGIN}/pulls/countdown`

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard failures.
    }
  }

  return (
    <section className="pace-panel pace-panel-tab banner-countdown" aria-label="Banner countdown">
      <div className="field">
        <div className="hero-top">
          <span className="label" id="banner-region-label">
            Server region
          </span>
          <button type="button" className="chip compact" onClick={copyShareLink}>
            {copied ? 'Link copied' : 'Copy share link'}
          </button>
        </div>
        <div className="chip-row wrap" role="group" aria-labelledby="banner-region-label">
          {BANNER_REGION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={region === option.id ? 'chip active' : 'chip'}
              aria-pressed={region === option.id}
              onClick={() => setRegion(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {regionNote ? <p className="field-note">{regionNote}</p> : null}
      </div>

      {status === 'loading' ? (
        <p className="field-note">Loading…</p>
      ) : null}

      {status === 'error' ? (
        <div className="field">
          <p className="field-note">{error ?? 'Could not load banner schedule.'}</p>
          <button type="button" className="chip compact" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : null}

      {schedule && nextEnd && afterNextEnd ? (
        <>
          <div className="banner-countdown-grid">
            <article className="banner-countdown-card">
              <p className="label">
                {schedule.phaseStartedInRegion ? 'Current banner ends' : 'Banner change'}
              </p>
              <CountdownDisplay key={region} parts={nextEnd} />
              <p className="field-note">
                {schedule.version ? `v${schedule.version} · ` : ''}
                {formatBannerDateTime(schedule.nextChangeAt)}
              </p>
            </article>

            <article className="banner-countdown-card">
              <p className="label">Banner after next</p>
              <p className="banner-countdown-featured muted">
                +{schedule.phaseLengthDays}d phase
              </p>
              <CountdownDisplay key={`${region}-after`} parts={afterNextEnd} />
              <p className="field-note">
                Est.{' '}
                {formatBannerDateTime(
                  schedule.nextChangeAt + schedule.phaseLengthDays * 24 * 60 * 60,
                )}
              </p>
            </article>
          </div>

          <BannerFeaturedRoster
            characters={schedule.phaseCharacters}
            upcoming={!schedule.phaseStartedInRegion}
          />

          {isNearBannerDate(schedule, now) ? (
            <p className="banner-countdown-near">
              <NavLink to="/pulls/day">Track pulls on Pulling day →</NavLink>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
