import { json, requireUserId, supabaseAdmin } from './_authDb.js'

/** POST toggle like · ?id= */
export async function POST(request) {
  const auth = await requireUserId(request)
  if (auth.error) return auth.error

  const db = supabaseAdmin()
  if (!db) return json({ error: 'Cloud sync is not configured' }, 503)

  const rotationId = new URL(request.url).searchParams.get('id')
  if (!rotationId) return json({ error: 'Missing id' }, 400)

  const { data: existing, error: loadError } = await db
    .from('community_rotations')
    .select('id, likes_count')
    .eq('id', rotationId)
    .maybeSingle()

  if (loadError) return json({ error: loadError.message }, 500)
  if (!existing) return json({ error: 'Not found' }, 404)

  const { data: like } = await db
    .from('community_rotation_likes')
    .select('rotation_id')
    .eq('rotation_id', rotationId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (like) {
    const { error: delError } = await db
      .from('community_rotation_likes')
      .delete()
      .eq('rotation_id', rotationId)
      .eq('user_id', auth.userId)
    if (delError) return json({ error: delError.message }, 500)

    const nextCount = Math.max(0, (existing.likes_count ?? 0) - 1)
    await db
      .from('community_rotations')
      .update({ likes_count: nextCount })
      .eq('id', rotationId)

    return json({ liked: false, likesCount: nextCount })
  }

  const { error: insError } = await db.from('community_rotation_likes').insert({
    rotation_id: rotationId,
    user_id: auth.userId,
  })
  if (insError) return json({ error: insError.message }, 500)

  const nextCount = (existing.likes_count ?? 0) + 1
  await db
    .from('community_rotations')
    .update({ likes_count: nextCount })
    .eq('id', rotationId)

  return json({ liked: true, likesCount: nextCount })
}
