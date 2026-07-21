import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from '@vercel/og'
import {
  featuredLine,
  formatCountdownShort,
  loadBannerSchedule,
} from './_bannerShare.js'

const icons = JSON.parse(
  readFileSync(join(process.cwd(), 'api/_characterIcons.json'), 'utf8'),
)

function el(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.length <= 1 ? children[0] : children,
    },
  }
}

export async function GET(request) {
  const url = new URL(request.url, 'https://falsemoon.vercel.app')
  const regionParam = url.searchParams.get('region')
  const region =
    regionParam === 'asia' || regionParam === 'europe' || regionParam === 'america'
      ? regionParam
      : 'america'

  let title = 'Banner countdown'
  let subtitle = 'Live character-event phase timer'
  let names = []
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
    .map((name) => ({ name, src: icons[name] }))
    .filter((entry) => Boolean(entry.src))
    .slice(0, 2)

  const regionLabel =
    region === 'america' ? 'Americas' : region === 'europe' ? 'Europe' : 'Asia'

  return new ImageResponse(
    el(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(155deg, #262833 0%, #1b1d24 48%, #12141a 100%)',
          color: '#ece5d8',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        },
      },
      el(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        el(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#9aa3b5',
            },
          },
          "False Moon's Reckoning",
        ),
        el(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.05,
            },
          },
          title,
        ),
        el('div', { style: { display: 'flex', fontSize: 30, color: '#d3bc8e' } }, subtitle),
      ),
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          },
        },
        el(
          'div',
          { style: { display: 'flex', gap: 20 } },
          ...portraits.map((portrait) =>
            el(
              'div',
              {
                key: portrait.name,
                style: {
                  display: 'flex',
                  width: 168,
                  height: 168,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '2px solid rgba(211,188,142,0.35)',
                  background: '#14151c',
                },
              },
              el('img', {
                src: portrait.src,
                width: 168,
                height: 168,
                style: { objectFit: 'cover' },
              }),
            ),
          ),
        ),
        el(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            },
          },
          el(
            'div',
            {
              style: {
                display: 'flex',
                fontSize: 48,
                fontWeight: 700,
                color: '#f0d078',
                lineHeight: 1,
              },
            },
            countdown,
          ),
          el(
            'div',
            { style: { display: 'flex', fontSize: 22, color: '#9aa3b5' } },
            `${version ? `${version} · ` : ''}${regionLabel}`,
          ),
        ),
      ),
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
