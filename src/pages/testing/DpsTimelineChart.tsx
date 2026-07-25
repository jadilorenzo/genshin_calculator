import { useMemo, useState } from 'react'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { getCharacter } from '../rotations/characters'
import type { TestingRun } from './types'

type DpsTimelineChartProps = {
  runs: TestingRun[]
}

const COLORS = [
  '#d4a017',
  '#6eb5ff',
  '#9b7bff',
  '#7dce82',
  '#f07178',
  '#e6c07b',
]

export function DpsTimelineChart({ runs }: DpsTimelineChartProps) {
  const [hover, setHover] = useState<string | null>(null)

  const series = useMemo(() => {
    const byMain = new Map<
      string,
      Array<{ runId: string; index: number; dps: number; label: string }>
    >()
    runs.forEach((run, index) => {
      const dps = run.dps
      if (dps == null || !Number.isFinite(dps)) return
      const key = run.mainDpsId || 'unknown'
      const character = getCharacter(key)
      const label = character?.name || 'Unknown'
      const list = byMain.get(key) || []
      list.push({ runId: run.id, index, dps, label })
      byMain.set(key, list)
    })
    return [...byMain.entries()].map(([id, points], i) => ({
      id,
      label: points[0]?.label || id,
      color: COLORS[i % COLORS.length],
      points,
    }))
  }, [runs])

  if (series.length === 0) {
    return <p className="field-note">Save runs with DPS to see the timeline.</p>
  }

  const width = 640
  const height = 220
  const pad = { top: 16, right: 16, bottom: 36, left: 56 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxIndex = Math.max(1, runs.length - 1)
  const maxDps = Math.max(
    1,
    ...series.flatMap((s) => s.points.map((p) => p.dps)),
  )
  const xAt = (index: number) => pad.left + (index / maxIndex) * innerW
  const yAt = (dps: number) => pad.top + innerH - (dps / maxDps) * innerH

  return (
    <div className="testing-dps-timeline">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="DPS timeline">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t)
          const value = Math.round(maxDps * t)
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className="testing-chart-grid"
              />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="testing-chart-label">
                {value.toLocaleString()}
              </text>
            </g>
          )
        })}
        {series.map((s) => {
          const path = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.index)} ${yAt(p.dps)}`)
            .join(' ')
          return (
            <g key={s.id}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2.2} />
              {s.points.map((p) => (
                <circle
                  key={p.runId}
                  cx={xAt(p.index)}
                  cy={yAt(p.dps)}
                  r={hover === p.runId ? 5 : 3.5}
                  fill={s.color}
                  onMouseEnter={() => setHover(p.runId)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>
                    {s.label}: {p.dps.toLocaleString()} DPS (run {p.index + 1})
                  </title>
                </circle>
              ))}
            </g>
          )
        })}
        <text
          x={pad.left}
          y={height - 10}
          className="testing-chart-label"
        >
          Run order
        </text>
      </svg>
      <ul className="testing-chart-legend">
        {series.map((s) => {
          const character = getCharacter(s.id)
          return (
            <li key={s.id}>
              <span
                className="testing-chart-swatch"
                style={{ background: s.color }}
              />
              {character ? (
                <CharacterIcon
                  character={character}
                  className="testing-char-icon"
                />
              ) : null}
              <span>{s.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
