import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  createTestingSession,
  deleteTestingSession,
  listTestingSessions,
} from './testingApi'
import type { TestingSession } from './types'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function TestingHubInner({
  getToken,
  isSignedIn,
}: {
  getToken: () => Promise<string | null>
  isSignedIn: boolean
}) {
  useDocumentTitle(PAGE_TITLES.personalTesting)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)

  const [items, setItems] = useState<TestingSession[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listTestingSessions({ page, getToken })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [getToken, isSignedIn, page])

  useEffect(() => {
    void load()
  }, [load])

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setError(null)
    try {
      const item = await createTestingSession({ title: trimmed }, getToken)
      setTitle('')
      navigate(`/mine/testing/${item.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create session')
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this testing session and all its runs?')) return
    try {
      await deleteTestingSession(id, getToken)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  return (
    <>
      <div className="mine-section-head">
        <div className="mine-section-copy">
          <h2>Personal Testing</h2>
          <p className="field-note">
            Upload combat-result screenshots, correct the OCR, and compare DPS
            across main DPS options.
          </p>
        </div>
      </div>

      <main className="panel testing-hub">
        <form className="testing-create" onSubmit={onCreate}>
          <label className="field">
            <span className="label">New session</span>
            <input
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flins vs Columbina abyss 12"
            />
          </label>
          <button
            type="submit"
            className="chip filled"
            disabled={creating || !title.trim()}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        {error ? <p className="auth-error">{error}</p> : null}
        {loading ? <p className="field-note">Loading sessions…</p> : null}

        {!loading && items.length === 0 ? (
          <div className="rotations-hub-empty">
            <p>No testing sessions yet. Create one to upload screenshots.</p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="testing-session-list">
            {items.map((item) => (
              <li key={item.id}>
                <article className="testing-session-card">
                  <Link to={`/mine/testing/${item.id}`} className="testing-session-main">
                    <h2>{item.title}</h2>
                    <p className="field-note">
                      {item.runsCount ?? 0} runs · {formatDate(item.updatedAt || item.createdAt)}
                    </p>
                  </Link>
                  <div className="chip-row">
                    <Link to={`/mine/testing/${item.id}`} className="chip compact">
                      Open
                    </Link>
                    <button
                      type="button"
                      className="chip compact"
                      onClick={() => {
                        void onDelete(item.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}

        {totalPages > 1 ? (
          <div className="rotations-hub-pager">
            <button
              type="button"
              className="chip compact"
              disabled={page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                if (page - 1 <= 1) params.delete('page')
                else params.set('page', String(page - 1))
                setSearchParams(params)
              }}
            >
              Previous
            </button>
            <span className="field-note">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="chip compact"
              disabled={page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.set('page', String(page + 1))
                setSearchParams(params)
              }}
            >
              Next
            </button>
          </div>
        ) : null}
      </main>
    </>
  )
}

function TestingHubWithClerk() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return <p className="field-note">Loading…</p>
  return (
    <TestingHubInner
      getToken={() => getToken()}
      isSignedIn={Boolean(isSignedIn)}
    />
  )
}

export default function TestingHubPage() {
  if (!clerkConfigured) {
    return (
      <main className="panel">
        <p className="auth-error">Sign-in is not configured for this build.</p>
      </main>
    )
  }
  return <TestingHubWithClerk />
}
