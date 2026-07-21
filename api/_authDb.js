import { verifyToken } from '@clerk/backend'
import { createClient as createSupabase } from '@supabase/supabase-js'

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function getBearer(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabase(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Optional auth — returns userId or null. */
export async function optionalUserId(request) {
  const token = getBearer(request)
  if (!token) return null
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  try {
    const payload = await verifyToken(token, { secretKey })
    return payload.sub || null
  } catch {
    return null
  }
}

/** Required auth — { userId } or { error: Response }. */
export async function requireUserId(request) {
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

export function characterIdsFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return []
  const placements = Array.isArray(doc.placements) ? doc.placements : []
  const ids = []
  const seen = new Set()
  for (const p of placements) {
    const id = typeof p?.characterId === 'string' ? p.characterId : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function mapRotationRow(row, { likedByMe = false } = {}) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || 'Anonymous',
    title: row.title,
    description: row.description || '',
    doc: row.doc,
    characterIds: row.character_ids || [],
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    createdAt: row.updated_at || row.created_at,
    updatedAt: row.updated_at,
    likedByMe,
  }
}
