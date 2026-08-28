import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { DpsTimelineChart } from './DpsTimelineChart'
import { SessionDamageChart } from './SessionDamageChart'
import { listAllTestingRuns } from './testingApi'
import type { TestingRunEntry } from './testingApi'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function TestingCompareInner({
  getToken,
}: {
  getToken: () => Promise<string | null>
}) {
  useDocumentTitle(PAGE_TITLES.personalTestingCompare)
  const [runs, setRuns] = useState<TestingRunEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await listAllTestingRuns(getToken)
      setRuns(items)
      setSelectedRunId((prev) => prev || items[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void load()
  }, [load])

  const sessionCount = useMemo(() => {
    return new Set(runs.map((run) => run.sessionId)).size
  }, [runs])

  const runMeta = useMemo(() => {
    const map = new Map<string, string>()
    for (const run of runs) {
      map.set(run.id, run.sessionTitle)
    }
    return map
  }, [runs])

  if (loading) {
    return <p className="field-note">Loading comparison…</p>
  }

  return (
    <main className="panel testing-hub testing-compare">
      <div className="mine-section-head">
        <div className="mine-section-copy">
          <h2>Compare DPS over time</h2>
          <p className="field-note">
            Sessions, team damage split, and DPS trends across {sessionCount}{' '}
            {sessionCount === 1 ? 'session' : 'sessions'}.
          </p>
        </div>
        <Link to="/testing" className="chip compact">
          Sessions
        </Link>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {runs.length === 0 ? (
        <p className="field-note">
          No saved runs yet.{' '}
          <Link to="/testing">Create a session</Link> and upload combat
          screenshots to compare DPS here.
        </p>
      ) : (
        <>
          <section className="testing-chart-block testing-compare-sessions">
            <h2>Sessions by damage</h2>
            <SessionDamageChart runs={runs} />
          </section>

          <section className="testing-chart-block testing-compare-chart">
            <h2>DPS over time</h2>
            <p className="field-note">
              All runs ordered oldest first. Each main DPS gets its own line.
            </p>
            <DpsTimelineChart
              runs={runs}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
              runMeta={runMeta}
            />
          </section>
        </>
      )}
    </main>
  )
}

function TestingCompareWithClerk() {
  const { getToken, isLoaded } = useAuth()
  if (!isLoaded) return <p className="field-note">Loading…</p>
  return <TestingCompareInner getToken={() => getToken()} />
}

export default function TestingComparePage() {
  if (!clerkConfigured) {
    return <TestingCompareInner getToken={async () => null} />
  }
  return <TestingCompareWithClerk />
}
