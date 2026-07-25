import { json, requireUserId, supabaseAdmin } from './_authDb.js'
import { mapTestingRunRow, TESTING_BUCKET } from './_testingDb.js'

function idFrom(request) {
  return new URL(request.url).searchParams.get('id')
}

function normalizeCharacters(raw) {
  if (!Array.isArray(raw)) return null
  return raw.slice(0, 4).map((entry, index) => ({
    slot: Number.isFinite(entry?.slot) ? Number(entry.slot) : index,
    characterId:
      typeof entry?.characterId === 'string' ? entry.characterId : '',
    name: typeof entry?.name === 'string' ? entry.name.trim().slice(0, 80) : '',
    damage:
      entry?.damage == null || entry.damage === ''
        ? null
        : Number(entry.damage),
    teamPct:
      entry?.teamPct == null || entry.teamPct === ''
        ? null
        : Number(entry.teamPct),
  }))
}

function optionalNumber(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function optionalCapturedAt(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

async function signedUrlFor(db, storagePath) {
  if (!storagePath) return null
  const { data, error } = await db.storage
    .from(TESTING_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error) return null
  return data?.signedUrl || null
}

/** PUT corrections · DELETE run */
export async function PUT(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const runId = idFrom(request)
  if (!runId) return json({ error: 'Missing id' }, 400)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { data: existing, error: loadError } = await db
    .from('testing_runs')
    .select('id, owner_id, session_id, storage_path')
    .eq('id', runId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.owner_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const patch = { updated_at: new Date().toISOString() }
  if (typeof body?.mainDpsId === 'string') {
    patch.main_dps_id = body.mainDpsId.slice(0, 80)
  }
  if ('dps' in (body || {})) patch.dps = optionalNumber(body.dps)
  if ('totalDamage' in (body || {})) {
    patch.total_damage = optionalNumber(body.totalDamage)
  }
  if ('elapsedSeconds' in (body || {})) {
    patch.elapsed_seconds = optionalNumber(body.elapsedSeconds)
  }
  if ('strongestHit' in (body || {})) {
    patch.strongest_hit = optionalNumber(body.strongestHit)
  }
  if ('capturedAt' in (body || {})) {
    patch.captured_at = optionalCapturedAt(body.capturedAt)
  }
  if ('sortOrder' in (body || {}) && Number.isFinite(body.sortOrder)) {
    patch.sort_order = Math.floor(body.sortOrder)
  }
  const characters = normalizeCharacters(body?.characters)
  if (characters) patch.characters = characters
  if (typeof body?.ocrRaw === 'string') {
    patch.ocr_raw = body.ocrRaw.slice(0, 20000)
  }

  const { data, error } = await db
    .from('testing_runs')
    .update(patch)
    .eq('id', runId)
    .select(
      'id, session_id, owner_id, sort_order, storage_path, main_dps_id, dps, total_damage, elapsed_seconds, strongest_hit, captured_at, characters, ocr_raw, created_at, updated_at',
    )
    .single()

  if (error) return json({ error: error.message }, 500)

  await db
    .from('testing_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', existing.session_id)

  const imageUrl = await signedUrlFor(db, data.storage_path)
  return json({ item: mapTestingRunRow(data, { imageUrl }) })
}

export async function DELETE(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const runId = idFrom(request)
  if (!runId) return json({ error: 'Missing id' }, 400)

  const { data: existing, error: loadError } = await db
    .from('testing_runs')
    .select('id, owner_id, session_id, storage_path')
    .eq('id', runId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)
  if (existing.owner_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  if (existing.storage_path) {
    await db.storage.from(TESTING_BUCKET).remove([existing.storage_path])
  }

  const { error } = await db.from('testing_runs').delete().eq('id', runId)
  if (error) return json({ error: error.message }, 500)

  await db
    .from('testing_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', existing.session_id)

  return json({ ok: true })
}
