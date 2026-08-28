import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { useLocalStorage } from '../../hooks/useLocalStorage.ts'
import { getCharacter } from '../rotations/characters'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { DpsTimelineChart } from './DpsTimelineChart'
import { ScreenshotLightbox } from './ScreenshotLightbox'
import { TeamDamageBars } from './TeamDamageBars'
import { UploadRunsPanel } from './UploadRunsPanel'
import {
  createTestingRun,
  deleteTestingRun,
  getTestingSession,
  updateTestingSession,
} from './testingApi'
import { sortTestingRunsByTimestamp } from './runSort'
import type { RunDraft, TestingRun, TestingSession } from './types'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

/** Compact large numbers (e.g. 7.6M, 96.7k) for KPI cards. */
function formatCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
  }
  return Math.round(value).toLocaleString()
}

function TestingSessionInner({
  sessionId,
  getToken,
}: {
  sessionId: string
  getToken: () => Promise<string | null>
}) {
  useDocumentTitle(PAGE_TITLES.personalTestingSession)
  const [session, setSession] = useState<TestingSession | null>(null)
  const [runs, setRuns] = useState<TestingRun[]>([])
  const [drafts, setDrafts] = useState<RunDraft[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [barMode, setBarMode] = useState<'selected' | 'average-by-main'>(
    'selected',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const metaMenuRef = useRef<HTMLDivElement>(null)
  const metaPanelId = useId()
  const [runsExpanded, setRunsExpanded] = useLocalStorage(
    'gc:testing:runsExpanded',
    false,
  )
  const [expandedScreenshot, setExpandedScreenshot] = useState<{
    url: string
    label: string
  } | null>(null)

  useEffect(() => {
    if (!metaOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!metaMenuRef.current?.contains(event.target as Node)) {
        setMetaOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMetaOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [metaOpen])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getTestingSession(sessionId, getToken)
      setSession(result.item)
      setRuns(sortTestingRunsByTimestamp(result.runs))
      setTitleDraft(result.item.title)
      setNotesDraft(result.item.notes || '')
      setSelectedRunId((prev) => prev || result.runs[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setSession(null)
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [getToken, sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const selectRun = useCallback((runId: string) => {
    setSelectedRunId(runId)
    setBarMode('selected')
    // Defer so the selected class is applied before scrolling.
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-run-id="${runId}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    if (runs.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      const forward = key === 'arrowright' || key === 'd' || key === 's'
      const backward = key === 'arrowleft' || key === 'a' || key === 'w'
      if (!forward && !backward) return
      if (expandedScreenshot || metaOpen) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      const currentIndex = selectedRunId
        ? runs.findIndex((run) => run.id === selectedRunId)
        : -1
      const delta = forward ? 1 : -1
      const nextIndex =
        currentIndex < 0
          ? forward
            ? 0
            : runs.length - 1
          : currentIndex + delta
      if (nextIndex < 0 || nextIndex >= runs.length) return
      const next = runs[nextIndex]
      if (next) selectRun(next.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expandedScreenshot, metaOpen, runs, selectRun, selectedRunId])

  const stats = useMemo(() => {
    const dpsValues = runs
      .map((r) => r.dps)
      .filter((d): d is number => d != null && Number.isFinite(d))
    const bestDpsRun = runs.reduce<TestingRun | null>((best, run) => {
      if (run.dps == null) return best
      if (!best || (best.dps ?? -Infinity) < run.dps) return run
      return best
    }, null)
    const bestHit = runs.reduce(
      (max, run) => Math.max(max, run.strongestHit ?? 0),
      0,
    )
    return {
      runCount: runs.length,
      bestDps: bestDpsRun?.dps ?? null,
      bestDpsMain: bestDpsRun
        ? getCharacter(bestDpsRun.mainDpsId)?.name ?? null
        : null,
      avgDps: dpsValues.length
        ? dpsValues.reduce((a, b) => a + b, 0) / dpsValues.length
        : null,
      bestHit: bestHit || null,
    }
  }, [runs])

  const onSaveMeta = async (e: FormEvent) => {
    e.preventDefault()
    if (!titleDraft.trim() || savingMeta) return
    setSavingMeta(true)
    setError(null)
    try {
      const item = await updateTestingSession(
        sessionId,
        { title: titleDraft.trim(), notes: notesDraft },
        getToken,
      )
      setSession(item)
      setMetaOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save details')
    } finally {
      setSavingMeta(false)
    }
  }

  const onSaveDraft = async (localId: string) => {
    const draft = drafts.find((d) => d.localId === localId)
    if (!draft) return
    setDrafts((prev) =>
      prev.map((d) =>
        d.localId === localId ? { ...d, status: 'saving', error: undefined } : d,
      ),
    )
    try {
      const item = await createTestingRun(
        {
          sessionId,
          sortOrder: runs.length,
          mainDpsId: draft.mainDpsId,
          dps: draft.dps,
          totalDamage: draft.totalDamage,
          elapsedSeconds: draft.elapsedSeconds,
          strongestHit: draft.strongestHit,
          capturedAt: draft.capturedAt,
          characters: draft.characters,
          ocrRaw: draft.ocrRaw,
          imageBase64: draft.imageBase64,
        },
        getToken,
      )
      setRuns((prev) => sortTestingRunsByTimestamp([...prev, item]))
      setSelectedRunId(item.id)
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
      setDrafts((prev) => prev.filter((d) => d.localId !== localId))
    } catch (err) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.localId === localId
            ? {
                ...d,
                status: 'error',
                error: err instanceof Error ? err.message : 'Save failed',
              }
            : d,
        ),
      )
    }
  }

  const onDiscardDraft = (localId: string) => {
    setDrafts((prev) => {
      const draft = prev.find((d) => d.localId === localId)
      if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl)
      return prev.filter((d) => d.localId !== localId)
    })
  }

  const onDeleteRun = async (id: string) => {
    if (!window.confirm('Delete this run?')) return
    try {
      await deleteTestingRun(id, getToken)
      setRuns((prev) => prev.filter((r) => r.id !== id))
      setSelectedRunId((prev) => (prev === id ? null : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete run')
    }
  }

  if (loading) {
    return <p className="field-note">Loading session…</p>
  }

  if (!session) {
    return (
      <main className="panel">
        {error ? <p className="auth-error">{error}</p> : null}
        <Link to="/testing" className="chip compact">
          Back to sessions
        </Link>
      </main>
    )
  }

  return (
    <>
      <header className="hero testing-session-hero">
        <div className="hero-top">
          <h1>{session.title}</h1>
          <div className="hero-actions">
            <div className="testing-session-meta-menu" ref={metaMenuRef}>
              <button
                type="button"
                className={
                  metaOpen ? 'chip compact active' : 'chip compact'
                }
                aria-expanded={metaOpen}
                aria-controls={metaPanelId}
                onClick={() => setMetaOpen((open) => !open)}
              >
                Session details
              </button>
              {metaOpen ? (
                <div
                  className="testing-session-meta-panel"
                  id={metaPanelId}
                  role="dialog"
                  aria-label="Session details"
                >
                  <form
                    className="testing-session-meta"
                    onSubmit={onSaveMeta}
                  >
                    <label className="field">
                      <span className="label">Title</span>
                      <input
                        type="text"
                        maxLength={120}
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="label">Notes</span>
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Optional notes"
                      />
                    </label>
                    <button
                      type="submit"
                      className="chip compact"
                      disabled={savingMeta || !titleDraft.trim()}
                    >
                      {savingMeta ? 'Saving…' : 'Save details'}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
            <Link to="/testing" className="chip compact">
              All sessions
            </Link>
          </div>
        </div>
      </header>

      <main className="panel testing-session testing-dashboard">
        {error ? <p className="auth-error">{error}</p> : null}

        <section
          className="testing-stats"
          aria-label="Session summary"
        >
          <div className="testing-stat-card">
            <span className="testing-stat-label">Runs</span>
            <span className="testing-stat-value">{stats.runCount}</span>
            <span className="testing-stat-sub">in this session</span>
          </div>
          <div className="testing-stat-card">
            <span className="testing-stat-label">Best DPS</span>
            <span className="testing-stat-value">
              {formatCompact(stats.bestDps)}
            </span>
            <span className="testing-stat-sub">
              {stats.bestDpsMain ?? 'No runs yet'}
            </span>
          </div>
          <div className="testing-stat-card">
            <span className="testing-stat-label">Avg DPS</span>
            <span className="testing-stat-value">
              {formatCompact(stats.avgDps)}
            </span>
            <span className="testing-stat-sub">across runs</span>
          </div>
          <div className="testing-stat-card">
            <span className="testing-stat-label">Strongest hit</span>
            <span className="testing-stat-value">
              {formatCompact(stats.bestHit)}
            </span>
            <span className="testing-stat-sub">single blow</span>
          </div>
        </section>

        <UploadRunsPanel
          drafts={drafts}
          onDraftsChange={setDrafts}
          onSaveDraft={(id) => {
            void onSaveDraft(id)
          }}
          onDiscardDraft={onDiscardDraft}
        />

        <div className="testing-dashboard-grid">
          <div className="testing-dashboard-charts">
            <div className="testing-chart-block">
              <h2>DPS timeline</h2>
              <p className="field-note">
                Click a point or use ← → / WASD to select a run and update team
                damage.
              </p>
              <DpsTimelineChart
                runs={runs}
                selectedRunId={selectedRunId}
                onSelectRun={selectRun}
              />
            </div>
            <div className="testing-chart-block">
              <div className="testing-chart-block-head">
                <h2>Team damage</h2>
                <div className="chip-row">
                  <button
                    type="button"
                    className={
                      barMode === 'selected'
                        ? 'chip compact active'
                        : 'chip compact'
                    }
                    onClick={() => setBarMode('selected')}
                  >
                    Selected run
                  </button>
                  <button
                    type="button"
                    className={
                      barMode === 'average-by-main'
                        ? 'chip compact active'
                        : 'chip compact'
                    }
                    onClick={() => setBarMode('average-by-main')}
                  >
                    Averages
                  </button>
                </div>
              </div>
              <TeamDamageBars
                runs={runs}
                selectedRunId={selectedRunId}
                mode={barMode}
              />
            </div>
          </div>
        </div>
      </main>

      <section
        className={[
          'testing-runs testing-dashboard-runs',
          runsExpanded ? 'is-expanded' : 'is-collapsed',
        ].join(' ')}
        aria-label="Saved runs"
      >
        <div className="testing-dashboard-runs-inner">
          <div className="testing-chart-block-head testing-runs-dock-head">
            <h2>Saved runs</h2>
            <div className="testing-runs-head-actions">
              {runs.length ? (
                <span className="field-note">{runs.length} total</span>
              ) : null}
              <button
                type="button"
                className="chip compact"
                aria-expanded={runsExpanded}
                onClick={() => setRunsExpanded((open) => !open)}
              >
                {runsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
          <div className="testing-runs-dock-body">
            {runs.length === 0 ? (
              <p className="field-note">No saved runs yet.</p>
            ) : (
              <ul className="testing-run-list">
                {runs.map((run, index) => {
                  const main = getCharacter(run.mainDpsId)
                  const selected = run.id === selectedRunId
                  return (
                    <li key={run.id}>
                      <article
                        data-run-id={run.id}
                        className={
                          selected
                            ? 'testing-run-card selected'
                            : 'testing-run-card'
                        }
                      >
                        <button
                          type="button"
                          className="testing-run-select"
                          onClick={() => selectRun(run.id)}
                        >
                          {run.imageUrl ? (
                            <img
                              className="testing-run-screenshot"
                              src={run.imageUrl}
                              alt=""
                            />
                          ) : (
                            <div className="testing-run-placeholder" />
                          )}
                          <div className="testing-run-info">
                            <p className="testing-run-title">
                              {main ? (
                                <CharacterIcon
                                  character={main}
                                  className="testing-char-icon"
                                />
                              ) : null}
                              <span>
                                Run {index + 1}
                                {main ? ` · ${main.name}` : ''}
                              </span>
                            </p>
                            <p className="field-note">
                              {run.dps != null
                                ? `${Math.round(run.dps).toLocaleString()} DPS`
                                : 'No DPS'}
                              {run.elapsedSeconds != null
                                ? ` · ${run.elapsedSeconds}s`
                                : ''}
                            </p>
                            {run.capturedAt ? (
                              <p className="field-note">
                                {new Date(run.capturedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                        </button>
                        <div className="testing-run-actions">
                          {run.imageUrl ? (
                            <button
                              type="button"
                              className="chip compact"
                              onClick={() =>
                                setExpandedScreenshot({
                                  url: run.imageUrl!,
                                  label: `Run ${index + 1} screenshot`,
                                })
                              }
                            >
                              Expand
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="chip compact"
                            onClick={() => {
                              void onDeleteRun(run.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
      <div
        className={[
          'testing-runs-dock-spacer',
          runsExpanded ? 'is-expanded' : 'is-collapsed',
        ].join(' ')}
        aria-hidden="true"
      />
      {expandedScreenshot ? (
        <ScreenshotLightbox
          url={expandedScreenshot.url}
          label={expandedScreenshot.label}
          onClose={() => setExpandedScreenshot(null)}
        />
      ) : null}
    </>
  )
}

function TestingSessionWithClerk({ sessionId }: { sessionId: string }) {
  const { getToken, isLoaded } = useAuth()
  if (!isLoaded) return <p className="field-note">Loading…</p>
  return (
    <TestingSessionInner
      sessionId={sessionId}
      getToken={() => getToken()}
    />
  )
}

export default function TestingSessionPage() {
  const { sessionId } = useParams()
  if (!sessionId) {
    return <Navigate to="/testing" replace />
  }
  if (!clerkConfigured) {
    return (
      <TestingSessionInner
        sessionId={sessionId}
        getToken={async () => null}
      />
    )
  }
  return <TestingSessionWithClerk sessionId={sessionId} />
}
