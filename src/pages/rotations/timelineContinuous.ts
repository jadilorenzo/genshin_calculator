import type { TimelinePlacement } from './types'

export const SNAP = 0.25
export const MIN_ON_FIELD = 0.5
/** Default character swap / animation buffer between on-field windows. */
export const DEFAULT_SWITCH_BUFFER = 0.33
export const MIN_SWITCH_BUFFER = 0
export const MAX_SWITCH_BUFFER = 1.5

export function snapTime(t: number, step = SNAP): number {
  return Math.round(t / step) * step
}

export function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function clampSwitchBuffer(t: number): number {
  return clamp(roundTime(t), MIN_SWITCH_BUFFER, MAX_SWITCH_BUFFER)
}

/**
 * Sort by start and lay out from t=0 with a fixed switch buffer between
 * each pair of characters.
 */
export function normalizeOnField(
  placements: TimelinePlacement[],
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  if (placements.length === 0) return []

  const buffer = clampSwitchBuffer(switchBuffer)
  const sorted = [...placements].sort(
    (a, b) => a.start - b.start || a.duration - b.duration,
  )

  let t = 0
  return sorted.map((p, i) => {
    const duration = Math.max(MIN_ON_FIELD, snapTime(p.duration))
    const next = { ...p, start: roundTime(t), duration: roundTime(duration) }
    t = roundTime(t + duration)
    if (i < sorted.length - 1) {
      t = roundTime(t + buffer)
    }
    return next
  })
}

/** End of last on-field window (buffers between already baked into starts). */
export function fieldEnd(
  placements: TimelinePlacement[],
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): number {
  const sorted = normalizeOnField(placements, switchBuffer)
  if (sorted.length === 0) return 0
  const last = sorted[sorted.length - 1]
  return roundTime(last.start + last.duration)
}

/**
 * Full rotation cycle including the swap back to the first character
 * when looping.
 */
export function rotationCycleLength(
  placements: TimelinePlacement[],
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): number {
  const end = fieldEnd(placements, switchBuffer)
  if (placements.length === 0) return 0
  if (placements.length === 1) return end
  return roundTime(end + clampSwitchBuffer(switchBuffer))
}

export function switchGaps(
  placements: TimelinePlacement[],
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): { afterId: string; start: number; duration: number }[] {
  const buffer = clampSwitchBuffer(switchBuffer)
  if (buffer <= 0) return []
  const sorted = normalizeOnField(placements, buffer)
  const gaps: { afterId: string; start: number; duration: number }[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const end = sorted[i].start + sorted[i].duration
    gaps.push({
      afterId: sorted[i].id,
      start: roundTime(end),
      duration: buffer,
    })
  }
  return gaps
}

/**
 * Insert a character at `atTime`, splitting whoever is on-field there.
 * Switch buffers are re-applied by normalize.
 */
export function insertOnField(
  placements: TimelinePlacement[],
  incoming: TimelinePlacement,
  atTime: number,
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  const at = snapTime(Math.max(0, atTime))
  const buffer = clampSwitchBuffer(switchBuffer)

  if (placements.length === 0) {
    return normalizeOnField(
      [{ ...incoming, start: 0, duration: Math.max(MIN_ON_FIELD, incoming.duration) }],
      buffer,
    )
  }

  const sorted = normalizeOnField(placements, buffer)

  // Drop landed in a switch gap → insert after the preceding character
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].start + sorted[i].duration
    const gapEnd = sorted[i + 1].start
    if (at >= gapStart - 1e-9 && at < gapEnd + 1e-9) {
      return normalizeOnField(
        [
          ...sorted.slice(0, i + 1),
          {
            ...incoming,
            duration: Math.max(MIN_ON_FIELD, incoming.duration),
          },
          ...sorted.slice(i + 1),
        ],
        buffer,
      )
    }
  }

  const idx = sorted.findIndex(
    (p) => at >= p.start && at < p.start + p.duration - 1e-9,
  )

  if (idx === -1) {
    return normalizeOnField(
      [
        ...sorted,
        {
          ...incoming,
          duration: Math.max(MIN_ON_FIELD, incoming.duration),
        },
      ],
      buffer,
    )
  }

  const target = sorted[idx]
  const offset = roundTime(at - target.start)
  const remain = roundTime(target.start + target.duration - at)

  if (offset < MIN_ON_FIELD / 2) {
    return normalizeOnField(
      [
        ...sorted.slice(0, idx),
        {
          ...incoming,
          duration: Math.max(MIN_ON_FIELD, incoming.duration),
        },
        ...sorted.slice(idx),
      ],
      buffer,
    )
  }
  if (remain < MIN_ON_FIELD / 2) {
    return normalizeOnField(
      [
        ...sorted.slice(0, idx + 1),
        {
          ...incoming,
          duration: Math.max(MIN_ON_FIELD, incoming.duration),
        },
        ...sorted.slice(idx + 1),
      ],
      buffer,
    )
  }

  const leftDur = Math.max(MIN_ON_FIELD, snapTime(offset))
  const rightDur = Math.max(MIN_ON_FIELD, snapTime(remain))
  const midDur = Math.max(MIN_ON_FIELD, incoming.duration)

  return normalizeOnField(
    [
      ...sorted.slice(0, idx),
      { ...target, duration: leftDur },
      { ...incoming, duration: midDur },
      {
        ...target,
        id: `${target.id}-r${Math.random().toString(36).slice(2, 7)}`,
        duration: rightDur,
        castSkill: target.castSkill ?? true,
        castBurst: target.castBurst ?? true,
        castOrder: target.castOrder ?? 'skill-first',
        skillVariant: target.skillVariant ?? 'hold',
        activeDurations: [],
        durationOverrides: {},
      },
      ...sorted.slice(idx + 1),
    ],
    buffer,
  )
}

