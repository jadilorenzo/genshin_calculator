import { json, requireUserId, supabaseAdmin } from './_authDb.js'
import { mapTestingSessionRow } from './_testingDb.js'

const PAGE_SIZE = 12

/** GET list mine · POST create session */
export async function GET(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await db
    .from('testing_sessions')
    .select(
      'id, owner_id, title, notes, linked_rotation_id, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('owner_id', auth.userId)
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) return json({ error: error.message }, 500)

  const ids = (data || []).map((row) => row.id)
  const counts = new Map()
  if (ids.length) {
    const { data: runRows } = await db
      .from('testing_runs')
      .select('session_id')
      .in('session_id', ids)
    for (const row of runRows || []) {
      counts.set(row.session_id, (counts.get(row.session_id) || 0) + 1)
    }
  }

  return json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    items: (data || []).map((row) =>
      mapTestingSessionRow(row, { runsCount: counts.get(row.id) || 0 }),
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
  if (!title) return json({ error: 'Title is required' }, 400)
  const notes =
    typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''

  const { data, error } = await db
    .from('testing_sessions')
    .insert({
      owner_id: auth.userId,
      title: title.slice(0, 120),
      notes,
    })
    .select(
      'id, owner_id, title, notes, linked_rotation_id, created_at, updated_at',
    )
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ item: mapTestingSessionRow(data, { runsCount: 0 }) }, 201)
}
