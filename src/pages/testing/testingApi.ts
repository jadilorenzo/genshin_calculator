import type { TestingRun, TestingSession, TestingCharacterRow } from './types'
import { compareTestingRunsByTimestamp, sortTestingRunsByTimestamp } from './runSort'
import {
  createLocalRun,
  createLocalSession,
  deleteLocalRun,
  deleteLocalSession,
  getLocalSession,
  isLocalTestingId,
  listLocalSessions,
  updateLocalRun,
  updateLocalSession,
} from './localTestingStore'

export { isLocalTestingId, listLocalSessions }

type TokenFn = () => Promise<string | null>

const withAuth = async (getToken: TokenFn): Promise<HeadersInit | null> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const token = await getToken().catch(() => null)
  if (!token) return null
  headers.authorization = `Bearer ${token}`
  return headers
}

const readError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => ({}))
  throw new Error((body as { error?: string }).error || fallback)
}

export const listTestingSessions = async (opts: {
  page?: number
  getToken: TokenFn
}) => {
  const headers = await withAuth(opts.getToken)
  if (!headers) return listLocalSessions()

  const page = opts.page ?? 1
  const params = new URLSearchParams({ page: String(page) })
  const response = await fetch(`/api/testing-sessions?${params}`, { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load sessions')
  return {
    page: Number(body.page) || page,
    pageSize: Number(body.pageSize) || 12,
    total: Number(body.total) || 0,
    totalPages: Math.max(1, Number(body.totalPages) || 1),
    items: Array.isArray(body.items) ? (body.items as TestingSession[]) : [],
  }
}

export const createTestingSession = async (
  input: { title: string; notes?: string },
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken)
  if (!headers) return createLocalSession(input)

  const response = await fetch('/api/testing-sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to create session')
  return body.item as TestingSession
}

export const getTestingSession = async (id: string, getToken: TokenFn) => {
  if (isLocalTestingId(id)) return getLocalSession(id)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Session not found')

  const response = await fetch(
    `/api/testing-session?id=${encodeURIComponent(id)}`,
    { headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load session')
  return {
    item: body.item as TestingSession,
    runs: sortTestingRunsByTimestamp(
      Array.isArray(body.runs) ? (body.runs as TestingRun[]) : [],
    ),
  }
}

export const updateTestingSession = async (
  id: string,
  input: { title?: string; notes?: string },
  getToken: TokenFn,
) => {
  if (isLocalTestingId(id)) return updateLocalSession(id, input)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Sign in required')

  const response = await fetch(
    `/api/testing-session?id=${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to update session')
  return body.item as TestingSession
}

export const deleteTestingSession = async (id: string, getToken: TokenFn) => {
  if (isLocalTestingId(id)) return deleteLocalSession(id)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Sign in required')

  const response = await fetch(
    `/api/testing-session?id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers },
  )
  if (!response.ok) await readError(response, 'Failed to delete session')
  const body = await response.json().catch(() => ({}))
  return body as { ok: boolean }
}

export type CreateTestingRunInput = {
  sessionId: string
  sortOrder?: number
  mainDpsId?: string
  dps?: number | null
  totalDamage?: number | null
  elapsedSeconds?: number | null
  strongestHit?: number | null
  capturedAt?: string | null
  characters?: TestingCharacterRow[]
  ocrRaw?: string
  imageBase64?: string | null
}

export const createTestingRun = async (
  input: CreateTestingRunInput,
  getToken: TokenFn,
) => {
  if (isLocalTestingId(input.sessionId)) return createLocalRun(input)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Sign in required')

  const response = await fetch('/api/testing-runs', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to save run')
  return body.item as TestingRun
}

export const updateTestingRun = async (
  id: string,
  input: Partial<Omit<CreateTestingRunInput, 'sessionId' | 'imageBase64'>>,
  getToken: TokenFn,
) => {
  if (isLocalTestingId(id)) return updateLocalRun(id, input)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Sign in required')

  const response = await fetch(
    `/api/testing-run?id=${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to update run')
  return body.item as TestingRun
}

export const deleteTestingRun = async (id: string, getToken: TokenFn) => {
  if (isLocalTestingId(id)) return deleteLocalRun(id)

  const headers = await withAuth(getToken)
  if (!headers) throw new Error('Sign in required')

  const response = await fetch(
    `/api/testing-run?id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers },
  )
  if (!response.ok) await readError(response, 'Failed to delete run')
  const body = await response.json().catch(() => ({}))
  return body as { ok: boolean }
}

export type TestingRunEntry = TestingRun & {
  sessionTitle: string
}

/** All runs from every session, sorted oldest first. */
export const listAllTestingRuns = async (
  getToken: TokenFn,
): Promise<TestingRunEntry[]> => {
  const sessions: TestingSession[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await listTestingSessions({ page, getToken })
    sessions.push(...result.items)
    totalPages = result.totalPages
    page += 1
  }

  const entries: TestingRunEntry[] = []
  for (const session of sessions) {
    const { item, runs } = await getTestingSession(session.id, getToken)
    for (const run of runs) {
      entries.push({ ...run, sessionTitle: item.title })
    }
  }

  return [...entries].sort(compareTestingRunsByTimestamp)
}
