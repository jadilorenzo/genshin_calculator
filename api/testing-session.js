import { json, requireUserId, supabaseAdmin } from './_authDb.js'
import {
  mapTestingRunRow,
  mapTestingSessionRow,
  TESTING_BUCKET,
} from './_testingDb.js'

function compareRunRows(a, b) {
  const timeA = a.captured_at || a.created_at || ''
  const timeB = b.captured_at || b.created_at || ''
  const byTime = String(timeA).localeCompare(String(timeB))
  if (byTime !== 0) return byTime
  const orderA = a.sort_order ?? 0
  const orderB = b.sort_order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return String(a.created_at || '').localeCompare(String(b.created_at || ''))
}

function idFrom(request) {
  return new URL(request.url).searchParams.get('id')
}

async function signedUrlFor(db, storagePath) {
  if (!storagePath) return null
  const { data, error } = await db.storage
    .from(TESTING_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error) return null
  return data?.signedUrl || null
}

/** GET session + runs · PUT meta · DELETE session */
export async function GET(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const sessionId = idFrom(request)
  if (!sessionId) return json({ error: 'Missing id' }, 400)

  const { data: session, error } = await db
    .from('testing_sessions')
    .select(
      'id, owner_id, title, notes, linked_rotation_id, created_at, updated_at',
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!session) return json({ error: 'Not found' }, 404)
  if (session.owner_id !== auth.userId) {
    return json({ error: 'Not found' }, 404)
  }

  const { data: runs, error: runsError } = await db
    .from('testing_runs')
    .select(
      'id, session_id, owner_id, sort_order, storage_path, main_dps_id, dps, total_damage, elapsed_seconds, strongest_hit, captured_at, characters, ocr_raw, created_at, updated_at',
    )
    .eq('session_id', sessionId)

  if (runsError) return json({ error: runsError.message }, 500)

  const orderedRuns = [...(runs || [])].sort(compareRunRows)
  const mappedRuns = []
  for (const row of orderedRuns) {
    const imageUrl = await signedUrlFor(db, row.storage_path)
    mappedRuns.push(mapTestingRunRow(row, { imageUrl }))
  }

  return json({
    item: mapTestingSessionRow(session, { runsCount: mappedRuns.length }),
    runs: mappedRuns,
  })
}

export async function PUT(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const sessionId = idFrom(request)
  if (!sessionId) return json({ error: 'Missing id' }, 400)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { data: existing, error: loadError } = await db
    .from('testing_sessions')
    .select('id, owner_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.owner_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const patch = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) return json({ error: 'Title is required' }, 400)
    patch.title = title.slice(0, 120)
  }
  if (typeof body?.notes === 'string') {
    patch.notes = body.notes.trim().slice(0, 2000)
  }

  const { data, error } = await db
    .from('testing_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select(
      'id, owner_id, title, notes, linked_rotation_id, created_at, updated_at',
    )
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ item: mapTestingSessionRow(data) })
}

export async function DELETE(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const sessionId = idFrom(request)
  if (!sessionId) return json({ error: 'Missing id' }, 400)

  const { data: existing, error: loadError } = await db
    .from('testing_sessions')
    .select('id, owner_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.owner_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const { data: runs } = await db
    .from('testing_runs')
    .select('storage_path')
    .eq('session_id', sessionId)

  const paths = (runs || [])
    .map((r) => r.storage_path)
    .filter((p) => typeof p === 'string' && p.length > 0)
  if (paths.length) {
    await db.storage.from(TESTING_BUCKET).remove(paths)
  }

  const { error } = await db
    .from('testing_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}
