import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClearPageButton } from '../../components/ClearPageButton'
import { PAGE_TITLES } from '../../documentTitles'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'
import {
  aggregateNeeds,
  MATERIAL_CHAR_BY_ID,
  MATERIAL_CHARACTERS,
  overallProgress,
  planProgress,
  resourceProgressList,
} from './materialsData'
import {
  RECOMMENDED_GOALS,
  recommendedPlanSeed,
} from './recommendations'
import {
  formatGoalSummary,
} from './types'
import { useFarmingState } from './useFarmingState'

/** Full-page list of character goals. */
export default function FarmingPage() {
  useDocumentTitle(PAGE_TITLES.farming)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    state,
    plans,
    plannedIds,
    addCharacter,
  } = useFarmingState()
  const [pickerQuery, setPickerQuery] = useState('')
  const [recsOpen, setRecsOpen] = useState(true)

  // Deep-link from Characters: /mine/farming?add=<characterId>
  useEffect(() => {
    const addId = searchParams.get('add') || searchParams.get('character')
    if (!addId) return
    if (!MATERIAL_CHAR_BY_ID[addId]) {
      setSearchParams({}, { replace: true })
      return
    }
    addCharacter(addId)
    setSearchParams({}, { replace: true })
    navigate(`/mine/farming/${encodeURIComponent(addId)}`, { replace: true })
  }, [searchParams, setSearchParams, addCharacter, navigate])

  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    return MATERIAL_CHARACTERS.filter((c) => {
      if (plannedIds.has(c.id)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q) ||
        c.id.includes(q)
      )
    }).slice(0, 14)
  }, [pickerQuery, plannedIds])

  const overall = useMemo(
    () =>
      overallProgress(
        resourceProgressList(
          aggregateNeeds(plans),
          state.inventory,
          state.checkedMaterials,
        ),
      ),
    [plans, state.inventory, state.checkedMaterials],
  )

  const goalStats = useMemo(() => {
    const active = plans.filter((p) => !p.checked)
    const done = plans.filter((p) => p.checked).length
    return { total: plans.length, active: active.length, done }
  }, [plans])

  const recommendations = useMemo(
    () =>
      RECOMMENDED_GOALS.filter(
        (rec) =>
          MATERIAL_CHAR_BY_ID[rec.characterId] &&
          !plannedIds.has(rec.characterId),
      ).slice(0, plans.length === 0 ? 8 : 6),
    [plannedIds, plans.length],
  )

  const startGoal = (characterId: string, seed?: Parameters<typeof addCharacter>[1]) => {
    addCharacter(characterId, seed)
    setPickerQuery('')
    navigate(`/mine/farming/${encodeURIComponent(characterId)}`)
  }

  return (
    <main className="farming-page farming-dashboard">
      <div className="mine-section-head">
        <div className="mine-section-copy">
          <h2>Character goals</h2>
          <p className="field-note">
            Open a goal to track its materials, or start a new build.
          </p>
        </div>
        <ClearPageButton prefix="gc:farming:" label="Clear farming" />
      </div>

      <div className="farming-overall-bar">
        <div className="farming-overall-copy">
          <span className="farming-stat-label">Overall progress</span>
          <span className="farming-overall-value">
            {overall.neededUnits === 0 ? '—' : `${overall.pct.toFixed(0)}%`}
          </span>
          <span className="field-note">
            {goalStats.active} active
            {goalStats.done ? ` · ${goalStats.done} done` : ''}
            {overall.totalCount
              ? ` · ${overall.completeCount}/${overall.totalCount} materials`
              : ''}
          </span>
        </div>
        <div className="farming-progress-track large">
          <div
            className="farming-progress-fill"
            style={{ width: `${Math.min(100, overall.pct)}%` }}
          />
        </div>
      </div>

      <section className="farming-panel" aria-label="Goals">
        <div className="farming-panel-head">
          <h3>Goals</h3>
          <span className="field-note">{goalStats.total} saved</span>
        </div>

        <label className="field farming-add">
          <span className="label">New goal</span>
          <input
            type="search"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="Search Columbina, Nefer…"
          />
        </label>

        {pickerQuery.trim() ? (
          <ul className="farming-picker-list">
            {pickerMatches.length === 0 ? (
              <li className="field-note">No matches</li>
            ) : (
              pickerMatches.map((c) => {
                const kit = getCharacter(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="farming-picker-item"
                      onClick={() => startGoal(c.id)}
                    >
                      {kit ? (
                        <CharacterIcon
                          character={kit}
                          className="testing-char-icon"
                        />
                      ) : null}
                      <span>{c.name}</span>
                      <span className="field-note">{c.element}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        ) : null}

        {!pickerQuery.trim() &&
        plans.length === 0 &&
        recommendations.length > 0 ? (
          <div className="farming-recs">
            <button
              type="button"
              className="farming-recs-toggle"
              aria-expanded={recsOpen}
              onClick={() => setRecsOpen((open) => !open)}
            >
              <span>Recommended</span>
              <span className="field-note">{recsOpen ? 'Hide' : 'Show'}</span>
            </button>
            {recsOpen ? (
              <ul className="farming-recs-list">
                {recommendations.map((rec) => {
                  const mat = MATERIAL_CHAR_BY_ID[rec.characterId]
                  const kit = getCharacter(rec.characterId)
                  return (
                    <li key={rec.characterId}>
                      <button
                        type="button"
                        className="farming-rec-card"
                        onClick={() =>
                          startGoal(
                            rec.characterId,
                            recommendedPlanSeed(rec),
                          )
                        }
                      >
                        {kit ? (
                          <CharacterIcon
                            character={kit}
                            className="testing-char-icon"
                          />
                        ) : null}
                        <span className="farming-rec-copy">
                          <span className="farming-rec-name">
                            {mat?.name || rec.characterId}
                          </span>
                          <span className="farming-rec-blurb">{rec.blurb}</span>
                        </span>
                        <span className="farming-rec-tag">{rec.tag}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {plans.length === 0 ? (
          <p className="field-note farming-empty">
            Search or pick a recommendation to open a goal page.
          </p>
        ) : (
          <ul className="farming-plan-list">
            {plans.map((plan) => {
              const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
              const kit =
                getCharacter(plan.characterId) ||
                CHARACTER_KITS.find((c) => c.name === mat?.name)
              const name = mat?.name || plan.characterId
              const progress = planProgress(
                plan,
                state.inventory,
                state.checkedMaterials,
              )
              return (
                <li key={plan.characterId}>
                  <Link
                    to={`/mine/farming/${encodeURIComponent(plan.characterId)}`}
                    className={[
                      'farming-goal-row',
                      plan.checked ? 'done' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {kit ? (
                      <CharacterIcon
                        character={kit}
                        className="testing-char-icon"
                      />
                    ) : null}
                    <span className="farming-goal-copy">
                      <span className="farming-goal-name">{name}</span>
                      <span className="farming-goal-summary">
                        {formatGoalSummary(plan)}
                      </span>
                    </span>
                    <span className="farming-goal-row-pct">
                      {plan.checked ? 'Done' : `${progress.pct.toFixed(0)}%`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
