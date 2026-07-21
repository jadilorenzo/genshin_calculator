import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useSignIn, useSignUp } from '@clerk/react'
import type { OAuthStrategy } from '@clerk/shared/types'
import appleLogo from '../../assets/brand/apple.svg'
import googleLogo from '../../assets/brand/google.svg'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'

type Mode = 'sign-in' | 'sign-up' | 'verify'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function AuthUnavailable() {
  useDocumentTitle(`Sign in · False Moon's Reckoning`)
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand-eyebrow">False Moon's Reckoning</p>
        <h1 className="auth-title">Sign in unavailable</h1>
        <p className="auth-lede">
          Auth is not configured for this build. Your data still saves in this
          browser via localStorage.
        </p>
        <Link to="/rotations" className="chip filled">
          Back to app
        </Link>
      </div>
    </div>
  )
}

function AuthPageInner() {
  useDocumentTitle(`Sign in · False Moon's Reckoning`)
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { signIn, fetchStatus: signInFetch } = useSignIn()
  const { signUp, fetchStatus: signUpFetch } = useSignUp()

  const [mode, setMode] = useState<Mode>(() =>
    location.pathname.includes('sign-up') ? 'sign-up' : 'sign-in',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setMode((prev) => {
      if (prev === 'verify' && location.pathname.includes('sign-up')) return prev
      return location.pathname.includes('sign-up') ? 'sign-up' : 'sign-in'
    })
  }, [location.pathname])

  const busy =
    pending || signInFetch === 'fetching' || signUpFetch === 'fetching'

  const goHome = () => {
    navigate('/rotations', { replace: true })
  }

  const onOAuth = async (strategy: OAuthStrategy) => {
    if (!signIn) return
    setPending(true)
    setError(null)
    try {
      const { error: ssoError } = await signIn.sso({
        strategy,
        redirectUrl: '/rotations',
        redirectCallbackUrl: '/sso-callback',
      })
      if (ssoError) {
        setError(ssoError.message)
        setPending(false)
      }
      // On success the browser redirects away.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Social sign-in failed')
      setPending(false)
    }
  }

  const onSubmitSignIn = async (event: FormEvent) => {
    event.preventDefault()
    if (!signIn) return
    setPending(true)
    setError(null)
    try {
      const { error: passwordError } = await signIn.password({
        emailAddress: email.trim(),
        password,
      })
      if (passwordError) {
        setError(passwordError.message)
        return
      }
      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/rotations')
            if (url.startsWith('http')) {
              window.location.href = url
            } else {
              navigate(url, { replace: true })
            }
          },
        })
        if (finalizeError) {
          setError(finalizeError.message)
          return
        }
        goHome()
        return
      }
      if (signIn.status === 'needs_second_factor') {
        setError(
          'This account requires a second factor. Use Clerk MFA settings or disable MFA for testing.',
        )
        return
      }
      setError(`Additional steps required (${signIn.status}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setPending(false)
    }
  }

  const onSubmitSignUp = async (event: FormEvent) => {
    event.preventDefault()
    if (!signUp) return
    setPending(true)
    setError(null)
    try {
      const { error: passwordError } = await signUp.password({
        emailAddress: email.trim(),
        password,
      })
      if (passwordError) {
        setError(passwordError.message)
        return
      }
      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/rotations')
            if (url.startsWith('http')) {
              window.location.href = url
            } else {
              navigate(url, { replace: true })
            }
          },
        })
        if (finalizeError) {
          setError(finalizeError.message)
          return
        }
        goHome()
        return
      }
      if (signUp.unverifiedFields.includes('email_address')) {
        const { error: sendError } = await signUp.verifications.sendEmailCode()
        if (sendError) {
          setError(sendError.message)
          return
        }
        setMode('verify')
        return
      }
      setError(`Additional steps required (${signUp.status}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setPending(false)
    }
  }

  const onSubmitVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!signUp) return
    setPending(true)
    setError(null)
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      })
      if (verifyError) {
        setError(verifyError.message)
        return
      }
      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/rotations')
            if (url.startsWith('http')) {
              window.location.href = url
            } else {
              navigate(url, { replace: true })
            }
          },
        })
        if (finalizeError) {
          setError(finalizeError.message)
          return
        }
        goHome()
        return
      }
      setError(`Could not finish sign up (${signUp.status}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setPending(false)
    }
  }

  if (authLoaded && isSignedIn) {
    return <Navigate to="/rotations" replace />
  }

  const socialButtons =
    mode === 'verify' ? null : (
      <div className="auth-social">
        <button
          type="button"
          className="auth-social-button"
          disabled={busy || !signIn}
          onClick={() => {
            void onOAuth('oauth_google')
          }}
        >
          <img src={googleLogo} alt="" className="auth-social-logo" width={18} height={18} />
          <span>Continue with Google</span>
        </button>
        <button
          type="button"
          className="auth-social-button"
          disabled={busy || !signIn}
          onClick={() => {
            void onOAuth('oauth_apple')
          }}
        >
          <img src={appleLogo} alt="" className="auth-social-logo apple" width={18} height={18} />
          <span>Continue with Apple</span>
        </button>
        <p className="auth-divider" role="separator">
          <span>or</span>
        </p>
      </div>
    )

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand-eyebrow">False Moon's Reckoning</p>
        <h1 className="auth-title">
          {mode === 'sign-in'
            ? 'Sign in'
            : mode === 'sign-up'
              ? 'Create account'
              : 'Verify email'}
        </h1>
        <p className="auth-lede">
          {mode === 'verify'
            ? 'Enter the code we sent to your email.'
            : 'Signed-in data syncs across devices. Signed out stays on this browser.'}
        </p>

        {socialButtons}

        {mode === 'sign-in' ? (
          <form className="auth-form" onSubmit={onSubmitSignIn}>
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="chip filled" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : null}

        {mode === 'sign-up' ? (
          <form className="auth-form" onSubmit={onSubmitSignUp}>
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div id="clerk-captcha" />
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="chip filled" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        ) : null}

        {mode === 'verify' ? (
          <form className="auth-form" onSubmit={onSubmitVerify}>
            <label className="field">
              <span className="label">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="chip filled" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        ) : null}

        <div className="auth-switch">
          {mode === 'sign-in' ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError(null)
                navigate('/sign-up')
              }}
            >
              Need an account? Sign up
            </button>
          ) : null}
          {mode === 'sign-up' ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError(null)
                navigate('/sign-in')
              }}
            >
              Already have an account? Sign in
            </button>
          ) : null}
          <Link to="/rotations" className="text-button">
            Continue without account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  if (!clerkConfigured) return <AuthUnavailable />
  return <AuthPageInner />
}
