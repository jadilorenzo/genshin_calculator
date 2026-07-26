import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { ConstructionIcon } from '../../components/icons'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function MyStuffLayoutInner() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return <p className="field-note">Loading…</p>
  }
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return (
    <>
      <header className="hero mine-hero">
        <nav className="sub-tabs" aria-label="My Stuff">
          <NavLink
            to="rotations"
            className={({ isActive }) =>
              isActive ? 'sub-tab active' : 'sub-tab'
            }
          >
            My rotations
          </NavLink>
          <NavLink
            to="farming"
            className={({ isActive }) =>
              isActive ? 'sub-tab active' : 'sub-tab'
            }
          >
            Build goals
          </NavLink>
          <NavLink
            to="testing"
            className={({ isActive }) =>
              isActive
                ? 'sub-tab active sub-tab-with-icon'
                : 'sub-tab sub-tab-with-icon'
            }
          >
            Personal Testing
            <span className="sub-tab-wip-wrap">
              <ConstructionIcon className="sub-tab-wip" />
              <span className="sub-tab-wip-tip" role="tooltip">
                Work in progress
              </span>
            </span>
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </>
  )
}

/** Signed-in hub for rotations, farming, and Personal Testing. */
export default function MyStuffLayout() {
  if (!clerkConfigured) {
    return (
      <main className="panel">
        <p className="auth-error">Sign-in is not configured for this build.</p>
      </main>
    )
  }
  return <MyStuffLayoutInner />
}
