/** Redirect legacy /api/og requests to the static site screenshot. */
export function GET() {
  return Response.redirect('https://falsemoon.vercel.app/og.png', 302)
}
