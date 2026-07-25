import { supabaseAdmin } from './_authDb.js'

export const TESTING_BUCKET = 'personal-testing'
export const TESTING_MAX_RUNS = 40

export function mapTestingSessionRow(row, { runsCount = 0 } = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title || '',
    notes: row.notes || '',
    linkedRotationId: row.linked_rotation_id || null,
    runsCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapTestingRunRow(row, { imageUrl = null } = {}) {
  return {
    id: row.id,
    sessionId: row.session_id,
    ownerId: row.owner_id,
    sortOrder: row.sort_order ?? 0,
    storagePath: row.storage_path || '',
    imageUrl,
    mainDpsId: row.main_dps_id || '',
    dps: row.dps == null ? null : Number(row.dps),
    totalDamage: row.total_damage == null ? null : Number(row.total_damage),
    elapsedSeconds:
      row.elapsed_seconds == null ? null : Number(row.elapsed_seconds),
    strongestHit: row.strongest_hit == null ? null : Number(row.strongest_hit),
    capturedAt: row.captured_at || null,
    characters: Array.isArray(row.characters) ? row.characters : [],
    ocrRaw: row.ocr_raw || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Decode a data URL or raw base64 string to a Buffer + mime type. */
export function decodeBase64Image(input) {
  if (typeof input !== 'string' || !input.trim()) return null
  const trimmed = input.trim()
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s)
  if (match) {
    return {
      mimeType: match[1].trim() || 'image/webp',
      buffer: Buffer.from(match[2], 'base64'),
    }
  }
  return {
    mimeType: 'image/webp',
    buffer: Buffer.from(trimmed, 'base64'),
  }
}

export async function signedTestingImageUrl(storagePath) {
  if (!storagePath) return null
  const db = supabaseAdmin()
  if (!db) return null
  const { data, error } = await db.storage
    .from(TESTING_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error) return null
  return data?.signedUrl || null
}
