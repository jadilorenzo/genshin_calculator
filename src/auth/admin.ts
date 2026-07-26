/** Built-in site admins (Clerk user ids). Extra via VITE_ADMIN_USER_IDS. */
const DEFAULT_ADMIN_USER_IDS = ['user_3GpH8R2JyVdc63h1lytXq3oHq6j']

export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false
  const fromEnv = String(import.meta.env.VITE_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return new Set([...DEFAULT_ADMIN_USER_IDS, ...fromEnv]).has(userId)
}

export function canModerateContent(
  authorId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  return Boolean(
    userId && (authorId === userId || isAdminUserId(userId)),
  )
}
