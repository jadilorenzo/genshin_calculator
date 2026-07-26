import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PAGE_TITLES } from '../../documentTitles'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'
import { GoalEditor, MaterialRowIcon } from './farmingUi'
import {
  MATERIAL_CHAR_BY_ID,
  materialsForWeekday,
  overallProgress,
  planNeeds,
  planProgress,
  resourceProgressList,
} from './materialsData'
import { formatGoalSummary, WEEKDAYS } from './types'
import { useFarmingState } from './useFarmingState'

function todayWeekday(): string {
  return WEEKDAYS[new Date().getDay()]
}

/** Full-page view for one character goal + its materials checklist. */
export default function FarmingGoalPage() {
  const { characterId: rawId = '' } = useParams()
  const characterId = decodeURIComponent(rawId)
  const navigate = useNavigate()
  const {
    state,
    plans,
    updatePlan,
    updateTalents,
    applyTalentPreset,
    setOwned,
    toggleMaterialChecked,
    removeCharacter,
  } = useFarmingState()
  const [weekday, setWeekday] = useState(todayWeekday)
  const [matsView, setMatsView] = useLocalStorage<'list' | 'cards'>(
    'gc:farming:matsView',
    'list',
  )

  const plan = useMemo(
    () => plans.find((p) => p.characterId === characterId) ?? null,
    [plans, characterId],
  )

  const mat = plan ? MATERIAL_CHAR_BY_ID[plan.characterId] : null
  const name = mat?.name || characterId
  useDocumentTitle(
    plan ? `${name} · ${PAGE_TITLES.farmingGoal}` : PAGE_TITLES.farming,
  )

  const needs = useMemo(() => {
    if (!plan || plan.checked) return {}
    return planNeeds(plan)
  }, [plan])

  const resources = useMemo(
    () =>
      resourceProgressList(needs, state.inventory, state.checkedMaterials),
    [needs, state.inventory, state.checkedMaterials],
  )
  const progress = useMemo(() => overallProgress(resources), [resources])
  const planPct = plan
    ? planProgress(plan, state.inventory, state.checkedMaterials)
    : null

  const scheduleMats = useMemo(() => {
    const todayMats = materialsForWeekday(weekday)
    const neededNames = new Set(Object.keys(needs))
    return todayMats.filter((m) => neededNames.has(m.name))
  }, [weekday, needs])

  if (!MATERIAL_CHAR_BY_ID[characterId]) {
    return <Navigate to="/mine/farming" replace />
  }

  if (!plan) {
    return <Navigate to="/mine/farming" replace />
  }

  const kit =
    getCharacter(plan.characterId) ||
    CHARACTER_KITS.find((c) => c.name === mat?.name)

  const onRemove = () => {
    removeCharacter(plan.characterId)
    navigate('/mine/farming')
  }

  return (
    <main className="farming-page farming-goal-page">
      <div className="mine-section-head">
        <div className="mine-section-copy">
          <p className="farming-back">
            <Link to="/mine/farming" className="chip compact">
              ← Goals
            </Link>
          </p>
          <h2>{name}</h2>
          <p className="field-note">{formatGoalSummary(plan)}</p>
        </div>
        <button type="button" className="chip compact" onClick={onRemove}>
          Remove goal
        </button>
      </div>

      <div className="farming-overall-bar">
        <div className="farming-overall-copy">
          <span className="farming-stat-label">Goal progress</span>
          <span className="farming-overall-value">
            {plan.checked
              ? '100%'
              : planPct
                ? `${planPct.pct.toFixed(0)}%`
                : '—'}
          </span>
          <span className="field-note">
            {progress.totalCount
              ? `${progress.completeCount}/${progress.totalCount} materials`
              : 'No materials required'}
            {planPct && !plan.checked
              ? ` · ${planPct.remainingUnits.toLocaleString()} units left`
              : ''}
          </span>
        </div>
        <div className="farming-progress-track large">
          <div
            className="farming-progress-fill"
            style={{
              width: `${plan.checked ? 100 : Math.min(100, planPct?.pct ?? 0)}%`,
            }}
          />
        </div>
      </div>

      <section className="farming-panel" aria-label="Build form">
        <div className="farming-panel-head">
          <h3>Build form</h3>
          {kit ? (
            <CharacterIcon character={kit} className="testing-char-icon" />
          ) : null}
        </div>
        <GoalEditor
          plan={plan}
          inventory={state.inventory}
          checkedMaterials={state.checkedMaterials}
          onUpdate={updatePlan}
          onTalent={updateTalents}
          onPreset={applyTalentPreset}
        />
      </section>

      <section className="farming-panel" aria-label="Today’s domains">
        <div className="farming-panel-head">
          <h3>Today’s domains</h3>
          <label className="farming-day-select">
            <span className="visually-hidden">Weekday</span>
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        </div>
        {scheduleMats.length === 0 ? (
          <p className="field-note">
            {Object.keys(needs).length === 0
              ? 'Nothing to farm for this goal.'
              : `No materials for this goal drop on ${weekday}.`}
          </p>
        ) : (
          <ul className="farming-schedule-list">
            {scheduleMats.map((item) => {
              const row = resources.find((r) => r.name === item.name)
              return (
                <li key={item.name}>
                  <MaterialRowIcon name={item.name} icon={item.icon} />
                  <div className="farming-schedule-copy">
                    <span>{item.name}</span>
                    <span className="field-note">
                      {item.domain || 'Domain material'}
                      {row
                        ? ` · ${row.remaining.toLocaleString()} left`
                        : ''}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="farming-panel farming-goal-checklist" aria-label="Materials">
        <div className="farming-panel-head">
          <h3>Materials checklist</h3>
          <div className="farming-mats-head-actions">
            <span className="field-note">
              {progress.totalCount
                ? `${progress.completeCount}/${progress.totalCount}`
                : 'Empty'}
            </span>
            <div
              className="farming-view-toggle"
              role="group"
              aria-label="Materials layout"
            >
              <button
                type="button"
                className={
                  matsView === 'list' ? 'chip compact active' : 'chip compact'
                }
                onClick={() => setMatsView('list')}
              >
                List
              </button>
              <button
                type="button"
                className={
                  matsView === 'cards' ? 'chip compact active' : 'chip compact'
                }
                onClick={() => setMatsView('cards')}
              >
                Cards
              </button>
            </div>
          </div>
        </div>
        {resources.length === 0 ? (
          <p className="field-note">
            No materials required for the current build targets.
          </p>
        ) : (
          <ul
            className={
              matsView === 'cards'
                ? 'farming-resource-list farming-resource-list-full cards'
                : 'farming-resource-list farming-resource-list-full'
            }
          >
            {resources.map((row) => {
              const daysHint = [
                row.info?.daysOfWeek?.join(' · '),
                row.info?.domain,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={row.name}
                  className={
                    row.checked || row.owned >= row.needed ? 'done' : undefined
                  }
                  title={daysHint || undefined}
                >
                  <label className="farming-check">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={() => toggleMaterialChecked(row.name)}
                      aria-label={`Mark ${row.name} done`}
                    />
                    <MaterialRowIcon name={row.name} icon={row.info?.icon} />
                    <span className="farming-resource-name">{row.name}</span>
                  </label>
                  <div className="farming-resource-nums">
                    <label className="farming-owned">
                      <span className="visually-hidden">Owned {row.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={row.owned}
                        onChange={(e) =>
                          setOwned(row.name, Number(e.target.value))
                        }
                      />
                    </label>
                    <span className="field-note">
                      / {row.needed.toLocaleString()}
                    </span>
                    <span className="farming-resource-pct">
                      {row.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="farming-progress-track">
                    <div
                      className="farming-progress-fill"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  {daysHint ? (
                    <p className="field-note farming-resource-days">
                      {daysHint}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
