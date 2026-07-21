import {
  featuredLine,
  formatCountdownShort,
  loadBannerSchedule,
  shareDescription,
} from './_bannerShare.js'

const SITE_ORIGIN = 'https://falsemoon.vercel.app'
const SITE_NAME = "False Moon's Reckoning"

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** HTML shell with fresh Open Graph tags so Discord/Twitter scrapers see live countdown copy. */
export async function GET(request) {
  const url = new URL(request.url, SITE_ORIGIN)
  const regionParam = url.searchParams.get('region')
  const region =
    regionParam === 'asia' || regionParam === 'europe' || regionParam === 'america'
      ? regionParam
      : 'america'

  let title = `Genshin Banner Countdown · ${SITE_NAME}`
  let description =
    'Live character banner countdown by server region — track when the current phase ends.'
  let ogImage = `${SITE_ORIGIN}/og.png`

  try {
    const schedule = await loadBannerSchedule(region)
    if (schedule) {
      const countdown = formatCountdownShort(schedule)
      const featured = featuredLine(schedule)
      title = `${countdown} · ${featured} · ${SITE_NAME}`
      description = shareDescription(schedule)
    }
  } catch {
    // Keep defaults.
  }

  const canonical = `${SITE_ORIGIN}/banners/countdown`
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta http-equiv="refresh" content="0;url=${canonical}" />
</head>
<body>
  <p><a href="${canonical}">${escapeHtml(SITE_NAME)} — Banner countdown</a></p>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
