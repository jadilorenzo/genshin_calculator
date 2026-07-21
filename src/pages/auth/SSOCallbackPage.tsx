import { HandleSSOCallback } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'

export default function SSOCallbackPage() {
  useDocumentTitle(`Signing in · False Moon's Reckoning`)
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand-eyebrow">False Moon's Reckoning</p>
        <h1 className="auth-title">Signing in…</h1>
        <p className="auth-lede">Finishing authentication with your provider.</p>
        <HandleSSOCallback
          navigateToApp={({ session, decorateUrl }) => {
            if (session?.currentTask) {
              const destination = decorateUrl(`/rotations`)
              if (destination.startsWith('http')) {
                window.location.href = destination
                return
              }
              navigate(destination, { replace: true })
              return
            }
            const destination = decorateUrl('/rotations')
            if (destination.startsWith('http')) {
              window.location.href = destination
              return
            }
            navigate(destination, { replace: true })
          }}
          navigateToSignIn={() => {
            navigate('/sign-in', { replace: true })
          }}
          navigateToSignUp={() => {
            navigate('/sign-up', { replace: true })
          }}
        />
      </div>
    </div>
  )
}
