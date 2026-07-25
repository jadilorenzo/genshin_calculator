export type TestingCharacterRow = {
  slot: number
  characterId: string
  name: string
  damage: number | null
  teamPct: number | null
}

export type TestingRun = {
  id: string
  sessionId: string
  ownerId: string
  sortOrder: number
  storagePath: string
  imageUrl: string | null
  mainDpsId: string
  dps: number | null
  totalDamage: number | null
  elapsedSeconds: number | null
  strongestHit: number | null
  /** ISO timestamp from the overlay when OCR finds one. */
  capturedAt: string | null
  characters: TestingCharacterRow[]
  ocrRaw: string
  createdAt: string
  updatedAt?: string
}

export type TestingSession = {
  id: string
  ownerId: string
  title: string
  notes: string
  linkedRotationId: string | null
  runsCount?: number
  createdAt: string
  updatedAt?: string
}

/** Draft produced by OCR / review UI before (or while) saving. */
export type RunDraft = {
  localId: string
  fileName: string
  previewUrl: string
  imageBase64: string | null
  status: 'pending' | 'ocr' | 'ready' | 'saving' | 'saved' | 'error'
  error?: string
  warnings: string[]
  mainDpsId: string
  dps: number | null
  totalDamage: number | null
  elapsedSeconds: number | null
  strongestHit: number | null
  capturedAt: string | null
  characters: TestingCharacterRow[]
  ocrRaw: string
  savedId?: string
}
