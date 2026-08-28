import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout.tsx'
import { PageLoader } from './components/PageLoader.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import './styles/main.scss'

const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })),
)

const RotationsHubPage = lazy(() => import('./pages/rotations/RotationsHubPage.tsx'))
const MyRotationsPage = lazy(() => import('./pages/rotations/MyRotationsPage.tsx'))
const RotationEditorPage = lazy(() => import('./pages/RotationsPage.tsx'))
const RotationDetailPage = lazy(
  () => import('./pages/rotations/RotationDetailPage.tsx'),
)
const CharactersPage = lazy(() => import('./pages/characters/CharactersPage.tsx'))
const TestingHubPage = lazy(() => import('./pages/testing/TestingHubPage.tsx'))
const TestingSessionPage = lazy(
  () => import('./pages/testing/TestingSessionPage.tsx'),
)
const TestingComparePage = lazy(
  () => import('./pages/testing/TestingComparePage.tsx'),
)
const FarmingPage = lazy(() => import('./pages/farming/FarmingPage.tsx'))
const FarmingGoalPage = lazy(() => import('./pages/farming/FarmingGoalPage.tsx'))

const ArtifactsHubLayout = lazy(
  () => import('./pages/artifacts/ArtifactsHubLayout.tsx'),
)
const ArtifactLayout = lazy(() => import('./pages/artifacts/ArtifactLayout.tsx'))
const ArtifactChancesPage = lazy(
  () => import('./pages/artifacts/ArtifactChancesPage.tsx'),
)
const ArtifactComparePage = lazy(
  () => import('./pages/artifacts/ArtifactComparePage.tsx'),
)
const BuildsPage = lazy(() => import('./pages/BuildsPage.tsx'))

const PullLayout = lazy(() => import('./pages/pulls/PullLayout.tsx'))
const PullOddsPage = lazy(() => import('./pages/pulls/PullOddsPage.tsx'))
const PullPacePage = lazy(() => import('./pages/pulls/PullPacePage.tsx'))
const PullingDayPage = lazy(() => import('./pages/pulls/PullingDayPage.tsx'))
const BannerCountdownPage = lazy(
  () => import('./pages/pulls/BannerCountdownPage.tsx'),
)

const AuthPage = lazy(() => import('./pages/auth/AuthPage.tsx'))
const ProfilePage = lazy(() => import('./pages/auth/ProfilePage.tsx'))
const SSOCallbackPage = lazy(() => import('./pages/auth/SSOCallbackPage.tsx'))

function RedirectMineFarming() {
  const { characterId } = useParams()
  const [params] = useSearchParams()
  const qs = params.toString()
  const path = characterId
    ? `/farming/${encodeURIComponent(characterId)}`
    : '/farming'
  return <Navigate to={qs ? `${path}?${qs}` : path} replace />
}

function RedirectMineTesting() {
  const { sessionId } = useParams()
  const [params] = useSearchParams()
  const qs = params.toString()
  const path = sessionId ? `/testing/${sessionId}` : '/testing'
  return <Navigate to={qs ? `${path}?${qs}` : path} replace />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="sign-in"
          element={
            <Suspense fallback={<PageLoader label="Loading sign in…" />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="sign-up"
          element={
            <Suspense fallback={<PageLoader label="Loading sign up…" />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="sso-callback"
          element={
            <Suspense fallback={<PageLoader label="Signing in…" />}>
              <SSOCallbackPage />
            </Suspense>
          }
        />

        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="rotations" element={<RotationsHubPage />} />
          <Route path="rotations/mine" element={<MyRotationsPage />} />
          <Route path="rotations/editor" element={<RotationEditorPage />} />
          <Route
            path="rotations/editor/:rotationId"
            element={<RotationEditorPage />}
          />
          <Route
            path="rotations/:rotationId"
            element={<RotationDetailPage />}
          />
          <Route path="characters/:characterId?" element={<CharactersPage />} />

          <Route path="testing" element={<TestingHubPage />} />
          <Route path="testing/compare" element={<TestingComparePage />} />
          <Route path="testing/:sessionId" element={<TestingSessionPage />} />

          <Route path="farming" element={<FarmingPage />} />
          <Route path="farming/:characterId" element={<FarmingGoalPage />} />

          <Route path="mine" element={<Navigate to="/rotations/mine" replace />} />
          <Route
            path="mine/rotations"
            element={<Navigate to="/rotations/mine" replace />}
          />
          <Route path="mine/farming" element={<RedirectMineFarming />} />
          <Route
            path="mine/farming/:characterId"
            element={<RedirectMineFarming />}
          />
          <Route path="mine/testing" element={<RedirectMineTesting />} />
          <Route
            path="mine/testing/:sessionId"
            element={<RedirectMineTesting />}
          />

          <Route path="artifacts" element={<ArtifactsHubLayout />}>
            <Route index element={<Navigate to="lineup" replace />} />
            <Route path="lineup" element={<BuildsPage />} />
            <Route path="single" element={<ArtifactLayout />}>
              <Route index element={<Navigate to="expectations" replace />} />
              <Route path="compare" element={<ArtifactComparePage />} />
              <Route path="expectations" element={<ArtifactChancesPage />} />
            </Route>
            <Route path="compare" element={<Navigate to="/artifacts/single/compare" replace />} />
            <Route
              path="expectations"
              element={<Navigate to="/artifacts/single/expectations" replace />}
            />
            <Route
              path="chances"
              element={<Navigate to="/artifacts/single/expectations" replace />}
            />
            <Route path="farm" element={<Navigate to="/artifacts/single/expectations" replace />} />
          </Route>
          <Route path="builds" element={<Navigate to="/artifacts/lineup" replace />} />

          <Route path="banners" element={<PullLayout />}>
            <Route index element={<Navigate to="odds" replace />} />
            <Route path="odds" element={<PullOddsPage />} />
            <Route path="pace" element={<PullPacePage />} />
            <Route path="day" element={<PullingDayPage />} />
            <Route path="countdown" element={<BannerCountdownPage />} />
          </Route>
          <Route path="pulls">
            <Route index element={<Navigate to="/banners/odds" replace />} />
            <Route path="odds" element={<Navigate to="/banners/odds" replace />} />
            <Route path="pace" element={<Navigate to="/banners/pace" replace />} />
            <Route path="day" element={<Navigate to="/banners/day" replace />} />
            <Route path="countdown" element={<Navigate to="/banners/countdown" replace />} />
            <Route path="*" element={<Navigate to="/banners/odds" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
    </>
  )
}
