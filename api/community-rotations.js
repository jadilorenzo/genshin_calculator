import {
  characterIdsFromDoc,
  hasIsPublicColumn,
  json,
  mapRotationRow,
  optionalUserId,
  requireUserId,
  resolveRotationSelect,
  supabaseAdmin,
} from './_authDb.js'

const PAGE_SIZE = 12

/** GET list (page, sort, mine) · POST create */
export async function GET(request) {
  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1)
  const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'popular'
  const mine = url.searchParams.get('mine') === '1'
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let userId = null
  if (mine) {
    const auth = await requireUserId(request)
    if (auth.error) return auth.error
    userId = auth.userId
  } else {
    userId = await optionalUserId(request)
  }

  const select = await resolveRotationSelect(db)
  let query = db.from('community_rotations').select(select, { count: 'exact' })

  if (mine) {
    query = query.eq('author_id', userId)
  } else if (hasIsPublicColumn()) {
    query = query.eq('is_public', true)
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
  }

  const { data, error, count } = await query.range(from, to)
  if (error) return json({ error: error.message }, 500)

  let liked = new Set()
  if (userId && data?.length) {
    const ids = data.map((r) => r.id)
    const { data: likes } = await db
      .from('community_rotation_likes')
      .select('rotation_id')
      .eq('user_id', userId)
      .in('rotation_id', ids)
    liked = new Set((likes || []).map((l) => l.rotation_id))
  }

  return json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    sort,
    mine,
    items: (data || []).map((row) =>
      mapRotationRow(row, { likedByMe: liked.has(row.id) }),
    ),
  })
}

export async function POST(request) {
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

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description =
    typeof body?.description === 'string' ? body.description.trim() : ''
  const authorName =
    typeof body?.authorName === 'string' ? body.authorName.trim() : ''
  const doc = body?.doc
  const isPublic = body?.isPublic !== false

  if (!title) return json({ error: 'Title is required' }, 400)
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return json({ error: 'Expected rotation doc object' }, 400)
  }
  if (!Array.isArray(doc.placements) || doc.placements.length === 0) {
    return json({ error: 'Add at least one character before saving' }, 400)
  }

  const select = await resolveRotationSelect(db)
  const now = new Date().toISOString()
  const row = {
    author_id: auth.userId,
    author_name: authorName || 'Traveler',
    title: title.slice(0, 120),
    description: description.slice(0, 500),
    doc,
    character_ids: characterIdsFromDoc(doc),
    updated_at: now,
  }
  if (hasIsPublicColumn()) row.is_public = Boolean(isPublic)

  const { data, error } = await db
    .from('community_rotations')
    .insert(row)
    .select(select)
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ item: mapRotationRow(data) }, 201)
}
