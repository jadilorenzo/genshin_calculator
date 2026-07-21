import { ImageResponse } from '@vercel/og'
import icons from './characterIcons.json'
import {
  featuredLine,
  formatCountdownShort,
  loadBannerSchedule,
} from './bannerShare'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const regionParam = url.searchParams.get('region')
  const region =
    regionParam === 'asia' || regionParam === 'europe' || regionParam === 'america'
      ? regionParam
      : 'america'

  let title = 'Banner countdown'
  let subtitle = 'Live character-event phase timer'
  let names: string[] = []
  let countdown = 'Check live timers'
  let version = ''

  try {
    const schedule = await loadBannerSchedule(region)
    if (schedule) {
      names = schedule.phaseStartedInRegion
        ? schedule.featuredFiveStars
        : schedule.upcomingFiveStars
      title = schedule.phaseStartedInRegion ? 'Current banner' : 'Banner change soon'
      subtitle = featuredLine(schedule)
      countdown = formatCountdownShort(schedule)
      version = schedule.version ? `v${schedule.version}` : ''
    }
  } catch {
    // Fall through to defaults.
  }

  const portraits = names
    .map((name) => ({ name, src: (icons as Record<string, string>)[name] }))
    .filter((entry) => Boolean(entry.src))
    .slice(0, 2)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(155deg, #262833 0%, #1b1d24 48%, #12141a 100%)',
          color: '#ece5d8',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#9aa3b5',
            }}
          >
            False Moon&apos;s Reckoning
          </div>
          <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, lineHeight: 1.05 }}>
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#d3bc8e' }}>{subtitle}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 20 }}>
            {portraits.map((portrait) => (
              <div
                key={portrait.name}
                style={{
                  display: 'flex',
                  width: 168,
                  height: 168,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '2px solid rgba(211,188,142,0.35)',
                  background: '#14151c',
                }}
              >
                <img
                  src={portrait.src}
                  alt=""
                  width={168}
                  height={168}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 48,
                fontWeight: 700,
                color: '#f0d078',
                lineHeight: 1,
              }}
            >
              {countdown}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: '#9aa3b5' }}>
              {version ? `${version} · ` : ''}
              {region === 'america' ? 'Americas' : region === 'europe' ? 'Europe' : 'Asia'}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
