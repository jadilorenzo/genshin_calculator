import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { CharacterIcon } from './CharacterIcon'
import { getCharacter } from './characters'
import {
  listCommunityRotations,
  toggleCommunityRotationLike,
  type CommunityRotation,
} from './communityApi'
import type { RotationDoc } from './rotationDoc'
import { RotationTimeline } from './RotationTimeline'

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

function rotationPreviewDoc(item: CommunityRotation): {
  placements: RotationDoc['placements']
  switchBuffer: number
  timingMode: RotationDoc['timingMode']
  humanLag: number
} {
  const doc = (item.doc ?? {}) as Partial<RotationDoc>
  return {
    placements: Array.isArray(doc.placements) ? doc.placements : [],
    switchBuffer: doc.switchBuffer ?? 0.33,
    timingMode: doc.timingMode ?? 'frame',
    humanLag: doc.humanLag ?? 0.15,
  }
}

function RotationsHubInner({
  getToken,
  isSignedIn,
}: {
  getToken: () => Promise<string | null>
  isSignedIn: boolean
}) {
  useDocumentTitle(PAGE_TITLES.rotations)
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = searchParams.get('sort') === 'new' ? 'new' : 'popular'
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)

  const [items, setItems] = useState<CommunityRotation[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listCommunityRotations({
        page,
        sort,
        getToken,
      })
      setItems(Array.isArray(result.items) ? result.items : [])
      setTotalPages(result.totalPages ?? 1)
      setTotal(result.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [getToken, page, sort])

  useEffect(() => {
    void load()
  }, [load])

  const setSort = (next: 'popular' | 'new') => {
    const params = new URLSearchParams(searchParams)
    params.set('sort', next)
    params.delete('page')
    setSearchParams(params)
  }

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams)
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  const onLike = async (id: string) => {
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }
    try {
      const result = await toggleCommunityRotationLike(id, getToken)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                likedByMe: result.liked,
                likesCount: result.likesCount,
              }
            : item,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not like')
    }
  }

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Rotations</h1>
          <div className="hero-actions">
            <Link to="/rotations/editor" className="chip filled">
              New rotation
            </Link>
          </div>
        </div>
        <p className="lede">
          Browse popular team timelines from the community — open one to discuss,
          or build your own in the editor.
        </p>
      </header>

      <div className="rotations-hub-toolbar">
        <div className="chip-row" role="group" aria-label="Sort rotations">
          <button
            type="button"
            className={sort === 'popular' ? 'chip compact active' : 'chip compact'}
            onClick={() => setSort('popular')}
          >
            Popular
          </button>
          <button
            type="button"
            className={sort === 'new' ? 'chip compact active' : 'chip compact'}
            onClick={() => setSort('new')}
          >
            Newest
          </button>
        </div>
        <p className="field-note">{total} published</p>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {loading ? (
        <p className="field-note">Loading rotations…</p>
      ) : !items?.length ? (
        <div className="rotations-hub-empty">
          <p>No published rotations yet.</p>
          <Link to="/rotations/editor" className="chip filled">
            Be the first — open the editor
          </Link>
        </div>
      ) : (
        <ul className="rotations-hub-list">
          {items.map((item) => {
            const preview = rotationPreviewDoc(item)
            return (
            <li key={item.id}>
              <article className="rotation-card">
                <Link to={`/rotations/${item.id}`} className="rotation-card-main">
                  <h2 className="rotation-card-title">{item.title}</h2>
                  {item.description ? (
                    <p className="rotation-card-desc">{item.description}</p>
                  ) : null}
                  <ul className="rotation-card-roster" aria-label="Team">
                    {(item.characterIds ?? []).slice(0, 6).map((cid) => {
                      const character = getCharacter(cid)
                      if (!character) return null
                      return (
                        <li key={cid}>
                          <CharacterIcon
                            character={character}
                            className="rotation-card-icon"
                          />
                          <span className="visually-hidden">{character.name}</span>
                        </li>
                      )
                    })}
                  </ul>
                  {preview.placements.length > 0 ? (
                    <div
                      className="rotation-card-preview"
                      aria-hidden
                      onClick={(e) => e.preventDefault()}
                    >
                      <RotationTimeline
                        placements={preview.placements}
                        onChange={() => {}}
                        selectedId={null}
                        switchBuffer={preview.switchBuffer}
                        timingMode={preview.timingMode}
                        humanLag={preview.humanLag}
                        onSelectPlacement={() => {}}
                        readOnly
                        hideDurationOverlays
                        fixedZoomScale={0.75}
                        hideToolbar
                      />
                    </div>
                  ) : null}
                  <p className="rotation-card-meta">
                    {item.authorName} · {formatDate(item.createdAt)}
                  </p>
                </Link>
                <div className="rotation-card-actions">
                  <button
                    type="button"
                    className={
                      item.likedByMe ? 'chip compact active' : 'chip compact'
                    }
                    onClick={() => {
                      void onLike(item.id)
                    }}
                  >
                    ♥ {item.likesCount}
                  </button>
                  <Link
                    to={`/rotations/${item.id}#discussion`}
                    className="chip compact"
                  >
                    Discussion {item.commentsCount}
                  </Link>
                </div>
              </article>
            </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="rotations-hub-pager">
          <button
            type="button"
            className="chip compact"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
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
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  )
}

function RotationsHubWithClerk() {
  const { getToken, isSignedIn } = useAuth()
  return (
    <RotationsHubInner
      getToken={() => getToken()}
      isSignedIn={Boolean(isSignedIn)}
    />
  )
}

export default function RotationsHubPage() {
  if (!clerkConfigured) {
    return (
      <RotationsHubInner getToken={async () => null} isSignedIn={false} />
    )
  }
  return <RotationsHubWithClerk />
}
