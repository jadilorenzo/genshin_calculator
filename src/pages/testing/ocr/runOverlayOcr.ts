import { createWorker, PSM, type Worker } from 'tesseract.js'
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

let workerPromise: Promise<Worker> | null = null
/** Serialize recognize calls — one worker cannot safely run concurrent jobs. */
let recognizeChain: Promise<unknown> = Promise.resolve()

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/%()|- '",
      })
      return worker
    })()
  }
  return workerPromise
}

export async function terminateOverlayOcr(): Promise<void> {
  if (!workerPromise) return
  try {
    const worker = await workerPromise
    await worker.terminate()
  } catch {
    // ignore terminate errors
  } finally {
    workerPromise = null
    recognizeChain = Promise.resolve()
  }
}

export type OverlayOcrResult = ParsedOverlay & {
  ocrRaw: string
}

async function recognizeOnce(
  worker: Worker,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<OverlayOcrResult> {
  assertNotAborted(signal)
  const { data } = await worker.recognize(canvas)
  assertNotAborted(signal)
  const ocrRaw = data.text || ''
  const parsed = parseOverlayText(ocrRaw)
  return { ...parsed, ocrRaw }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('OCR cancelled', 'AbortError')
  }
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

/** OCR a full combat-result screenshot and parse structured fields. */
export async function runOverlayOcr(
  blob: Blob,
  options?: { signal?: AbortSignal },
): Promise<OverlayOcrResult> {
  const signal = options?.signal
  const image = await loadImageFromBlob(blob)
  assertNotAborted(signal)

  const run = async (): Promise<OverlayOcrResult> => {
    const worker = await getWorker()
    assertNotAborted(signal)
    const cropped = cropCombatOverlay(image)
    // Hardcoded HUD bands: header (DPS/Damage), chars, footer (Time/Strongest).
    const bands = [
      cropped,
      cropMetaHeaderBand(cropped),
      cropCharacterBand(cropped),
      cropMetaFooterBand(cropped),
    ]

    const results: OverlayOcrResult[] = []

    for (const source of bands) {
      assertNotAborted(signal)
      for (const variant of PREPROCESS_VARIANTS) {
        assertNotAborted(signal)
        // Narrow bands prefer textMask / yellowBoost.
        if (
          source !== cropped &&
          !variant.textMask &&
          !variant.yellowBoost
        ) {
          continue
        }
        const canvas = preprocessOverlay(source, variant)
        const result = await recognizeOnce(worker, canvas, signal)
        results.push(result)
        if (scoreParsedOverlay(result) >= 30) break
      }
    }

    let best: OverlayOcrResult | null = null
    let bestScore = -Infinity
    for (const result of results) {
      const score = scoreParsedOverlay(result)
      if (score > bestScore) {
        best = result
        bestScore = score
      }
    }

    // Merge best meta (DPS/time/strongest) with best character rows.
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

    // Also stitch header+footer explicitly — those rows are the most reliable.
    const headerish = results.filter(
      (r) => r.dps != null || r.totalDamage != null,
    )
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
      if (scoreParsedOverlay(stitched) >= bestScore) {
        best = stitched
      }
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

  const next = recognizeChain.then(run, run)
  recognizeChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}
