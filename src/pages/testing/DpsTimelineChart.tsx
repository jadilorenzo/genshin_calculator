import { useEffect, useMemo, useRef, useState } from 'react'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { getCharacter } from '../rotations/characters'
import { dpsChartLayout } from './dpsChartLayout'
import { runTimestampMs, sortTestingRunsByTimestamp } from './runSort'
import type { TestingRun } from './types'

type DpsTimelineChartProps = {
  runs: TestingRun[]
  selectedRunId?: string | null
  onSelectRun?: (runId: string) => void
  runMeta?: Map<string, string>
}

const COLORS = [
  '#d4a017',
  '#6eb5ff',
  '#9b7bff',
  '#7dce82',
  '#f07178',
  '#e6c07b',
]

type ChartPoint = {
  runId: string
  index: number
  dps: number
  label: string
  timeLabel: string
  meta?: string
}

export function DpsTimelineChart({
  runs,
  selectedRunId = null,
  onSelectRun,
  runMeta,
}: DpsTimelineChartProps) {
  const [hover, setHover] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { series, pointCount, maxDps } = useMemo(() => {
    const orderedRuns = sortTestingRunsByTimestamp(runs)
    const dpsRuns = orderedRuns.filter(
      (run) => run.dps != null && Number.isFinite(run.dps),
    )
    const byMain = new Map<string, ChartPoint[]>()

    dpsRuns.forEach((run, index) => {
      const dps = run.dps!
      const key = run.mainDpsId || 'unknown'
      const character = getCharacter(key)
      const list = byMain.get(key) || []
      list.push({
        runId: run.id,
        index,
        dps,
        label: character?.name || 'Unknown',
        timeLabel: new Date(runTimestampMs(run)).toLocaleString(),
        meta: runMeta?.get(run.id),
      })
      byMain.set(key, list)
    })

    const builtSeries = [...byMain.entries()].map(([id, points], i) => ({
      id,
      label: points[0]?.label || id,
      color: COLORS[i % COLORS.length],
      points: [...points].sort((a, b) => a.index - b.index),
    }))

    const maxDpsValue = Math.max(
      1,
      ...builtSeries.flatMap((s) => s.points.map((p) => p.dps)),
    )

    return {
      series: builtSeries,
      pointCount: dpsRuns.length,
      maxDps: maxDpsValue,
    }
  }, [runs, runMeta])

  const { axisWidth, plotWidth, plotSvgWidth, height, pad, innerH, xAt, yAt } =
    useMemo(
      () => dpsChartLayout(pointCount, maxDps),
      [pointCount, maxDps],
    )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      if (delta === 0) return

      event.preventDefault()
      el.scrollLeft += delta
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [plotSvgWidth])

  if (series.length === 0) {
    return <p className="field-note">Save runs with DPS to see the timeline.</p>
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="testing-dps-timeline">
      <div className="testing-dps-timeline-plot-wrap">
        <svg
          className="testing-dps-timeline-axis"
          viewBox={`0 0 ${axisWidth} ${height}`}
          width={axisWidth}
          height={height}
          aria-hidden
        >
          {yTicks.map((t) => {
            const y = pad.top + innerH * (1 - t)
            return (
              <text
                key={t}
                x={axisWidth - 8}
                y={y + 4}
                textAnchor="end"
                className="testing-chart-label"
              >
                {Math.round(maxDps * t).toLocaleString()}
              </text>
            )
          })}
        </svg>
        <div className="testing-dps-timeline-scroll" ref={scrollRef}>
          <svg
            className="testing-dps-timeline-plot"
            viewBox={`0 0 ${plotSvgWidth} ${height}`}
            width={plotSvgWidth}
            height={height}
            role="img"
            aria-label="DPS timeline"
          >
            {yTicks.map((t) => {
              const y = pad.top + innerH * (1 - t)
              return (
                <line
                  key={t}
                  x1={0}
                  x2={plotWidth}
                  y1={y}
                  y2={y}
                  className="testing-chart-grid"
                />
              )
            })}
            {series.map((s) => {
              const path = s.points
                .map(
                  (p, i) =>
                    `${i === 0 ? 'M' : 'L'} ${xAt(p.index)} ${yAt(p.dps)}`,
                )
                .join(' ')
              return (
                <g key={s.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.2}
                  />
                  {s.points.map((p) => {
                    const selected = p.runId === selectedRunId
                    const active = selected || hover === p.runId
                    return (
                      <g key={p.runId}>
                        {selected ? (
                          <circle
                            cx={xAt(p.index)}
                            cy={yAt(p.dps)}
                            r={9}
                            className="testing-chart-point-ring"
                            fill="none"
                          />
                        ) : null}
                        {hover === p.runId ? (
                          <text
                            x={xAt(p.index)}
                            y={yAt(p.dps) - 10}
                            textAnchor="middle"
                            className="testing-chart-point-label"
                          >
                            {p.dps.toLocaleString()}
                          </text>
                        ) : null}
                        <circle
                          cx={xAt(p.index)}
                          cy={yAt(p.dps)}
                          r={active ? 5.5 : 3.5}
                          fill={s.color}
                          className={
                            onSelectRun ? 'testing-chart-point' : undefined
                          }
                          role={onSelectRun ? 'button' : undefined}
                          tabIndex={onSelectRun ? 0 : undefined}
                          aria-label={
                            onSelectRun
                              ? `Select run ${p.index + 1}: ${p.dps.toLocaleString()} DPS`
                              : undefined
                          }
                          aria-pressed={onSelectRun ? selected : undefined}
                          onMouseEnter={() => setHover(p.runId)}
                          onMouseLeave={() => setHover(null)}
                          onClick={
                            onSelectRun
                              ? () => onSelectRun(p.runId)
                              : undefined
                          }
                          onKeyDown={
                            onSelectRun
                              ? (event) => {
                                  if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                  ) {
                                    event.preventDefault()
                                    onSelectRun(p.runId)
                                  }
                                }
                              : undefined
                          }
                        >
                          <title>
                            {s.label}: {p.dps.toLocaleString()} DPS ·{' '}
                            {p.timeLabel}
                            {p.meta ? ` · ${p.meta}` : ''}
                          </title>
                        </circle>
                      </g>
                    )
                  })}
                </g>
              )
            })}
            <text x={0} y={height - 10} className="testing-chart-label">
              Run order (oldest first)
            </text>
          </svg>
        </div>
      </div>
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