/**
 * Move the handoff after `id` by changing its on-field duration.
 * Neighbor absorbs the difference; switch buffer stays fixed.
 */
export function adjustHandoffAfter(
  placements: TimelinePlacement[],
  id: string,
  nextDuration: number,
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  const buffer = clampSwitchBuffer(switchBuffer)
  const sorted = normalizeOnField(placements, buffer)
  const idx = sorted.findIndex((p) => p.id === id)
  if (idx === -1) return sorted

  const cur = sorted[idx]
  const next = sorted[idx + 1]
  const desired = Math.max(MIN_ON_FIELD, snapTime(nextDuration))

  if (!next) {
    return normalizeOnField(
      sorted.map((p, i) => (i === idx ? { ...p, duration: desired } : p)),
      buffer,
    )
  }

  const pairTotal = cur.duration + next.duration
  const left = clamp(desired, MIN_ON_FIELD, pairTotal - MIN_ON_FIELD)
  const right = roundTime(pairTotal - left)

  return normalizeOnField(
    sorted.map((p, i) => {
      if (i === idx) return { ...p, duration: left }
      if (i === idx + 1) return { ...p, duration: right }
      return p
    }),
    buffer,
  )
}

/**
 * Move the handoff before `id` (resize left edge).
 */
export function adjustHandoffBefore(
  placements: TimelinePlacement[],
  id: string,
  newStart: number,
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  const buffer = clampSwitchBuffer(switchBuffer)
  const sorted = normalizeOnField(placements, buffer)
  const idx = sorted.findIndex((p) => p.id === id)
  if (idx <= 0) return sorted

  const prev = sorted[idx - 1]
  const cur = sorted[idx]
  // Ignore buffer gap: trade duration between prev and cur only
  const pairTotal = prev.duration + cur.duration
  // Map pointer time to duration of prev (start of cur ≈ prev.start + prev.dur + buffer)
  const idealPrevEnd = snapTime(newStart) - buffer
  const left = clamp(
    idealPrevEnd - prev.start,
    MIN_ON_FIELD,
    pairTotal - MIN_ON_FIELD,
  )
  const right = roundTime(pairTotal - left)

  return normalizeOnField(
    sorted.map((p, i) => {
      if (i === idx - 1) return { ...p, duration: left }
      if (i === idx) return { ...p, duration: right }
      return p
    }),
    buffer,
  )
}

export function removeAndCloseGaps(
  placements: TimelinePlacement[],
  id: string,
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  return normalizeOnField(
    placements.filter((p) => p.id !== id),
    switchBuffer,
  )
}

export function setOnFieldDuration(
  placements: TimelinePlacement[],
  id: string,
  duration: number,
  switchBuffer = DEFAULT_SWITCH_BUFFER,
): TimelinePlacement[] {
  return adjustHandoffAfter(placements, id, duration, switchBuffer)
}

/** Nearest boundary among placement starts/ends (and switch edges). */
export function snapToNearestBoundary(
  t: number,
  placements: TimelinePlacement[],
  switchBuffer = DEFAULT_SWITCH_BUFFER,
  threshold = 0.4,
): number {
  const sorted = normalizeOnField(placements, switchBuffer)
  if (sorted.length === 0) return snapTime(t)

  const points = [0]
  for (const p of sorted) {
    points.push(p.start, p.start + p.duration)
  }

  let best = snapTime(t)
  let bestDist = Math.abs(best - t)

  for (const pt of points) {
    const d = Math.abs(pt - t)
    if (d < bestDist && d <= threshold) {
      best = pt
      bestDist = d
    }
  }

  const grid = snapTime(t)
  if (Math.abs(grid - t) < bestDist) return grid
  return best
}
