export type PreprocessVariant = {
  /** Upscale factor before OCR. Keep modest for full-frame screenshots. */
  scale: number
  /** Multiply luminance (< 1 darkens the frame). */
  darken: number
  /** Contrast multiplier around mid-gray after darken. */
  contrast: number
  /** 0–1 cutoff after contrast; higher → more aggressive black/white split. */
  threshold: number
  /** Tesseract prefers dark glyphs on a light field. */
  invert: boolean
  pad: number
  /**
   * Lift yellow/gold highlight text (active DPS row) into full white luminance
   * so it survives thresholding.
   */
  yellowBoost?: boolean
  /**
   * Binary text mask: treat light HUD glyphs and warm/gold highlights as ink.
   * Better for yellow active-DPS rows than luminance thresholding alone.
   */
  textMask?: boolean
}

export const PREPROCESS_VARIANTS: PreprocessVariant[] = [
  {
    scale: 2.5,
    darken: 1,
    contrast: 1,
    threshold: 0.5,
    invert: true,
    pad: 16,
    textMask: true,
  },
  {
    scale: 3,
    darken: 1,
    contrast: 1,
    threshold: 0.5,
    invert: true,
    pad: 12,
    textMask: true,
  },
  {
    scale: 2,
    darken: 0.72,
    contrast: 1.85,
    threshold: 0.52,
    invert: true,
    pad: 16,
    yellowBoost: true,
  },
  { scale: 1.75, darken: 0.72, contrast: 1.85, threshold: 0.52, invert: true, pad: 16 },
]

/**
 * Combat summary HUD lives in the top-left under "Complete stage & exit".
 * Wide enough for DPS → Strongest Hit; stop before "Nefer Attributes".
 */
export function cropCombatOverlay(
  image: HTMLImageElement | HTMLCanvasElement,
  widthFrac = 0.4,
  heightFrac = 0.5,
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
  const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
  const cropW = Math.max(1, Math.round(srcW * widthFrac))
  const cropH = Math.max(1, Math.round(srcH * heightFrac))
  const out = document.createElement('canvas')
  out.width = cropW
  out.height = cropH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(image, 0, 0, cropW, cropH, 0, 0, cropW, cropH)
  return out
}

/**
 * Character damage rows sit in the middle of the combat overlay. A tighter crop
 * helps Tesseract read the yellow active-DPS line that full-frame passes drop.
 */
export function cropCharacterBand(
  combatCrop: HTMLCanvasElement,
  topFrac = 0.16,
  bottomFrac = 0.82,
): HTMLCanvasElement {
  const y0 = Math.max(0, Math.round(combatCrop.height * topFrac))
  const y1 = Math.min(
    combatCrop.height,
    Math.round(combatCrop.height * bottomFrac),
  )
  const out = document.createElement('canvas')
  out.width = combatCrop.width
  out.height = Math.max(1, y1 - y0)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(
    combatCrop,
    0,
    y0,
    combatCrop.width,
    out.height,
    0,
    0,
    out.width,
    out.height,
  )
  return out
}

/**
 * Bottom of the combat HUD: Time Elapsed + Strongest Hit (below the 4 char rows).
 */
export function cropMetaFooterBand(
  combatCrop: HTMLCanvasElement,
  topFrac = 0.78,
  bottomFrac = 0.98,
): HTMLCanvasElement {
  const y0 = Math.max(0, Math.round(combatCrop.height * topFrac))
  const y1 = Math.min(
    combatCrop.height,
    Math.round(combatCrop.height * bottomFrac),
  )
  const out = document.createElement('canvas')
  out.width = combatCrop.width
  out.height = Math.max(1, y1 - y0)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(
    combatCrop,
    0,
    y0,
    combatCrop.width,
    out.height,
    0,
    0,
    out.width,
    out.height,
  )
  return out
}

/**
 * Top of the combat HUD after the exit button: DPS + Damage lines.
 */
