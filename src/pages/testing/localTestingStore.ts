import type { TestingCharacterRow, TestingRun, TestingSession } from './types'
import { sortTestingRunsByTimestamp } from './runSort'

export type LocalRunInput = {
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

const DB_NAME = 'gc-testing'
const DB_VERSION = 1
const SESSIONS = 'sessions'
const RUNS = 'runs'
const LOCAL_PREFIX = 'local-'
const MAX_RUNS = 40

export const isLocalTestingId = (id: string) => id.startsWith(LOCAL_PREFIX)

type LocalSessionRecord = TestingSession
type LocalRunRecord = TestingRun

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(RUNS)) {
        const runs = db.createObjectStore(RUNS, { keyPath: 'id' })
        runs.createIndex('sessionId', 'sessionId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open local testing storage'))
  })
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, mode)
    const done = waitForTx(tx)
    const result = await fn(tx.objectStore(storeName))
    await done
    return result
  } finally {
    db.close()
  }
}

function nowIso() {
  return new Date().toISOString()
}

function newLocalId() {
  return `${LOCAL_PREFIX}${crypto.randomUUID()}`
}

function toImageUrl(imageBase64: string | null | undefined): string | null {
  if (!imageBase64?.trim()) return null
  const trimmed = imageBase64.trim()
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/webp;base64,${trimmed}`
}

export async function listLocalSessions(): Promise<{
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: TestingSession[]
}> {
  const sessions = await withStore<LocalSessionRecord[]>(SESSIONS, 'readonly', (store) =>
    idbReq(store.getAll()),
  )
  const runs = await withStore<LocalRunRecord[]>(RUNS, 'readonly', (store) =>
    idbReq(store.getAll()),
  )
  const counts = new Map<string, number>()
  for (const run of runs) {
    counts.set(run.sessionId, (counts.get(run.sessionId) || 0) + 1)
  }
  const items = sessions
    .map((session) => ({
      ...session,
      runsCount: counts.get(session.id) || 0,
    }))
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
  return {
    page: 1,
    pageSize: Math.max(items.length, 1),
    total: items.length,
    totalPages: 1,
    items,
  }
}

export async function createLocalSession(input: {
  title: string
  notes?: string
}): Promise<TestingSession> {
  const title = input.title.trim().slice(0, 120)
  if (!title) throw new Error('Title is required')
  const createdAt = nowIso()
  const item: TestingSession = {
    id: newLocalId(),
    ownerId: 'local',
    title,
    notes: (input.notes || '').trim().slice(0, 2000),
    linkedRotationId: null,
    runsCount: 0,
    createdAt,
    updatedAt: createdAt,
  }
  await withStore(SESSIONS, 'readwrite', (store) => {
    store.put(item)
  })
  return item
}

export async function getLocalSession(id: string): Promise<{
  item: TestingSession
  runs: TestingRun[]
}> {
  const item = await withStore<LocalSessionRecord | undefined>(SESSIONS, 'readonly', (store) =>
    idbReq(store.get(id)),
  )
  if (!item) throw new Error('Session not found')
  const runs = await withStore<TestingRun[]>(RUNS, 'readonly', async (store) => {
    const index = store.index('sessionId')
    const rows = await idbReq(index.getAll(id))
    return sortTestingRunsByTimestamp(rows)
  })
  return { item: { ...item, runsCount: runs.length }, runs }
}

export async function updateLocalSession(
  id: string,
  input: { title?: string; notes?: string },
): Promise<TestingSession> {
  const current = await withStore<LocalSessionRecord | undefined>(SESSIONS, 'readonly', (store) =>
    idbReq(store.get(id)),
  )
  if (!current) throw new Error('Session not found')
  const next: TestingSession = {
    ...current,
    title:
      typeof input.title === 'string' ? input.title.trim().slice(0, 120) || current.title : current.title,
    notes:
      typeof input.notes === 'string' ? input.notes.trim().slice(0, 2000) : current.notes,
    updatedAt: nowIso(),
  }
  await withStore(SESSIONS, 'readwrite', (store) => {
    store.put(next)
  })
  return next
}

export async function deleteLocalSession(id: string): Promise<{ ok: boolean }> {
  const runs = await withStore<TestingRun[]>(RUNS, 'readonly', async (store) => {
    const index = store.index('sessionId')
    return idbReq(index.getAll(id))
  })
  const db = await openDb()
  try {
    const tx = db.transaction([SESSIONS, RUNS], 'readwrite')
    const done = waitForTx(tx)
    tx.objectStore(SESSIONS).delete(id)
    const runStore = tx.objectStore(RUNS)
    for (const run of runs) runStore.delete(run.id)
    await done
  } finally {
    db.close()
  }
  return { ok: true }
}

export async function createLocalRun(input: LocalRunInput): Promise<TestingRun> {
  const session = await withStore<LocalSessionRecord | undefined>(SESSIONS, 'readonly', (store) =>
    idbReq(store.get(input.sessionId)),
  )
  if (!session) throw new Error('Session not found')
  const existing = await withStore<TestingRun[]>(RUNS, 'readonly', async (store) => {
    const index = store.index('sessionId')
    return idbReq(index.getAll(input.sessionId))
  })
  if (existing.length >= MAX_RUNS) {
    throw new Error(`A session can hold at most ${MAX_RUNS} runs`)
  }
  const createdAt = nowIso()
  const item: TestingRun = {
    id: newLocalId(),
    sessionId: input.sessionId,
    ownerId: 'local',
    sortOrder: input.sortOrder ?? existing.length,
    storagePath: '',
    imageUrl: toImageUrl(input.imageBase64),
    mainDpsId: input.mainDpsId || '',
    dps: input.dps ?? null,
    totalDamage: input.totalDamage ?? null,
    elapsedSeconds: input.elapsedSeconds ?? null,
    strongestHit: input.strongestHit ?? null,
    capturedAt: input.capturedAt ?? null,
    characters: Array.isArray(input.characters) ? input.characters : [],
    ocrRaw: input.ocrRaw || '',
    createdAt,
    updatedAt: createdAt,
  }
  const db = await openDb()
  try {
    const tx = db.transaction([SESSIONS, RUNS], 'readwrite')
    const done = waitForTx(tx)
    tx.objectStore(RUNS).put(item)
    tx.objectStore(SESSIONS).put({ ...session, updatedAt: createdAt })
    await done
  } finally {
    db.close()
  }
  return item
}

export async function updateLocalRun(
  id: string,
  input: Partial<Omit<LocalRunInput, 'sessionId' | 'imageBase64'>>,
): Promise<TestingRun> {
  const current = await withStore<LocalRunRecord | undefined>(RUNS, 'readonly', (store) =>
    idbReq(store.get(id)),
  )
  if (!current) throw new Error('Run not found')
  const next: TestingRun = {
    ...current,
    sortOrder: input.sortOrder ?? current.sortOrder,
    mainDpsId: input.mainDpsId ?? current.mainDpsId,
    dps: input.dps === undefined ? current.dps : input.dps,
    totalDamage: input.totalDamage === undefined ? current.totalDamage : input.totalDamage,
    elapsedSeconds:
      input.elapsedSeconds === undefined ? current.elapsedSeconds : input.elapsedSeconds,
    strongestHit: input.strongestHit === undefined ? current.strongestHit : input.strongestHit,
    capturedAt: input.capturedAt === undefined ? current.capturedAt : input.capturedAt,
    characters: input.characters ?? current.characters,
    ocrRaw: input.ocrRaw ?? current.ocrRaw,
    updatedAt: nowIso(),
  }
  await withStore(RUNS, 'readwrite', (store) => {
    store.put(next)
  })
  return next
}

export async function deleteLocalRun(id: string): Promise<{ ok: boolean }> {
  await withStore(RUNS, 'readwrite', (store) => {
    store.delete(id)
  })
  return { ok: true }
}
