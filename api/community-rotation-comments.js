import { json, requireUserId, supabaseAdmin } from './_authDb.js'

function rotationIdFrom(request) {
  return new URL(request.url).searchParams.get('id')
}

function commentIdFrom(request) {
  return new URL(request.url).searchParams.get('commentId')
}

/** GET list · POST create · PUT update · DELETE · ?id=rotation · ?commentId= */
export async function GET(request) {
  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = rotationIdFrom(request)
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  const { data, error } = await db
    .from('community_rotation_comments')
    .select('id, author_id, author_name, body, created_at')
    .eq('rotation_id', rotationId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return json({ error: error.message }, 500)

  return json({
    items: (data || []).map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: row.author_name || 'Traveler',
      body: row.body,
      createdAt: row.created_at,
    })),
  })
}

export async function POST(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = rotationIdFrom(request)
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  const authorName =
    typeof body?.authorName === 'string' ? body.authorName.trim() : ''
  if (!text) return json({ error: 'Comment cannot be empty' }, 400)
  if (text.length > 1000) return json({ error: 'Comment is too long' }, 400)

  const { data: existing, error: loadError } = await db
    .from('community_rotations')
    .select('id, comments_count')
    .eq('id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)

  const { data, error } = await db
    .from('community_rotation_comments')
    .insert({
      rotation_id: rotationId,
      author_id: auth.userId,
      author_name: authorName || 'Traveler',
      body: text,
    })
    .select('id, author_id, author_name, body, created_at')
    .single()

  if (error) return json({ error: error.message }, 500)

  const nextCount = (existing.comments_count ?? 0) + 1
  await db
    .from('community_rotations')
    .update({ comments_count: nextCount })
    .eq('id', rotationId)

  return json(
    {
      item: {
        id: data.id,
        authorId: data.author_id,
        authorName: data.author_name || 'Traveler',
        body: data.body,
        createdAt: data.created_at,
      },
      commentsCount: nextCount,
    },
    201,
  )
}

export async function PUT(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = rotationIdFrom(request)
  const commentId = commentIdFrom(request)
  if (!rotationId || !commentId) {
    return json({ error: 'Missing id or commentId' }, 400)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (!text) return json({ error: 'Comment cannot be empty' }, 400)
  if (text.length > 1000) return json({ error: 'Comment is too long' }, 400)

  const { data: existing, error: loadError } = await db
    .from('community_rotation_comments')
    .select('id, author_id, author_name, body, created_at')
    .eq('id', commentId)
    .eq('rotation_id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.author_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const { data, error } = await db
    .from('community_rotation_comments')
    .update({ body: text })
    .eq('id', commentId)
    .eq('rotation_id', rotationId)
    .select('id, author_id, author_name, body, created_at')
    .single()

  if (error) return json({ error: error.message }, 500)

  return json({
    item: {
      id: data.id,
      authorId: data.author_id,
      authorName: data.author_name || 'Traveler',
      body: data.body,
      createdAt: data.created_at,
    },
  })
}

export async function DELETE(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = rotationIdFrom(request)
  const commentId = commentIdFrom(request)
  if (!rotationId || !commentId) {
    return json({ error: 'Missing id or commentId' }, 400)
  }

  const { data: existing, error: loadError } = await db
    .from('community_rotation_comments')
    .select('id, author_id')
    .eq('id', commentId)
    .eq('rotation_id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.author_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const { data: rotation, error: rotationError } = await db
    .from('community_rotations')
    .select('id, comments_count')
    .eq('id', rotationId)
    .maybeSingle()

  if (rotationError) return json({ error: rotationError.message }, 500)
  if (!rotation) return json({ error: 'Not found' }, 404)

  const { error } = await db
    .from('community_rotation_comments')
    .delete()
    .eq('id', commentId)
    .eq('rotation_id', rotationId)

  if (error) return json({ error: error.message }, 500)

  const nextCount = Math.max(0, (rotation.comments_count ?? 0) - 1)
  await db
    .from('community_rotations')
    .update({ comments_count: nextCount })
    .eq('id', rotationId)

  return json({ ok: true, commentsCount: nextCount })
}
