import { toPng, toBlob } from 'html-to-image'

/** Solid dark fill — html-to-image often drops CSS gradients / color-mix. */
export const SHARE_BG = '#0b0d12'

/** Wait for imgs inside `root` to finish loading (or error). */
export async function waitForShareImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll('img')]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  )
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

export type CaptureShareOptions = {
  pixelRatio?: number
}

/**
 * Expand the timeline scroll area to the full track width so capture isn't a
 * scrolled viewport slice, then restore.
 */
async function withFullTimelineWidth<T>(
  root: HTMLElement,
  run: () => Promise<T>,
): Promise<T> {
  const scroll = root.querySelector(
    '.rotation-timeline-scroll',
  ) as HTMLElement | null
  const track = root.querySelector('.rotation-track') as HTMLElement | null
  if (!scroll || !track) return run()

  const prev = {
    overflow: scroll.style.overflow,
    width: scroll.style.width,
    maxWidth: scroll.style.maxWidth,
  }
  const width = Math.max(track.scrollWidth, track.offsetWidth)
  scroll.style.overflow = 'hidden'
  scroll.style.width = `${width}px`
  scroll.style.maxWidth = 'none'
  // Force layout before measuring the capture root.
  void scroll.offsetWidth

  try {
    return await run()
  } finally {
    scroll.style.overflow = prev.overflow
    scroll.style.width = prev.width
    scroll.style.maxWidth = prev.maxWidth
  }
}

const captureOpts = (node: HTMLElement, opts: CaptureShareOptions = {}) => {
  const width = Math.max(1, Math.ceil(node.scrollWidth))
  const height = Math.max(1, Math.ceil(node.scrollHeight))
  return {
    cacheBust: true,
    pixelRatio: opts.pixelRatio ?? 2,
    width,
    height,
    backgroundColor: SHARE_BG,
    style: {
      transform: 'none',
      margin: '0',
      width: `${width}px`,
      height: `${height}px`,
    },
  }
}

/** PNG data URL of the share capture node at its natural size. */
export async function captureShareCardPng(
  node: HTMLElement,
  opts: CaptureShareOptions = {},
): Promise<string> {
  return withFullTimelineWidth(node, async () => {
    await waitForShareImages(node)
    return toPng(node, captureOpts(node, opts))
  })
}

export async function captureShareCardBlob(
  node: HTMLElement,
  opts: CaptureShareOptions = {},
): Promise<Blob> {
  return withFullTimelineWidth(node, async () => {
    await waitForShareImages(node)
    const blob = await toBlob(node, captureOpts(node, opts))
    if (!blob) throw new Error('Could not render image')
    return blob
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function slugifyFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'rotation'
}

/** Copy PNG blob to clipboard when supported. */
export async function copyImageBlob(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return false
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || 'image/png']: blob }),
    ])
    return true
  } catch {
    return false
  }
}
