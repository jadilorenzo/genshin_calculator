/** Absolute site origin for Open Graph / share links. */
export const SITE_ORIGIN = 'https://falsemoon.vercel.app'

export const SITE_NAME = "False Moon's Reckoning"

export const DEFAULT_OG_DESCRIPTION =
  'Wish pity, artifact odds, build pacing, rotation buff timelines, and live banner countdown for Genshin Impact.'

export function ogImageUrl(path = '/api/og'): string {
  return `${SITE_ORIGIN}${path}`
}
