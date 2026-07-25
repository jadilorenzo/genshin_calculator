import { json, requireUserId, supabaseAdmin } from './_authDb.js'
import {
  decodeBase64Image,
  mapTestingRunRow,
  TESTING_BUCKET,
  TESTING_MAX_RUNS,
} from './_testingDb.js'

function normalizeCharacters(raw) {
  if (!Array.isArray(raw)) return []
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

/** POST create run (optional base64 image) */
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

  const sessionId =
    typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) return json({ error: 'Missing sessionId' }, 400)

  const { data: session, error: sessionError } = await db
    .from('testing_sessions')
    .select('id, owner_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) return json({ error: sessionError.message }, 500)
  if (!session) return json({ error: 'Session not found' }, 404)
  if (session.owner_id !== auth.userId) {
    return json({ error: 'Forbidden' }, 403)
  }

  const { count, error: countError } = await db
    .from('testing_runs')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  if (countError) return json({ error: countError.message }, 500)
  if ((count ?? 0) >= TESTING_MAX_RUNS) {
    return json(
      { error: `At most ${TESTING_MAX_RUNS} runs per session` },
      400,
    )
  }

  const sortOrder =
    Number.isFinite(body?.sortOrder) && body.sortOrder >= 0
      ? Math.floor(body.sortOrder)
      : count ?? 0

  const runId = crypto.randomUUID()
  let storagePath = ''
  let imageUrl = null

  if (typeof body?.imageBase64 === 'string' && body.imageBase64.trim()) {
    const decoded = decodeBase64Image(body.imageBase64)
    if (!decoded || !decoded.buffer.length) {
      return json({ error: 'Invalid image data' }, 400)
    }
    if (decoded.buffer.length > 8 * 1024 * 1024) {
      return json({ error: 'Image too large (max 8MB)' }, 400)
    }
    const ext = decoded.mimeType.includes('png')
      ? 'png'
      : decoded.mimeType.includes('jpeg') || decoded.mimeType.includes('jpg')
        ? 'jpg'
        : 'webp'
    storagePath = `${auth.userId}/${sessionId}/${runId}.${ext}`
    const { error: uploadError } = await db.storage
      .from(TESTING_BUCKET)
      .upload(storagePath, decoded.buffer, {
        contentType: decoded.mimeType,
        upsert: false,
      })
    if (uploadError) {
      return json({ error: uploadError.message }, 500)
    }
    const { data: signed } = await db.storage
      .from(TESTING_BUCKET)
      .createSignedUrl(storagePath, 60 * 60)
    imageUrl = signed?.signedUrl || null
  }

  const row = {
    id: runId,
    session_id: sessionId,
    owner_id: auth.userId,
    sort_order: sortOrder,
    storage_path: storagePath,
    main_dps_id:
      typeof body?.mainDpsId === 'string' ? body.mainDpsId.slice(0, 80) : '',
    dps: optionalNumber(body?.dps),
    total_damage: optionalNumber(body?.totalDamage),
    elapsed_seconds: optionalNumber(body?.elapsedSeconds),
    strongest_hit: optionalNumber(body?.strongestHit),
    captured_at: optionalCapturedAt(body?.capturedAt),
    characters: normalizeCharacters(body?.characters),
    ocr_raw: typeof body?.ocrRaw === 'string' ? body.ocrRaw.slice(0, 20000) : '',
  }

  const { data, error } = await db
    .from('testing_runs')
    .insert(row)
    .select(
      'id, session_id, owner_id, sort_order, storage_path, main_dps_id, dps, total_damage, elapsed_seconds, strongest_hit, captured_at, characters, ocr_raw, created_at, updated_at',
    )
    .single()

  if (error) {
    if (storagePath) {
      await db.storage.from(TESTING_BUCKET).remove([storagePath])
    }
    return json({ error: error.message }, 500)
  }

  await db
    .from('testing_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  return json({ item: mapTestingRunRow(data, { imageUrl }) }, 201)
}
