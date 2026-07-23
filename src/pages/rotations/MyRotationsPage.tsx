import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
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
  showAuraMarkers: boolean
} {
  const doc = (item.doc ?? {}) as Partial<RotationDoc>
  return {
    placements: Array.isArray(doc.placements) ? doc.placements : [],
    switchBuffer: doc.switchBuffer ?? 0.33,
    timingMode: doc.timingMode ?? 'frame',
    humanLag: doc.humanLag ?? 0.15,
    showAuraMarkers: doc.showAuraMarkers !== false,
  }
}

function MyRotationsInner({
  getToken,
  isSignedIn,
}: {
  getToken: () => Promise<string | null>
  isSignedIn: boolean
}) {
  useDocumentTitle(PAGE_TITLES.myRotations)
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'new'
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)

  const [items, setItems] = useState<CommunityRotation[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listCommunityRotations({
        page,
        sort,
        mine: true,
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
  }, [getToken, isSignedIn, page, sort])

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

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>My rotations</h1>
          <div className="hero-actions">
            <Link to="/rotations" className="chip compact">
              Community
            </Link>
            <Link to="/rotations/editor?new=1" className="chip filled">
              New rotation
            </Link>
          </div>
        </div>
        <p className="lede">
          Your saved timelines — public ones appear on the community list;
          private ones stay here.
        </p>
      </header>

      <div className="rotations-hub-toolbar">
        <div className="chip-row" role="group" aria-label="Sort rotations">
          <button
            type="button"
            className={sort === 'new' ? 'chip compact active' : 'chip compact'}
            onClick={() => setSort('new')}
          >
            Newest
          </button>
          <button
            type="button"
            className={
              sort === 'popular' ? 'chip compact active' : 'chip compact'
            }
            onClick={() => setSort('popular')}
          >
            Popular
          </button>
        </div>
        <p className="field-note">{total} saved</p>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {loading ? (
        <p className="field-note">Loading your rotations…</p>
      ) : !items?.length ? (
        <div className="rotations-hub-empty">
          <p>You have not saved any rotations yet.</p>
          <Link to="/rotations/editor?new=1" className="chip filled">
            Open the editor
          </Link>
        </div>
      ) : (
        <ul className="rotations-hub-list">
          {items.map((item) => {
            const preview = rotationPreviewDoc(item)
            return (
              <li key={item.id}>
                <article className="rotation-card">
                  <Link
                    to={`/rotations/editor/${item.id}`}
                    className="rotation-card-main"
                  >
                    <div className="rotation-card-topline">
                      <h2 className="rotation-card-title">{item.title}</h2>
                      <span
                        className={
                          item.isPublic
                            ? 'rotation-card-visibility public'
                            : 'rotation-card-visibility private'
                        }
                      >
                        {item.isPublic ? 'Public' : 'Private'}
                      </span>
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
                              <span className="visually-hidden">
                                {character.name}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    {item.description ? (
                      <p className="rotation-card-desc">{item.description}</p>
                    ) : null}
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
                          showAuraMarkers={preview.showAuraMarkers}
                          onSelectPlacement={() => {}}
                          readOnly
                          compactLayout
                          fixedZoomScale={0.75}
                          lockZoom
                          hideToolbar
                        />
                      </div>
                    ) : null}
                    <p className="rotation-card-meta">
                      {formatDate(item.createdAt)}
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
                    {item.isPublic ? (
                      <Link
                        to={`/rotations/${item.id}#discussion`}
                        className="chip compact"
                      >
                        Discussion {item.commentsCount}
                      </Link>
                    ) : null}
                    <Link
                      to={`/rotations/editor/${item.id}`}
                      className="chip compact"
                    >
                      Edit
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

function MyRotationsWithClerk() {
  const { getToken, isSignedIn } = useAuth()
  return (
    <MyRotationsInner
      getToken={() => getToken()}
      isSignedIn={Boolean(isSignedIn)}
    />
  )
}

export default function MyRotationsPage() {
  if (!clerkConfigured) {
    return (
      <>
        <header className="hero">
          <h1>My rotations</h1>
          <p className="lede">
            Auth is not configured, so saved rotations are unavailable.
          </p>
        </header>
        <Link to="/rotations" className="chip">
          Community rotations
        </Link>
      </>
    )
  }
  return <MyRotationsWithClerk />
}
