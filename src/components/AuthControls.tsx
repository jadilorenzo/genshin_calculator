import { Link } from 'react-router-dom'
import { useAuth, useClerk, useUser } from '@clerk/react'
import { useOptionalUserData } from '../sync/UserDataProvider.tsx'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

const AuthControlsInner = () => {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const userData = useOptionalUserData()

  if (!isLoaded) {
    return <p className="auth-controls-status">…</p>
  }

  if (!isSignedIn) {
    return (
      <div className="auth-controls">
        <Link to="/sign-in" className="auth-action">
          Sign in
        </Link>
        <Link to="/sign-up" className="auth-action auth-action-primary">
          Sign up
        </Link>
      </div>
    )
  }

  const syncBusy =
    userData?.syncStatus === 'saving' || userData?.syncStatus === 'loading'
  const syncFailed = userData?.syncStatus === 'error'
  const profileLabel =
    user?.firstName?.trim() ||
    user?.fullName?.trim() ||
    'Profile'

  return (
    <div className="auth-controls">
      {syncBusy || syncFailed ? (
        <span
          className={
            syncFailed
              ? 'auth-controls-status is-error'
              : 'auth-controls-status'
          }
          title={userData?.syncError ?? undefined}
        >
          {syncFailed ? 'Sync error' : syncBusy ? 'Syncing…' : null}
        </span>
      ) : null}
      <Link
        to="/profile"
        className="auth-action"
        title={user?.primaryEmailAddress?.emailAddress ?? 'Edit profile'}
      >
        {profileLabel}
      </Link>
      <button
        type="button"
        className="auth-action"
        onClick={() => {
          void signOut({ redirectUrl: '/rotations' })
        }}
      >
        Sign out
      </button>
    </div>
  )
}

export const AuthControls = () => {
  if (!clerkConfigured) return null
  return <AuthControlsInner />
}
