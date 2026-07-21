import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { getCharacter } from './characters'
import {
  getCommunityRotation,
  listCommunityComments,
  postCommunityComment,
  toggleCommunityRotationLike,
  updateCommunityRotation,
  type CommunityComment,
  type CommunityRotation,
} from './communityApi'
import type { RotationDoc } from './rotationDoc'
import { RotationTimeline } from './RotationTimeline'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function DetailInner({
  getToken,
  isSignedIn,
  authorName,
  userId,
}: {
  getToken: () => Promise<string | null>
  isSignedIn: boolean
  authorName: string
  userId: string | null | undefined
}) {
  const { rotationId = '' } = useParams()
  const [item, setItem] = useState<CommunityRotation | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  useDocumentTitle(
    item ? `${item.title} · Rotations · False Moon's Reckoning` : `Rotation · False Moon's Reckoning`,
  )

  const load = useCallback(async () => {
    if (!rotationId) return
    setLoading(true)
    setError(null)
    try {
      const [rotation, thread] = await Promise.all([
        getCommunityRotation(rotationId, getToken),
        listCommunityComments(rotationId),
      ])
      setItem(rotation)
      setComments(thread)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [getToken, rotationId])

  useEffect(() => {
    void load()
  }, [load])

  const onLike = async () => {
    if (!item) return
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }
    try {
      const result = await toggleCommunityRotationLike(item.id, getToken)
      setItem({
        ...item,
        likedByMe: result.liked,
        likesCount: result.likesCount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not like')
    }
  }

  const startEditMeta = () => {
    if (!item) return
    setEditTitle(item.title)
    setEditDescription(item.description || '')
    setEditingMeta(true)
    setError(null)
  }

  const onSaveMeta = async (event: FormEvent) => {
    event.preventDefault()
    if (!item) return
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }
    const trimmed = editTitle.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setSavingMeta(true)
    setError(null)
    try {
      const updated = await updateCommunityRotation(
        item.id,
        {
          title: trimmed,
          description: editDescription,
          authorName,
        },
        getToken,
      )
      setItem(updated)
      setEditingMeta(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update details')
    } finally {
      setSavingMeta(false)
    }
  }

  const onComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!item) return
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }
    setPosting(true)
    setError(null)
    try {
      const result = await postCommunityComment(
        item.id,
        commentText,
        getToken,
        authorName,
      )
      setComments((prev) => [...prev, result.item])
      setItem({ ...item, commentsCount: result.commentsCount })
      setCommentText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post')
    } finally {
      setPosting(false)
    }
  }

  if (loading) return <p className="field-note">Loading rotation…</p>
  if (!item) {
    return (
      <div className="rotations-hub-empty">
        <p>{error || 'Rotation not found.'}</p>
        <Link to="/rotations" className="chip">
          Back to rotations
        </Link>
      </div>
    )
  }

  const doc = item.doc as RotationDoc
  const placements = Array.isArray(doc?.placements) ? doc.placements : []
  const isOwn = Boolean(userId && item.authorId === userId)

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          {editingMeta ? (
            <h1 className="visually-hidden">Edit rotation details</h1>
          ) : (
            <h1>{item.title}</h1>
          )}
          <div className="hero-actions">
            <Link to="/rotations" className="chip compact">
              All rotations
            </Link>
            {isOwn && !editingMeta ? (
              <button
                type="button"
                className="chip compact"
                onClick={startEditMeta}
              >
                Edit details
              </button>
            ) : null}
            <Link
              to={`/rotations/editor/${item.id}`}
              className="chip filled"
            >
              {isOwn ? 'Edit in editor' : 'Remix in editor'}
            </Link>
          </div>
        </div>
        {editingMeta ? (
          <form className="rotation-meta-fields" onSubmit={onSaveMeta}>
            <label className="field">
              <span className="label">Name</span>
              <input
                type="text"
                required
                maxLength={120}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Rotation name"
              />
            </label>
            <label className="field">
              <span className="label">Description</span>
              <textarea
                rows={2}
                maxLength={500}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional notes for the community"
              />
            </label>
            <div className="chip-row">
              <button
                type="button"
                className="chip compact"
                disabled={savingMeta}
                onClick={() => setEditingMeta(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="chip filled"
                disabled={savingMeta || !editTitle.trim()}
              >
                {savingMeta ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {item.description ? <p className="lede">{item.description}</p> : null}
          </>
        )}
        <p className="field-note">
          by {item.authorName}
          {item.characterIds.length
            ? ` · ${item.characterIds
                .map((id) => getCharacter(id)?.name)
                .filter(Boolean)
                .join(', ')}`
            : ''}
        </p>
        <div className="rotation-detail-actions">
          <button
            type="button"
            className={item.likedByMe ? 'chip compact active' : 'chip compact'}
            onClick={() => {
              void onLike()
            }}
          >
            ♥ {item.likesCount}
          </button>
          <span className="field-note">{item.commentsCount} comments</span>
        </div>
      </header>

      {error ? <p className="auth-error">{error}</p> : null}

      <div className="rotation-workspace rotation-preview">
        <RotationTimeline
          placements={placements}
          onChange={() => {}}
          selectedId={null}
          switchBuffer={doc.switchBuffer ?? 0.33}
          timingMode={doc.timingMode ?? 'frame'}
          humanLag={doc.humanLag ?? 0.15}
          onSelectPlacement={() => {}}
          readOnly
          hideDurationOverlays
          fixedZoomScale={0.75}
        />
      </div>

      <section className="rotation-discussion" id="discussion">
        <h2>Discussion</h2>
        {comments.length === 0 ? (
          <p className="field-note">No comments yet.</p>
        ) : (
          <ul className="rotation-comment-list">
            {comments.map((c) => (
              <li key={c.id} className="rotation-comment">
                <p className="rotation-comment-meta">{c.authorName}</p>
                <p className="rotation-comment-body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form className="rotation-comment-form" onSubmit={onComment}>
          <label className="field">
            <span className="label">Add a comment</span>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                isSignedIn ? 'Share a note…' : 'Sign in to join the discussion'
              }
              disabled={!isSignedIn || posting}
              required
            />
          </label>
          {isSignedIn ? (
            <button type="submit" className="chip filled" disabled={posting}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          ) : (
            <Link to="/sign-in" className="chip filled">
              Sign in to comment
            </Link>
          )}
        </form>
      </section>
    </>
  )
}

function DetailWithClerk() {
  const { getToken, isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const authorName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'Traveler'
  return (
    <DetailInner
      getToken={() => getToken()}
      isSignedIn={Boolean(isSignedIn)}
      authorName={authorName}
      userId={userId}
    />
  )
}

export default function RotationDetailPage() {
  if (!clerkConfigured) {
    return (
      <DetailInner
        getToken={async () => null}
        isSignedIn={false}
        authorName="Traveler"
        userId={null}
      />
    )
  }
  return <DetailWithClerk />
}
