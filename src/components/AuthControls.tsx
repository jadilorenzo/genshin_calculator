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

  const syncLabel =
    userData?.syncStatus === 'saving'
      ? 'Saving…'
      : userData?.syncStatus === 'loading'
        ? 'Syncing…'
        : userData?.syncStatus === 'error'
          ? 'Sync error'
          : 'Synced'

  return (
    <div className="auth-controls">
      <span
        className="auth-controls-status"
        title={userData?.syncError ?? undefined}
      >
        {syncLabel}
      </span>
      <span
        className="auth-controls-email"
        title={user?.primaryEmailAddress?.emailAddress}
      >
        {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
      </span>
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
