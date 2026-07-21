import { verifyToken } from '@clerk/backend'
import { createClient as createSupabase } from '@supabase/supabase-js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function getBearer(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabase(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function requireUserId(request) {
  const token = getBearer(request)
  if (!token) return { error: json({ error: 'Unauthorized' }, 401) }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return { error: json({ error: 'Clerk is not configured' }, 503) }

  try {
    const payload = await verifyToken(token, { secretKey })
    const userId = payload.sub
    if (!userId) return { error: json({ error: 'Unauthorized' }, 401) }
    return { userId }
  } catch {
    return { error: json({ error: 'Unauthorized' }, 401) }
  }
}

export async function GET(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const { data, error } = await db
    .from('user_app_data')
    .select('data, updated_at')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)

  return json({
    data: data?.data && typeof data.data === 'object' ? data.data : {},
    updatedAt: data?.updated_at ?? null,
  })
}

export async function PUT(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const payload = body?.data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Expected { data: object }' }, 400)
  }

  const updatedAt = new Date().toISOString()
  const { error } = await db.from('user_app_data').upsert(
    {
      user_id: auth.userId,
      data: payload,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' },
  )

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, updatedAt })
}
