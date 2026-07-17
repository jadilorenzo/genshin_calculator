import { useMemo } from 'react'
import { HARD_PITY, SOFT_PITY_START, nextFiveStarDistribution } from '../../model/wishes.ts'

interface PitySegment {
  start: number
  end: number
}

/** Worst-case path along the pity axis: always ride to hard pity, then loop. */
function budgetSegments(startPity: number, pulls: number): PitySegment[] {
  if (pulls <= 0) return []
  const segments: PitySegment[] = []
  let pity = startPity
  let left = pulls
  let guard = 0

  while (left > 0 && guard < 8) {
    const room = HARD_PITY - pity
    const take = Math.min(left, room)
    segments.push({ start: pity, end: pity + take })
    left -= take
    pity = 0
    guard += 1
  }

  return segments
}

function budgetEndPity(startPity: number, pulls: number): number {
  if (pulls <= 0) return startPity
  let pity = startPity
  let left = pulls
  let guard = 0

  while (left > 0 && guard < 8) {
    const room = HARD_PITY - pity
    if (left < room) return pity + left
    left -= room
    pity = 0
    guard += 1
    if (left === 0) return 0
  }

  return pity
}

export function PityChart({
  currentPity,
  pullsAvailable,
  startPity,
}: {
  currentPity: number
  pullsAvailable: number
  /** Optional session-start pity marker (pulling day). */
  startPity?: number
}) {
  const baseline = useMemo(() => nextFiveStarDistribution(0), [])
  const maxProb = Math.max(...baseline.map((p) => p.probability), 1e-9)
  const segments = useMemo(
    () => budgetSegments(currentPity, pullsAvailable),
    [currentPity, pullsAvailable],
  )
  const endPity = useMemo(
    () => budgetEndPity(currentPity, pullsAvailable),
    [currentPity, pullsAvailable],
  )
  const loopsPastFirst = segments.length > 1
  const showStart =
    startPity !== undefined && Number.isFinite(startPity) && startPity !== currentPity
  const progressSegments = useMemo(() => {
    if (!showStart || startPity === undefined) return []
    // Band from session start toward current pity on the first cycle only.
    // If current < start (pity reset after a 5★), skip — path crossed hard pity.
    if (currentPity < startPity) return []
    return [{ start: startPity, end: currentPity }]
  }, [showStart, startPity, currentPity])

  const width = 640
  const height = 220
  const pad = { top: 20, right: 12, bottom: 28, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const x = (pity: number) => pad.left + (pity / HARD_PITY) * innerW
  const y = (prob: number) => pad.top + innerH - (prob / maxProb) * innerH

  const areaPath = baseline
    .map((point, index) => {
      const cmd = index === 0 ? 'M' : 'L'
      return `${cmd}${x(point.pity).toFixed(2)} ${y(point.probability).toFixed(2)}`
    })
    .join(' ')
  const firstPity = baseline[0]?.pity ?? 1
  const areaClosed = `${areaPath} L${x(HARD_PITY).toFixed(2)} ${y(0).toFixed(2)} L${x(firstPity).toFixed(2)} ${y(0).toFixed(2)} Z`

  const youX = x(currentPity)
  const endX = x(endPity)
  const startX = showStart && startPity !== undefined ? x(startPity) : null
  const peak = baseline.reduce((best, p) => (p.probability > best.probability ? p : best))
  const youLabelOffset =
    startX !== null && Math.abs(youX - startX) < 48 ? 24 : 11

  return (
    <figure className="pity-chart">
      <figcaption className="label">Pity distribution</figcaption>
      <svg
        className="pity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Five-star pity distribution. You are at pity ${currentPity}. Peak around pity ${peak.pity}.`}
      >
        <defs>
          <linearGradient id="pity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(226, 197, 122, 0.45)" />
            <stop offset="100%" stopColor="rgba(226, 197, 122, 0.04)" />
          </linearGradient>
        </defs>

        <rect
          x={x(SOFT_PITY_START)}
          y={pad.top}
          width={x(HARD_PITY) - x(SOFT_PITY_START)}
          height={innerH}
          fill="rgba(168, 196, 188, 0.08)"
        />

        {progressSegments.map((segment, index) => {
          const left = x(segment.start)
          const right = x(segment.end)
          if (right <= left) return null
          return (
            <rect
              key={`progress-${segment.start}-${segment.end}-${index}`}
              x={left}
              y={pad.top}
              width={right - left}
              height={innerH}
              fill="rgba(168, 196, 188, 0.22)"
            />
          )
        })}

        {segments.map((segment, index) => {
          const left = x(segment.start)
          const right = x(segment.end)
          if (right <= left) return null
          return (
            <rect
              key={`${segment.start}-${segment.end}-${index}`}
              x={left}
              y={pad.top}
              width={right - left}
              height={innerH}
              fill={index === 0 ? 'rgba(226, 197, 122, 0.14)' : 'rgba(226, 197, 122, 0.22)'}
            />
          )
        })}

        <path d={areaClosed} fill="url(#pity-fill)" />
        <path
          d={areaPath}
          fill="none"
          stroke="var(--gold-bright)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {startX !== null && startPity !== undefined && (
          <>
            <line
              x1={startX}
              x2={startX}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--fog)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <circle cx={startX} cy={y(0)} r="3.5" fill="var(--fog)" />
            <text
              x={startX}
              y={pad.top + 11}
              textAnchor="middle"
              className="chart-marker-label chart-marker-start"
            >
              Start · {startPity}
            </text>
          </>
        )}

        <line
          x1={youX}
          x2={youX}
          y1={pad.top}
          y2={pad.top + innerH}
          stroke="var(--mist)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <circle cx={youX} cy={y(0)} r="4" fill="var(--mist)" />
        <text
          x={youX}
          y={pad.top + youLabelOffset}
          textAnchor="middle"
          className="chart-marker-label"
        >
          {showStart ? `Now · ${currentPity}` : `You · ${currentPity}`}
        </text>

        {pullsAvailable > 0 && endPity !== currentPity && (
          <>
            <line
              x1={endX}
              x2={endX}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--gold-bright)"
              strokeWidth="2"
            />
            <circle cx={endX} cy={y(0)} r="4" fill="var(--gold-bright)" />
            <text
              x={endX}
              y={pad.top + (Math.abs(endX - youX) < 48 ? youLabelOffset + 13 : 11)}
              textAnchor="middle"
              className="chart-marker-label chart-marker-end"
            >
              {loopsPastFirst ? `Loop · ${endPity}` : `End · ${endPity}`}
            </text>
          </>
        )}

        <text x={x(0)} y={height - 8} className="chart-axis">
          0
        </text>
        <text x={x(SOFT_PITY_START)} y={height - 8} textAnchor="middle" className="chart-axis">
          Soft {SOFT_PITY_START}
        </text>
        <text x={x(HARD_PITY)} y={height - 8} textAnchor="end" className="chart-axis">
          {HARD_PITY}
        </text>
      </svg>
      <p className="field-note">
        {showStart
          ? progressSegments.length > 0
            ? 'Mist band = pulls so far this session. Gold band = remaining budget from now.'
            : 'Start marks where this session began. Gold band = remaining budget from now.'
          : loopsPastFirst
            ? 'Saved pulls reach past hard pity, so the gold band loops into the next pity cycle.'
            : 'Gold band = saved pulls from your current pity toward hard pity.'}
      </p>
    </figure>
  )
}
