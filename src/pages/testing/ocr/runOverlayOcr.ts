import { createWorker, PSM, type Worker } from 'tesseract.js'
import type { OcrProgress } from '../types'
import {
  cropCharacterBand,
  cropCombatOverlay,
  cropMetaFooterBand,
  cropMetaHeaderBand,
  loadImageFromBlob,
  preprocessOverlay,
  PREPROCESS_VARIANTS,
} from './preprocessOverlay'
import {
  parseOverlayText,
  scoreParsedOverlay,
  type ParsedOverlay,
} from './parseOverlayText'

/** How many screenshots may OCR at once. Each has its own Tesseract worker. */
const POOL_SIZE = 2
/** A single recognize pass that exceeds this is treated as hung. */
const RECOGNIZE_TIMEOUT_MS = 18_000
const GOOD_ENOUGH_SCORE = 30

const idle: Worker[] = []
const liveWorkers = new Set<Worker>()
const waitQueue: Array<() => void> = []
let inUse = 0
let shuttingDown = false

export class OcrStallError extends Error {
  readonly progress: OcrProgress

  constructor(progress: OcrProgress) {
    super('OCR stalled')
    this.name = 'OcrStallError'
    this.progress = progress
  }
}

async function createConfiguredWorker(): Promise<Worker> {
  const worker = await createWorker('eng')
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/%()|- '",
  })
  return worker
}

function wakeWaiter() {
  const next = waitQueue.shift()
  next?.()
}

async function acquireWorker(signal?: AbortSignal): Promise<Worker> {
  for (;;) {
    assertNotAborted(signal)
    if (shuttingDown) throw new DOMException('OCR cancelled', 'AbortError')
    if (inUse < POOL_SIZE) {
      inUse += 1
      break
    }
    await new Promise<void>((resolve) => {
      const settle = () => {
        const at = waitQueue.indexOf(settle)
        if (at >= 0) waitQueue.splice(at, 1)
        signal?.removeEventListener('abort', settle)
        resolve()
      }
      waitQueue.push(settle)
      signal?.addEventListener('abort', settle, { once: true })
    })
  }

  assertNotAborted(signal)
  const reused = idle.pop()
  if (reused) return reused

  try {
    const worker = await createConfiguredWorker()
    if (shuttingDown || signal?.aborted) {
      liveWorkers.delete(worker)
      void worker.terminate().catch(() => undefined)
      inUse = Math.max(0, inUse - 1)
      wakeWaiter()
      throw new DOMException('OCR cancelled', 'AbortError')
    }
    liveWorkers.add(worker)
    return worker
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    inUse = Math.max(0, inUse - 1)
    wakeWaiter()
    throw err
  }
}

function releaseWorker(worker: Worker, discard: boolean) {
  inUse = Math.max(0, inUse - 1)
  if (discard || !liveWorkers.has(worker)) {
    liveWorkers.delete(worker)
    void worker.terminate().catch(() => undefined)
  } else {
    idle.push(worker)
  }
  wakeWaiter()
}

export async function terminateOverlayOcr(): Promise<void> {
  shuttingDown = true
  const workers = [...liveWorkers]
  liveWorkers.clear()
  idle.length = 0
  inUse = 0
  const pending = waitQueue.splice(0)
  pending.forEach((resolve) => resolve())
  await Promise.all(workers.map((worker) => worker.terminate().catch(() => undefined)))
  shuttingDown = false
}

export type OverlayOcrResult = ParsedOverlay & {
  ocrRaw: string
}

