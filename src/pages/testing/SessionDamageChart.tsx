import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { getCharacter } from '../rotations/characters'
import type { TestingRunEntry } from './testingApi'
import {
  buildSessionDamageSummaries,
  globalChartMax,
} from './sessionDamageSummary'

type SessionDamageChartProps = {
  runs: TestingRunEntry[]
}

const BAR_AREA_PX = 120
const MAX_COMPARE = 4

function formatDamageFull(value: number) {
  return Math.round(value).toLocaleString()
}

function formatDps(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString()
}

function barHeightPx(value: number, max: number) {
  return Math.max(3, (value / max) * BAR_AREA_PX)
}

function barKey(sessionId: string, id: string) {
  return `${sessionId}:${id}`
}

export function SessionDamageChart({ runs }: SessionDamageChartProps) {
  const summaries = useMemo(() => buildSessionDamageSummaries(runs), [runs])
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [hoverBarKey, setHoverBarKey] = useState<string | null>(null)

  useEffect(() => {
    if (summaries.length === 0) return
    setSelectedSessionIds((prev) => {
      const valid = prev.filter((id) =>
        summaries.some((summary) => summary.sessionId === id),
      )
      if (valid.length > 0) return valid.slice(0, MAX_COMPARE)
      return summaries.slice(0, MAX_COMPARE).map((summary) => summary.sessionId)
    })
  }, [summaries])

  const selectedSummaries = useMemo(
    () =>
      selectedSessionIds
        .map((id) => summaries.find((summary) => summary.sessionId === id))
        .filter((summary): summary is NonNullable<typeof summary> =>
          Boolean(summary),
        ),
    [summaries, selectedSessionIds],
  )

  const chartMax = useMemo(
    () => globalChartMax(selectedSummaries),
    [selectedSummaries],
  )

  const atCompareLimit =
    selectedSessionIds.length >= MAX_COMPARE && summaries.length > MAX_COMPARE

  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId)
      }
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, sessionId]
    })
  }

  const isBarHovered = (key: string) => hoverBarKey === key

  if (summaries.length === 0) {
    return (
      <p className="field-note">
        No team damage data yet. Save runs with character breakdowns to compare
        sessions here.
      </p>
    )
  }

  return (
    <div className="testing-session-damage-chart">
      <div
        className="chip-row wrap testing-session-compare-picks"
        role="group"
        aria-label="Sessions to compare (up to 4)"
      >
        {summaries.map((summary) => {
          const selected = selectedSessionIds.includes(summary.sessionId)
          const disabled = atCompareLimit && !selected
          return (
            <button
              key={summary.sessionId}
              type="button"
              className={selected ? 'chip compact active' : 'chip compact'}
              aria-pressed={selected}
              disabled={disabled}
              title={
                disabled
                  ? `Deselect a session first (max ${MAX_COMPARE})`
                  : undefined
              }
              onClick={() => toggleSession(summary.sessionId)}
            >
              {summary.title}
            </button>
          )
        })}
      </div>

      {selectedSummaries.length === 0 ? (
        <p className="field-note">Select at least one session to compare.</p>
      ) : (
        <div className="testing-session-compare-scroll">
          <ul
            className="testing-session-compare-columns"
            aria-label="Compared sessions"
          >
            {selectedSummaries.map((summary) => (
              <li
                key={summary.sessionId}
                className="testing-session-compare-col"
              >
                <Link
                  to={`/testing/${encodeURIComponent(summary.sessionId)}`}
                  className="testing-session-compare-col-head"
                  title={`Open ${summary.title}`}
                >
                  <span className="testing-session-bar-title">
                    {summary.title}
                  </span>
                  <span className="field-note testing-session-bar-meta">
                    {summary.runCount}{' '}
                    {summary.runCount === 1 ? 'run' : 'runs'}
                  </span>
                </Link>

                {summary.characters.length > 0 || summary.peakTeamDamage > 0 ? (
                  <ul className="testing-session-char-columns">
                    {summary.characters.map((character) => {
                      const kit = getCharacter(character.characterId)
                      const element = kit?.element
                      const key = barKey(summary.sessionId, character.key)
                      const hovered = isBarHovered(key)
                      return (
                        <li key={character.key} className="testing-session-char-col">
                          <div
                            className={[
                              'testing-session-bar-hit',
                              hovered ? 'is-hovered' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onMouseEnter={() => setHoverBarKey(key)}
                            onMouseLeave={() => setHoverBarKey(null)}
                          >
                            {hovered ? (
                              <span className="testing-bar-callout">
                                <span className="testing-bar-callout-value">
                                  {formatDamageFull(character.personalDamage)}
                                </span>
                                <span className="testing-bar-callout-sub">
                                  {character.teamPct.toFixed(1)}% team
                                </span>
                              </span>
                            ) : null}
                            <div className="testing-session-bar-slot">
                              <div
                                className="testing-session-bar-track testing-session-bar-track-solid"
                                data-element={element || undefined}
                                style={{
                                  height: `${barHeightPx(character.personalDamage, chartMax)}px`,
                                }}
                              />
                            </div>
                          </div>
                          {kit ? (
                            <CharacterIcon
                              character={kit}
                              className="testing-char-icon"
                            />
                          ) : (
                            <span className="testing-session-bar-char-label">
                              {character.name}
                            </span>
                          )}
                        </li>
                      )
                    })}
                    {summary.peakTeamDamage > 0 ? (
                      <li className="testing-session-char-col testing-session-team-col">
                        {(() => {
                          const key = barKey(summary.sessionId, 'team')
                          const hovered = isBarHovered(key)
                          return (
                            <div
                              className={[
                                'testing-session-bar-hit',
                                hovered ? 'is-hovered' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onMouseEnter={() => setHoverBarKey(key)}
                              onMouseLeave={() => setHoverBarKey(null)}
                            >
                              {hovered ? (
                                <span className="testing-bar-callout">
                                  <span className="testing-bar-callout-value">
                                    {formatDps(summary.peakTeamDps)}
                                  </span>
                                  <span className="testing-bar-callout-sub">
                                    DPS
                                  </span>
                                </span>
                              ) : null}
                              <div className="testing-session-bar-slot">
                                <div
                                  className="testing-session-bar-track testing-session-bar-track-team"
                                  style={{
                                    height: `${barHeightPx(summary.peakTeamDamage, chartMax)}px`,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })()}
                        <span className="testing-session-team-col-label">
                          Team
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="field-note testing-session-bar-empty">
                    No breakdown
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
