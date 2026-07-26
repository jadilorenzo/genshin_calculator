import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClearPageButton } from '../../components/ClearPageButton'
import { TrashIcon } from '../../components/icons'
import { PAGE_TITLES } from '../../documentTitles'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'
import {
  MATERIAL_CHAR_BY_ID,
  MATERIAL_CHARACTERS,
  materialsProgressFromGroups,
  resourceProgressGrouped,
} from './materialsData'
import {
  RECOMMENDED_GOALS,
  recommendedPlanSeed,
  type RecommendedGoal,
} from './recommendations'
import {
  buildProgress,
  formatGoalSummary,
  type FarmingPlanEntry,
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
    removeCharacter,
  } = useFarmingState()
  const [goalQuery, setGoalQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

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
    navigate(`/mine/farming/${encodeURIComponent(addId)}?edit=1`, {
      replace: true,
    })
  }, [searchParams, setSearchParams, addCharacter, navigate])

  const matsOverall = useMemo(() => {
    if (plans.length === 0) {
      return { pct: 0, completeCount: 0, totalCount: 0 }
    }
    let pctSum = 0
    let completeCount = 0
    let totalCount = 0
    let counted = 0
    for (const plan of plans) {
      const mats = materialsProgressFromGroups(
        resourceProgressGrouped(
          plan,
          state.inventory,
          state.checkedMaterials,
        ),
      )
      if (mats.totalCount === 0) continue
      pctSum += mats.pct
      completeCount += mats.completeCount
      totalCount += mats.totalCount
      counted += 1
    }
    return {
      pct: counted > 0 ? pctSum / counted : 0,
      completeCount,
      totalCount,
    }
  }, [plans, state.inventory, state.checkedMaterials])

  const overallBuildPct = useMemo(() => {
    if (plans.length === 0) return null
    const sum = plans.reduce((acc, plan) => acc + buildProgress(plan).pct, 0)
    return sum / plans.length
  }, [plans])

  const goalStats = useMemo(() => {
    const active = plans.filter((p) => !p.checked)
    const done = plans.filter((p) => p.checked).length
    return { total: plans.length, active: active.length, done }
  }, [plans])

  const filteredPlans = useMemo(() => {
    const q = goalQuery.trim().toLowerCase()
    if (!q) return plans
    return plans.filter((plan) => {
      const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
      const name = (mat?.name || plan.characterId).toLowerCase()
      const summary = formatGoalSummary(plan).toLowerCase()
      return (
        name.includes(q) ||
        plan.characterId.includes(q) ||
        (mat?.element || '').toLowerCase().includes(q) ||
        summary.includes(q)
      )
    })
  }, [plans, goalQuery])

  const startGoal = (
    characterId: string,
    seed?: Parameters<typeof addCharacter>[1],
  ) => {
    addCharacter(characterId, seed)
    setAddOpen(false)
    navigate(`/mine/farming/${encodeURIComponent(characterId)}?edit=1`)
  }

  return (
    <main className="farming-page farming-dashboard">
      <div className="mine-section-head">
        <div className="mine-section-copy">
          <h2>Build goals</h2>
          <p className="field-note">
            Levels, talents, and materials for each character you’re farming.
          </p>
        </div>
        <ClearPageButton prefix="gc:farming:" label="Clear goals" />
      </div>

      <div className="farming-overall-bar">
        <div className="farming-overall-copy">
          <span className="farming-stat-label">Overall</span>
          <span className="farming-overall-value">
            {overallBuildPct == null ? '—' : `${overallBuildPct.toFixed(0)}%`}
          </span>
          <span className="field-note">built</span>
          <span className="farming-overall-value mats">
            {matsOverall.totalCount ? `${matsOverall.pct.toFixed(0)}%` : '—'}
          </span>
          <span className="field-note">
            mats
            {goalStats.active ? ` · ${goalStats.active} active` : ''}
            {goalStats.done ? ` · ${goalStats.done} done` : ''}
            {matsOverall.totalCount
              ? ` · ${matsOverall.completeCount}/${matsOverall.totalCount}`
              : ''}
          </span>
        </div>
        <div className="farming-dual-tracks">
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Built</span>
            <div className="farming-progress-track large">
              <div
                className="farming-progress-fill"
                style={{
                  width: `${Math.min(100, overallBuildPct ?? 0)}%`,
                }}
              />
            </div>
          </div>
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Mats</span>
            <div className="farming-progress-track large mats">
              <div
                className="farming-progress-fill mats"
                style={{
                  width: `${Math.min(100, matsOverall.pct)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <section className="farming-panel" aria-label="Goals">
        <div className="farming-panel-head">
          <h3>Your builds</h3>
          <span className="field-note">{goalStats.total} saved</span>
        </div>

        <div className="farming-goals-toolbar">
          <div className="farming-goal-search">
            <span className="label" id="farming-goal-search-label">
              Search goals
            </span>
            <div className="farming-goal-search-row">
              <input
                type="search"
                value={goalQuery}
                onChange={(e) => setGoalQuery(e.target.value)}
                placeholder="Filter by name, element…"
                aria-labelledby="farming-goal-search-label"
              />
              <button
                type="button"
                className="chip farming-add-btn"
                onClick={() => setAddOpen(true)}
              >
                Add goal
              </button>
            </div>
          </div>
        </div>

        {plans.length === 0 ? (
          <p className="field-note farming-empty">
            No build goals yet. Add a character to start tracking.
          </p>
        ) : filteredPlans.length === 0 ? (
          <p className="field-note farming-empty">
            No goals match “{goalQuery.trim()}”.
          </p>
        ) : (
          <ul className="farming-plan-list">
            {filteredPlans.map((plan) => (
              <GoalListRow
                key={plan.characterId}
                plan={plan}
                inventory={state.inventory}
                checkedMaterials={state.checkedMaterials}
                onDelete={() => {
                  const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
                  const label = mat?.name || plan.characterId
                  if (
                    !window.confirm(
                      `Delete the build goal for ${label}? This can’t be undone.`,
                    )
                  ) {
                    return
                  }
                  removeCharacter(plan.characterId)
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <AddGoalModal
        open={addOpen}
        plannedIds={plannedIds}
        onClose={() => setAddOpen(false)}
        onPick={startGoal}
      />
    </main>
  )
}

function GoalListRow({
  plan,
  inventory,
  checkedMaterials,
  onDelete,
}: {
  plan: FarmingPlanEntry
  inventory: Record<string, number>
  checkedMaterials: Record<string, boolean>
  onDelete: () => void
}) {
  const mat = MATERIAL_CHAR_BY_ID[plan.characterId]
  const kit =
    getCharacter(plan.characterId) ||
    CHARACTER_KITS.find((c) => c.name === mat?.name)
  const name = mat?.name || plan.characterId
  const progress = buildProgress(plan)
  const mats = materialsProgressFromGroups(
    resourceProgressGrouped(plan, inventory, checkedMaterials),
  )
  return (
    <li
      className={['farming-goal-row', plan.checked ? 'done' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <Link
        to={`/mine/farming/${encodeURIComponent(plan.characterId)}`}
        className="farming-goal-row-main"
      >
        {kit ? (
          <CharacterIcon character={kit} className="testing-char-icon" />
        ) : null}
        <span className="farming-goal-copy">
          <span className="farming-goal-name">{name}</span>
          <span className="farming-goal-summary">
            {formatGoalSummary(plan)}
            {plan.notObtained ? ' · Not obtained' : ''}
          </span>
        </span>
        <span className="farming-goal-row-pcts">
          {plan.checked ? (
            'Done'
          ) : (
            <>
              <span>{`${progress.pct.toFixed(0)}%`}</span>
              <span className="field-note">built</span>
              <span className="mats">
                {mats.totalCount ? `${mats.pct.toFixed(0)}%` : '—'}
              </span>
              <span className="field-note">mats</span>
            </>
          )}
        </span>
      </Link>
      <button
        type="button"
        className="chip compact farming-goal-delete farming-delete-btn"
        aria-label={`Delete ${name} goal`}
        onClick={onDelete}
      >
        <TrashIcon />
        Delete
      </button>
    </li>
  )
}

function AddGoalModal({
  open,
  plannedIds,
  onClose,
  onPick,
}: {
  open: boolean
  plannedIds: Set<string>
  onClose: () => void
  onPick: (characterId: string, seed?: FarmingPlanEntry) => void
}) {
  const titleId = useId()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MATERIAL_CHARACTERS.filter((c) => {
      if (plannedIds.has(c.id)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q) ||
        c.id.includes(q)
      )
    }).slice(0, 16)
  }, [query, plannedIds])

  const recommendations = useMemo(
    () =>
      RECOMMENDED_GOALS.filter(
        (rec) =>
          MATERIAL_CHAR_BY_ID[rec.characterId] &&
          !plannedIds.has(rec.characterId),
      ).slice(0, 6),
    [plannedIds],
  )

  if (!open) return null

  return createPortal(
    <div
      className="farming-add-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="farming-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="farming-add-dialog-head">
          <h3 id={titleId}>Add build goal</h3>
          <button type="button" className="chip compact" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="field">
          <span className="label">Character</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Columbina, Nefer…"
            autoFocus
          />
        </label>

        {!query.trim() && recommendations.length > 0 ? (
          <div className="farming-recs farming-add-dialog-recs">
            <p className="farming-section-note">Recommended</p>
            <ul className="farming-picker-list">
              {recommendations.map((rec) => (
                <RecommendationRow
                  key={rec.characterId}
                  rec={rec}
                  onPick={onPick}
                />
              ))}
            </ul>
            <p className="field-note farming-add-dialog-hint">
              Search above for any other character.
            </p>
          </div>
        ) : (
          <ul className="farming-picker-list farming-add-dialog-list">
            {matches.length === 0 ? (
              <li className="field-note">
                {query.trim()
                  ? 'No matches'
                  : 'Every character already has a goal.'}
              </li>
            ) : (
              matches.map((c) => {
                const kit = getCharacter(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="farming-picker-item"
                      onClick={() => onPick(c.id)}
                    >
                      {kit ? (
                        <CharacterIcon
                          character={kit}
                          className="testing-char-icon"
                        />
                      ) : null}
                      <span className="farming-picker-name">{c.name}</span>
                      <span className="field-note">{c.element}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function RecommendationRow({
  rec,
  onPick,
}: {
  rec: RecommendedGoal
  onPick: (characterId: string, seed?: FarmingPlanEntry) => void
}) {
  const mat = MATERIAL_CHAR_BY_ID[rec.characterId]
  const kit = getCharacter(rec.characterId)
  return (
    <li>
      <button
        type="button"
        className="farming-picker-item farming-picker-item-rich"
        onClick={() => onPick(rec.characterId, recommendedPlanSeed(rec))}
      >
        {kit ? (
          <CharacterIcon character={kit} className="testing-char-icon" />
        ) : null}
        <span className="farming-picker-copy">
          <span className="farming-picker-name">
            {mat?.name || rec.characterId}
          </span>
          <span className="field-note">{rec.blurb}</span>
        </span>
        <span className="farming-rec-tag">{rec.tag}</span>
      </button>
    </li>
  )
}
