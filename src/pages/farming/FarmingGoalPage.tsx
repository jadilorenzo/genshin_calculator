import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { TrashIcon } from '../../components/icons'
import { PAGE_TITLES } from '../../documentTitles'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { GoalEditor, MaterialRowIcon } from './farmingUi'
import {
  MATERIAL_CHAR_BY_ID,
  farmScheduleLabel,
  farmableTalentToday,
  materialsProgressFromGroups,
  resourceProgressGrouped,
  type ResourceGroup,
  type ResourceProgress,
} from './materialsData'
import { buildProgress, formatGoalSummary } from './types'
import { useFarmingState } from './useFarmingState'

function MaterialChecklistRow({
  row,
  onOwned,
  locked = false,
}: {
  row: ResourceProgress
  onOwned: (name: string, value: number) => void
  locked?: boolean
}) {
  const schedule = farmScheduleLabel(row.info)
  const titleHint = [schedule, row.info?.domain].filter(Boolean).join(' · ')
  const sliderMax = Math.max(1, row.needed)
  const sliderValue = Math.min(row.owned, sliderMax)
  const fillPct =
    row.needed > 0 ? Math.min(100, (sliderValue / row.needed) * 100) : 100
  return (
    <li
      className={[
        row.owned >= row.needed ? 'done' : '',
        locked ? 'locked' : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined}
      title={titleHint || undefined}
    >
      <div className="farming-resource-main">
        <MaterialRowIcon name={row.name} icon={row.info?.icon} />
        <div className="farming-resource-copy">
          <span className="farming-resource-name">{row.name}</span>
          {schedule ? (
            <span
              className={
                schedule.startsWith('Can farm')
                  ? 'farming-resource-days today'
                  : 'farming-resource-days'
              }
            >
              {schedule}
            </span>
          ) : null}
        </div>
      </div>
      <div className="farming-resource-nums">
        <label className="farming-owned">
          <span className="visually-hidden">Owned {row.name}</span>
          <input
            type="number"
            min={0}
            value={row.owned}
            disabled={locked}
            size={Math.max(String(row.owned).length, String(row.needed).length, 4)}
            style={{
              width: `${Math.min(
                12,
                Math.max(
                  5,
                  Math.max(
                    String(row.owned).length,
                    String(row.needed).length,
                  ) + 2.5,
                ),
              )}ch`,
            }}
            onChange={(e) => onOwned(row.name, Number(e.target.value))}
          />
        </label>
        <span className="field-note">/ {row.needed.toLocaleString()}</span>
        <span className="farming-resource-pct">{row.pct.toFixed(0)}%</span>
      </div>
      <label className="farming-mat-slider">
        <span className="visually-hidden">Progress for {row.name}</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={1}
          value={sliderValue}
          disabled={locked || row.needed <= 0}
          onChange={(e) => onOwned(row.name, Number(e.target.value))}
          style={{ ['--slider-fill' as string]: `${fillPct}%` }}
        />
      </label>
    </li>
  )
}

function ChecklistPanel({
  groups,
  matsProgress,
  matsView,
  setMatsView,
  notObtained,
  locked,
  expanded,
  onToggleExpand,
  onOwned,
}: {
  groups: ResourceGroup[]
  matsProgress: { pct: number; completeCount: number; totalCount: number }
  matsView: 'list' | 'cards'
  setMatsView: (view: 'list' | 'cards') => void
  notObtained: boolean
  locked: boolean
  expanded: boolean
  onToggleExpand: () => void
  onOwned: (name: string, value: number) => void
}) {
  const listClass =
    matsView === 'cards'
      ? 'farming-resource-list farming-resource-list-full cards'
      : 'farming-resource-list farming-resource-list-full'

  return (
    <section
      className={[
        'farming-panel farming-goal-checklist',
        expanded ? 'expanded' : 'compact',
      ].join(' ')}
      aria-label="Materials"
    >
      <div className="farming-panel-head">
        <h3>Checklist</h3>
        <div className="farming-mats-head-actions">
          <span className="field-note">
            {matsProgress.totalCount
              ? `${matsProgress.pct.toFixed(0)}% · ${matsProgress.completeCount}/${matsProgress.totalCount}`
              : '—'}
          </span>
          <div
            className="farming-view-toggle"
            role="group"
            aria-label="Materials layout"
          >
            <button
              type="button"
              className={matsView === 'list' ? 'chip compact active' : 'chip compact'}
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
          <button
            type="button"
            className="chip compact"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {notObtained ? (
        <p className="field-note">
          Materials are treated as unowned while the character is not obtained.
          Uncheck that to apply your inventory.
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className="field-note">
          No materials required for the current build targets.
        </p>
      ) : expanded ? (
        <div className="farming-checklist-groups">
          {groups.map((group) => (
            <section
              key={group.id}
              className="farming-checklist-group"
              aria-label={group.label}
            >
              <h4 className="farming-checklist-group-title">
                {group.label}
                <span className="field-note">
                  {(
                    group.rows.reduce((sum, row) => sum + row.pct, 0) /
                    group.rows.length
                  ).toFixed(0)}
                  % ·{' '}
                  {
                    group.rows.filter(
                      (row) => row.owned >= row.needed || row.checked,
                    ).length
                  }
                  /{group.rows.length}
                </span>
              </h4>
              <ul className={listClass}>
                {group.rows.map((row) => (
                  <MaterialChecklistRow
                    key={`${group.id}:${row.name}`}
                    row={row}
                    locked={locked}
                    onOwned={onOwned}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className={listClass}>
          {groups.flatMap((group) =>
            group.rows.map((row) => (
              <MaterialChecklistRow
                key={`${group.id}:${row.name}`}
                row={row}
                locked={locked}
                onOwned={onOwned}
              />
            )),
          )}
        </ul>
      )}
    </section>
  )
}

/** Full-page view for one character goal + its materials checklist. */
export default function FarmingGoalPage() {
  const { characterId: rawId = '' } = useParams()
  const characterId = decodeURIComponent(rawId)
  const [searchParams, setSearchParams] = useSearchParams()
  const startEditing = searchParams.get('edit') === '1'
  const {
    state,
    plans,
    addCharacter,
    updatePlan,
    updateTalents,
    applyTalentPreset,
    setOwned,
    removeCharacter,
  } = useFarmingState()
  const [matsView, setMatsView] = useLocalStorage<'list' | 'cards'>(
    'gc:farming:matsView',
    'list',
  )
  const [checklistExpanded, setChecklistExpanded] = useLocalStorage(
    'gc:farming:checklistExpanded',
    false,
  )

  const plan = useMemo(
    () => plans.find((p) => p.characterId === characterId) ?? null,
    [plans, characterId],
  )

  useEffect(() => {
    if (!characterId || !MATERIAL_CHAR_BY_ID[characterId] || plan) return
    addCharacter(characterId)
  }, [addCharacter, characterId, plan])

  const mat = plan ? MATERIAL_CHAR_BY_ID[plan.characterId] : null
  const name = mat?.name || characterId
  useDocumentTitle(
    plan ? `${name} · ${PAGE_TITLES.farmingGoal}` : PAGE_TITLES.farming,
  )

  const groups = useMemo(
    () =>
      plan
        ? resourceProgressGrouped(
            plan,
            state.inventory,
            state.checkedMaterials,
          )
        : [],
    [plan, state.inventory, state.checkedMaterials],
  )
  const matsProgress = useMemo(
    () => materialsProgressFromGroups(groups),
    [groups],
  )
  const talentFarmToday = useMemo(
    () => (groups.length ? farmableTalentToday(groups) : null),
    [groups],
  )
  const buildPct = plan ? buildProgress(plan).pct : 0

  if (!MATERIAL_CHAR_BY_ID[characterId]) {
    return <Navigate to="/farming" replace />
  }

  if (!plan) {
    return <p className="field-note">Loading goal…</p>
  }

  const onRemove = () => {
    if (
      !window.confirm(
        `Delete the build goal for ${name}? This can’t be undone.`,
      )
    ) {
      return
    }
    removeCharacter(plan.characterId)
    // Let the !plan redirect handle navigation after state updates, so the list
    // remounts against the updated store.
  }

  const checklistProps = {
    groups,
    matsProgress,
    matsView,
    setMatsView,
    notObtained: plan.notObtained,
    locked: plan.notObtained,
    expanded: checklistExpanded,
    onToggleExpand: () => setChecklistExpanded(!checklistExpanded),
    onOwned: setOwned,
  }

  return (
    <main
      className={[
        'farming-page farming-goal-page',
        checklistExpanded ? 'checklist-expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="farming-goal-hero">
        <div className="mine-section-head farming-goal-head">
          <div className="mine-section-copy">
            <p className="farming-back">
              <Link to="/farming" className="chip compact">
                ← Character Goals
              </Link>
            </p>
            <h2>{name}</h2>
            <p className="field-note">{formatGoalSummary(plan)}</p>
          </div>
          <div className="farming-goal-head-actions">
            <div className="farming-goal-head-pct">
              <div className="farming-dual-pct">
                <span className="farming-overall-value">
                  {`${buildPct.toFixed(0)}%`}
                </span>
                <span className="field-note">built</span>
              </div>
              <div className="farming-dual-pct mats">
                <span className="farming-overall-value mats">
                  {matsProgress.totalCount
                    ? `${matsProgress.pct.toFixed(0)}%`
                    : '—'}
                </span>
                <span className="field-note">
                  mats
                  {matsProgress.totalCount
                    ? ` · ${matsProgress.completeCount}/${matsProgress.totalCount}`
                    : ''}
                </span>
              </div>
            </div>
            <button type="button" className="chip compact farming-delete-btn" onClick={onRemove}>
              <TrashIcon />
              Delete
            </button>
          </div>
        </div>

        <div className="farming-dual-tracks" aria-label="Build and checklist progress">
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Built</span>
            <div className="farming-progress-track farming-goal-head-track">
              <div
                className="farming-progress-fill"
                style={{ width: `${Math.min(100, buildPct)}%` }}
              />
            </div>
          </div>
          <div className="farming-dual-track">
            <span className="farming-dual-track-label">Mats</span>
            <div className="farming-progress-track farming-goal-head-track mats">
              <div
                className="farming-progress-fill mats"
                style={{
                  width: `${Math.min(100, matsProgress.pct)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {talentFarmToday ? (
        <div className="farming-farmable-banner" role="status">
          <div className="farming-farmable-banner-copy">
            <strong>Talent materials available today</strong>
            <p>
              {talentFarmToday.domain
                ? `${talentFarmToday.domain} · `
                : ''}
              {talentFarmToday.names.length <= 3
                ? talentFarmToday.names.join(', ')
                : `${talentFarmToday.names.slice(0, 2).join(', ')} +${talentFarmToday.names.length - 2} more`}
            </p>
          </div>
          {!checklistExpanded ? (
            <button
              type="button"
              className="chip compact"
              onClick={() => setChecklistExpanded(true)}
            >
              Open checklist
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={[
          'farming-goal-layout',
          checklistExpanded ? 'expanded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="farming-goal-main">
          <section className="farming-panel" aria-label="Build">
            <GoalEditor
              plan={plan}
              matsPct={matsProgress.pct}
              matsComplete={matsProgress.completeCount}
              matsTotal={matsProgress.totalCount}
              onUpdate={updatePlan}
              onTalent={updateTalents}
              onPreset={applyTalentPreset}
              onRemove={onRemove}
              initiallyEditing={startEditing}
              onConfirmGoal={() => {
                if (!searchParams.has('edit')) return
                const next = new URLSearchParams(searchParams)
                next.delete('edit')
                setSearchParams(next, { replace: true })
              }}
            />
          </section>
        </div>

        {!checklistExpanded ? (
          <aside className="farming-goal-side">
            <ChecklistPanel {...checklistProps} />
          </aside>
        ) : null}
      </div>

      {checklistExpanded ? (
        <div className="farming-goal-checklist-below">
          <ChecklistPanel {...checklistProps} />
        </div>
      ) : null}
    </main>
  )
}
