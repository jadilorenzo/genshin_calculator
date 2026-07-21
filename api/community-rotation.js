import {
  characterIdsFromDoc,
  json,
  mapRotationRow,
  optionalUserId,
  requireUserId,
  supabaseAdmin,
} from './_authDb.js'

function idFrom(request) {
  return new URL(request.url).searchParams.get('id')
}

/** GET/PUT/DELETE one rotation via ?id= */
export async function GET(request) {
  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = idFrom(request)
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  const { data, error } = await db
    .from('community_rotations')
    .select(
      'id, author_id, author_name, title, description, doc, character_ids, likes_count, comments_count, created_at, updated_at',
    )
    .eq('id', rotationId)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Not found' }, 404)

  const userId = await optionalUserId(request)
  let likedByMe = false
  if (userId) {
    const { data: like } = await db
      .from('community_rotation_likes')
      .select('rotation_id')
      .eq('rotation_id', data.id)
      .eq('user_id', userId)
      .maybeSingle()
    likedByMe = Boolean(like)
  }

  return json({ item: mapRotationRow(data, { likedByMe }) })
}

export async function PUT(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = idFrom(request)
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { data: existing, error: loadError } = await db
    .from('community_rotations')
    .select('id, author_id')
    .eq('id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.author_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const patch = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) return json({ error: 'Title is required' }, 400)
    patch.title = title.slice(0, 120)
  }
  if (typeof body?.description === 'string') {
    patch.description = body.description.trim().slice(0, 500)
  }
  if (typeof body?.authorName === 'string') {
    patch.author_name = body.authorName.trim().slice(0, 80) || 'Traveler'
  }
  if (body?.doc && typeof body.doc === 'object' && !Array.isArray(body.doc)) {
    if (!Array.isArray(body.doc.placements) || body.doc.placements.length === 0) {
      return json({ error: 'Add at least one character before saving' }, 400)
    }
    patch.doc = body.doc
    patch.character_ids = characterIdsFromDoc(body.doc)
  }

  const { data, error } = await db
    .from('community_rotations')
    .update(patch)
    .eq('id', rotationId)
    .select(
      'id, author_id, author_name, title, description, doc, character_ids, likes_count, comments_count, created_at, updated_at',
    )
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ item: mapRotationRow(data) })
}

export async function DELETE(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = idFrom(request)
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  const { data: existing, error: loadError } = await db
    .from('community_rotations')
    .select('id, author_id')
    .eq('id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.author_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const { error } = await db
    .from('community_rotations')
    .delete()
    .eq('id', rotationId)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}