export type RunOverlayOcrOptions = {
  signal?: AbortSignal
  onProgress?: (progress: OcrProgress) => void
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('OCR cancelled', 'AbortError')
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('recognize-timeout')), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('OCR cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

async function recognizeOnce(
  worker: Worker,
  canvas: HTMLCanvasElement,
  signal: AbortSignal | undefined,
  progress: OcrProgress,
): Promise<OverlayOcrResult> {
  assertNotAborted(signal)
  let data: { text?: string }
  try {
    const recognized = await withTimeout(
      worker.recognize(canvas),
      RECOGNIZE_TIMEOUT_MS,
      signal,
    )
    data = recognized.data
  } catch (err) {
    if (err instanceof Error && err.message === 'recognize-timeout') {
      throw new OcrStallError(progress)
    }
    throw err
  }
  assertNotAborted(signal)
  const ocrRaw = data.text || ''
  const parsed = parseOverlayText(ocrRaw)
  return { ...parsed, ocrRaw }
}

const metaScore = (parsed: ParsedOverlay) => {
  let score = 0
  if (parsed.dps != null) score += 4
  if (parsed.totalDamage != null) score += 4
  if (parsed.elapsedSeconds != null) score += 3
  if (parsed.strongestHit != null) score += 2
  if (parsed.capturedAt) score += 2
  return score
}

const characterScore = (parsed: ParsedOverlay) => {
  let score = 0
  for (const row of parsed.characters) {
    if (row.damage != null) score += 2
    if (row.teamPct != null) score += 1
    if (row.characterId) score += 2
    else if (row.name) score += 1
  }
  return score
}

function countPasses(): number {
  const narrow = PREPROCESS_VARIANTS.filter(
    (variant) => variant.textMask || variant.yellowBoost,
  ).length
  // Full overlay uses every variant; the three HUD bands use the narrow set.
  return PREPROCESS_VARIANTS.length + narrow * 3
}

function pickBest(results: OverlayOcrResult[]): OverlayOcrResult {
  let best: OverlayOcrResult | null = null
  let bestScore = -Infinity
  for (const result of results) {
    const score = scoreParsedOverlay(result)
    if (score > bestScore) {
      best = result
      bestScore = score
    }
  }

  const byMeta = [...results].sort((a, b) => metaScore(b) - metaScore(a))[0]
  const byChars = [...results].sort(
    (a, b) => characterScore(b) - characterScore(a),
  )[0]
  if (byMeta && byChars) {
    const mergedRaw = `${byMeta.ocrRaw}\n${byChars.ocrRaw}`
    const mergedParsed = parseOverlayText(mergedRaw)
    const merged: OverlayOcrResult = { ...mergedParsed, ocrRaw: mergedRaw }
    const mergedScore = scoreParsedOverlay(merged)
    if (mergedScore >= bestScore) {
      best = merged
      bestScore = mergedScore
    }
  }

  const headerish = results.filter((r) => r.dps != null || r.totalDamage != null)
  const footerish = results.filter(
    (r) => r.elapsedSeconds != null || r.strongestHit != null,
  )
  if (headerish[0] && footerish[0] && byChars) {
    const stitchedRaw = [
      headerish[0].ocrRaw,
      byChars.ocrRaw,
      footerish[0].ocrRaw,
    ].join('\n')
    const stitchedParsed = parseOverlayText(stitchedRaw)
    const stitched: OverlayOcrResult = {
      ...stitchedParsed,
      ocrRaw: stitchedRaw,
    }
    if (scoreParsedOverlay(stitched) >= bestScore) best = stitched
  }

  return (
    best ?? {
      dps: null,
      totalDamage: null,
      elapsedSeconds: null,
      strongestHit: null,
      capturedAt: null,
      characters: [],
      mainDpsId: '',
      warnings: ['OCR produced no text'],
      ocrRaw: '',
    }
  )
}

/** OCR a full combat-result screenshot and parse structured fields. */
export async function runOverlayOcr(
  blob: Blob,
  options?: RunOverlayOcrOptions,
): Promise<OverlayOcrResult> {
  const signal = options?.signal
  const onProgress = options?.onProgress
  const total = countPasses()
  const report = (progress: OcrProgress) => onProgress?.(progress)

  report({ phase: 'queued', done: 0, total })
  const image = await loadImageFromBlob(blob)
  assertNotAborted(signal)

  let worker: Worker | null = null
  let discard = false
  try {
    worker = await acquireWorker(signal)
    assertNotAborted(signal)
    report({ phase: 'reading', done: 0, total })

    const cropped = cropCombatOverlay(image)
    const bands = [
      cropped,
      cropMetaHeaderBand(cropped),
      cropCharacterBand(cropped),
      cropMetaFooterBand(cropped),
    ]
    const results: OverlayOcrResult[] = []
    let done = 0
    let stop = false

    for (const source of bands) {
      if (stop) break
      for (const variant of PREPROCESS_VARIANTS) {
        if (stop) break
        assertNotAborted(signal)
        if (source !== cropped && !variant.textMask && !variant.yellowBoost) {
          continue
        }
        const canvas = preprocessOverlay(source, variant)
        const progress: OcrProgress = { phase: 'reading', done, total }
        let result: OverlayOcrResult
        try {
          result = await recognizeOnce(worker, canvas, signal, progress)
        } catch (err) {
          if (err instanceof OcrStallError) discard = true
          throw err
        }
        results.push(result)
        done += 1
        report({ phase: 'reading', done, total })
        if (scoreParsedOverlay(result) >= GOOD_ENOUGH_SCORE) stop = true
      }
    }

    report({ phase: 'reading', done: total, total })
    return pickBest(results)
  } catch (err) {
    if (err instanceof OcrStallError) discard = true
    if (err instanceof DOMException && err.name === 'AbortError') discard = true
    throw err
  } finally {
    if (worker) releaseWorker(worker, discard)
  }
}
