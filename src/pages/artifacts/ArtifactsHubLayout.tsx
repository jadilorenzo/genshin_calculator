import { Outlet, useLocation } from 'react-router-dom'

export default function ArtifactsHubLayout() {
  const location = useLocation()
  const isSingle = location.pathname.includes('/single')

  return (
    <>
      {isSingle ? null : (
        <p className="lede section-lede">
          Plan a five-piece set. Parallel farming fills any empty slot, so the
          full lineup often finishes sooner than each piece alone.
        </p>
      )}
      <Outlet />
    </>
  )
}
