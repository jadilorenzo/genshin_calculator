import { next, rewrite } from '@vercel/edge'

const BOT_UA =
  /bot|crawl|slurp|spider|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|linkedinbot|whatsapp|telegram|embedly|quora|pinterest|redditbot|vkshare|w3c_validator/i

export const config = {
  matcher: ['/banners/countdown', '/pulls/countdown'],
}

/** Serve live Open Graph HTML to link scrapers; humans get the SPA. */
export default function middleware(request: Request) {
  const ua = request.headers.get('user-agent') ?? ''
  if (!BOT_UA.test(ua)) return next()
  return rewrite(new URL('/api/countdown-share', request.url))
}
