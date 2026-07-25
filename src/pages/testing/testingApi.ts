import type { TestingRun, TestingSession, TestingCharacterRow } from './types'

type TokenFn = () => Promise<string | null>

const withAuth = async (getToken: TokenFn): Promise<HeadersInit> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const token = await getToken()
  if (!token) throw new Error('Sign in required')
  headers.authorization = `Bearer ${token}`
  return headers
}

export const listTestingSessions = async (
  opts: { page?: number; getToken: TokenFn },
) => {
  const page = opts.page ?? 1
  const headers = await withAuth(opts.getToken)
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
  const headers = await withAuth(getToken)
  const response = await fetch(
    `/api/testing-session?id=${encodeURIComponent(id)}`,
    { headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to load session')
  return {
    item: body.item as TestingSession,
    runs: Array.isArray(body.runs) ? (body.runs as TestingRun[]) : [],
  }
}

export const updateTestingSession = async (
  id: string,
  input: { title?: string; notes?: string },
  getToken: TokenFn,
) => {
  const headers = await withAuth(getToken)
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
  const headers = await withAuth(getToken)
  const response = await fetch(
    `/api/testing-session?id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to delete session')
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
  const headers = await withAuth(getToken)
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
  const headers = await withAuth(getToken)
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
  const headers = await withAuth(getToken)
  const response = await fetch(
    `/api/testing-run?id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Failed to delete run')
  return body as { ok: boolean }
}
