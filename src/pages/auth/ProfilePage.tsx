import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function ProfileUnavailable() {
  useDocumentTitle(`Profile · False Moon's Reckoning`)
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand-eyebrow">False Moon's Reckoning</p>
        <h1 className="auth-title">Profile unavailable</h1>
        <p className="auth-lede">
          Auth is not configured for this build, so there is no account profile to edit.
        </p>
        <Link to="/rotations" className="chip filled">
          Back to app
        </Link>
      </div>
    </div>
  )
}

function ProfilePageInner() {
  useDocumentTitle(`Profile · False Moon's Reckoning`)
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { isLoaded: userLoaded, user } = useUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
  }, [user])

  if (authLoaded && !isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  const busy = pending || !userLoaded || !user

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    setPending(true)
    setError(null)
    setSaved(false)
    try {
      await user.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setPending(false)
    }
  }

  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand-eyebrow">False Moon's Reckoning</p>
        <h1 className="auth-title">Profile</h1>
        <p className="auth-lede">
          Your name shows on published rotations and discussion comments.
        </p>

        {email ? (
          <p className="auth-profile-email">
            <span className="label">Email</span>
            <span>{email}</span>
          </p>
        ) : null}

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="label">First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              disabled={busy}
              onChange={(e) => {
                setFirstName(e.target.value)
                setSaved(false)
              }}
            />
          </label>
          <label className="field">
            <span className="label">Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              disabled={busy}
              onChange={(e) => {
                setLastName(e.target.value)
                setSaved(false)
              }}
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          {saved ? <p className="auth-success">Saved.</p> : null}
          <button type="submit" className="chip filled" disabled={busy}>
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <div className="auth-switch">
          <Link to="/rotations" className="text-button">
            Back to app
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  if (!clerkConfigured) return <ProfileUnavailable />
  return <ProfilePageInner />
}
