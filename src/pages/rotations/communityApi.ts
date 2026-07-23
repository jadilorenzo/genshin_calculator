export type CommunityRotation = {
  id: string
  authorId: string
  authorName: string
  title: string
  description: string
  doc: unknown
  characterIds: string[]
  likesCount: number
  commentsCount: number
  isPublic: boolean
  createdAt: string
  updatedAt?: string
  likedByMe?: boolean
}

export type CommunityComment = {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

type TokenFn = () => Promise<string | null>

const withAuth = async (
  getToken: TokenFn | undefined,
  required: boolean,
): Promise<HeadersInit> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const token = getToken ? await getToken() : null
  if (token) headers.authorization = `Bearer ${token}`
  else if (required) throw new Error('Sign in required')
  return headers
}

export const listCommunityRotations = async (
  opts: {
    page?: number
    sort?: 'popular' | 'new'
    mine?: boolean
    getToken?: TokenFn
  } = {},
) => {
  const page = opts.page ?? 1
  const sort = opts.sort ?? 'popular'
  const mine = Boolean(opts.mine)
  const headers = await withAuth(opts.getToken, mine)
  const params = new URLSearchParams({
    page: String(page),
    sort,
  })
  if (mine) params.set('mine', '1')
  const response = await fetch(`/api/community-rotations?${params}`, {
    headers,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load rotations')
  return {
    page: Number(body.page) || page,
    pageSize: Number(body.pageSize) || 12,
    total: Number(body.total) || 0,
    totalPages: Math.max(1, Number(body.totalPages) || 1),
    sort: typeof body.sort === 'string' ? body.sort : sort,
    mine: Boolean(body.mine),
    items: Array.isArray(body.items)
      ? (body.items as CommunityRotation[]).map((item) => ({
          ...item,
          isPublic: item.isPublic !== false,
        }))
      : [],
  }
}

export const getCommunityRotation = async (
  id: string,
  getToken?: TokenFn,
) => {
  const headers = await withAuth(getToken, false)
  const response = await fetch(
    `/api/community-rotation?id=${encodeURIComponent(id)}`,
    { headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load rotation')
  const item = body.item as CommunityRotation
  return { ...item, isPublic: item.isPublic !== false }
}

export const createCommunityRotation = async (
  input: {
    title: string
    description?: string
    doc: unknown
    authorName?: string
    isPublic?: boolean
  },
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch('/api/community-rotations', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to save rotation')
  const item = body.item as CommunityRotation
  return { ...item, isPublic: item.isPublic !== false }
}

export const updateCommunityRotation = async (
  id: string,
  input: {
    title?: string
    description?: string
    doc?: unknown
    authorName?: string
    isPublic?: boolean
  },
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation?id=${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to update rotation')
  const item = body.item as CommunityRotation
  return { ...item, isPublic: item.isPublic !== false }
}

export const deleteCommunityRotation = async (
  id: string,
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation?id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to delete rotation')
  return body as { ok: boolean }
}

export const toggleCommunityRotationLike = async (
  id: string,
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation-like?id=${encodeURIComponent(id)}`,
    { method: 'POST', headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to like')
  return body as { liked: boolean; likesCount: number }
}

export const listCommunityComments = async (id: string) => {
  const response = await fetch(
    `/api/community-rotation-comments?id=${encodeURIComponent(id)}`,
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load comments')
  return body.items as CommunityComment[]
}

export const postCommunityComment = async (
  id: string,
  text: string,
  getToken: TokenFn,
  authorName?: string,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation-comments?id=${encodeURIComponent(id)}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: text, authorName }),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to post comment')
  return body as { item: CommunityComment; commentsCount: number }
}

export const updateCommunityComment = async (
  rotationId: string,
  commentId: string,
  text: string,
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation-comments?id=${encodeURIComponent(rotationId)}&commentId=${encodeURIComponent(commentId)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ body: text }),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to update comment')
  return body.item as CommunityComment
}

export const deleteCommunityComment = async (
  rotationId: string,
  commentId: string,
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken, true)
  const response = await fetch(
    `/api/community-rotation-comments?id=${encodeURIComponent(rotationId)}&commentId=${encodeURIComponent(commentId)}`,
    { method: 'DELETE', headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to delete comment')
  return body as { ok: boolean; commentsCount: number }
}