export function cropMetaHeaderBand(
  combatCrop: HTMLCanvasElement,
  topFrac = 0.08,
  bottomFrac = 0.32,
): HTMLCanvasElement {
  const y0 = Math.max(0, Math.round(combatCrop.height * topFrac))
  const y1 = Math.min(
    combatCrop.height,
    Math.round(combatCrop.height * bottomFrac),
  )
  const out = document.createElement('canvas')
  out.width = combatCrop.width
  out.height = Math.max(1, y1 - y0)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(
    combatCrop,
    0,
    y0,
    combatCrop.width,
    out.height,
    0,
    0,
    out.width,
    out.height,
  )
  return out
}

/** Load a File / Blob into an HTMLImageElement. */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

const isWarmGold = (r: number, g: number, b: number) =>
  r > 170 && g > 140 && b < 200 && r + g > b * 2 && r - b > 30

const isYellowHighlight = (r: number, g: number, b: number) =>
  r > 140 && g > 120 && b < 140 && r + g > b * 2.2

/**
 * Prepare a (usually cropped) combat-overlay frame for OCR: upscale, darken,
 * boost contrast, then threshold. Preview / upload images are left untouched.
 */
export function preprocessOverlay(
  image: HTMLImageElement | HTMLCanvasElement,
  variant: PreprocessVariant = PREPROCESS_VARIANTS[0],
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
  const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height

  const scaledW = Math.max(1, Math.round(srcW * variant.scale))
  const scaledH = Math.max(1, Math.round(srcH * variant.scale))
  const pad = Math.max(0, Math.round(variant.pad))

  const out = document.createElement('canvas')
  out.width = scaledW + pad * 2
  out.height = scaledH + pad * 2
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.fillStyle = variant.invert ? '#ffffff' : '#000000'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, srcW, srcH, pad, pad, scaledW, scaledH)

  const imageData = ctx.getImageData(0, 0, out.width, out.height)
  const data = imageData.data

  if (variant.textMask) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      const isText = gray > 155 || isWarmGold(r, g, b) || isYellowHighlight(r, g, b)
      // Dark ink on light field for Tesseract.
      const ink = isText ? 0 : 255
      data[i] = ink
      data[i + 1] = ink
      data[i + 2] = ink
    }
    ctx.putImageData(imageData, 0, 0)
    return out
  }

  const luminances = new Float32Array(data.length / 4)
  let min = 255
  let max = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    let gray = 0.299 * r + 0.587 * g + 0.114 * b
    // Active DPS row is yellow; treat it as white so it survives binarization.
    if (variant.yellowBoost && isYellowHighlight(r, g, b)) {
      gray = 255
    }
    const darkened = Math.max(0, Math.min(255, gray * variant.darken))
    luminances[p] = darkened
    if (darkened < min) min = darkened
    if (darkened > max) max = darkened
  }

  const range = Math.max(1, max - min)
  const cutoff = variant.threshold * 255
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const stretched = ((luminances[p] - min) / range) * 255
    const contrasted = Math.max(
      0,
      Math.min(255, (stretched - 128) * variant.contrast + 128),
    )
    let binary = contrasted >= cutoff ? 255 : 0
    if (variant.invert) binary = 255 - binary
    data[i] = binary
    data[i + 1] = binary
    data[i + 2] = binary
  }
  ctx.putImageData(imageData, 0, 0)
  return out
}

/** Downscale to max width and encode as a WebP (or JPEG fallback) data URL. */
export async function encodeImageForUpload(
  image: HTMLImageElement | HTMLCanvasElement,
  maxWidth = 1600,
  quality = 0.82,
): Promise<string> {
  const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
  const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
  const scale = srcW > maxWidth ? maxWidth / srcW : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(srcW * scale))
  canvas.height = Math.max(1, Math.round(srcH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const tryType = (type: string) =>
    new Promise<string | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          const reader = new FileReader()
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : null)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        },
        type,
        quality,
      )
    })

  return (
    (await tryType('image/webp')) ||
    (await tryType('image/jpeg')) ||
    canvas.toDataURL('image/png')
  )
}
