import { Navigate, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { lazy, Suspense } from 'react'
import { AppLayout } from './layout/AppLayout.tsx'
import ArtifactsHubLayout from './pages/artifacts/ArtifactsHubLayout.tsx'
import ArtifactLayout from './pages/artifacts/ArtifactLayout.tsx'
import ArtifactChancesPage from './pages/artifacts/ArtifactChancesPage.tsx'
import ArtifactComparePage from './pages/artifacts/ArtifactComparePage.tsx'
import BuildsPage from './pages/BuildsPage.tsx'
import PullLayout from './pages/pulls/PullLayout.tsx'
import PullOddsPage from './pages/pulls/PullOddsPage.tsx'
import PullPacePage from './pages/pulls/PullPacePage.tsx'
import PullingDayPage from './pages/pulls/PullingDayPage.tsx'
import BannerCountdownPage from './pages/pulls/BannerCountdownPage.tsx'
import AuthPage from './pages/auth/AuthPage.tsx'
import ProfilePage from './pages/auth/ProfilePage.tsx'
import SSOCallbackPage from './pages/auth/SSOCallbackPage.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import './styles/main.scss'

const RotationsHubPage = lazy(() => import('./pages/rotations/RotationsHubPage.tsx'))
const MyRotationsPage = lazy(() => import('./pages/rotations/MyRotationsPage.tsx'))
const RotationEditorPage = lazy(() => import('./pages/RotationsPage.tsx'))
const RotationDetailPage = lazy(
  () => import('./pages/rotations/RotationDetailPage.tsx'),
)
const CharactersPage = lazy(() => import('./pages/characters/CharactersPage.tsx'))

function RotationsHubRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading rotations…</p>}>
      <RotationsHubPage />
    </Suspense>
  )
}

function MyRotationsRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading your rotations…</p>}>
      <MyRotationsPage />
    </Suspense>
  )
}

function RotationEditorRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading editor…</p>}>
      <RotationEditorPage />
    </Suspense>
  )
}

function RotationDetailRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading rotation…</p>}>
      <RotationDetailPage />
    </Suspense>
  )
}

function CharactersRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading characters…</p>}>
      <CharactersPage />
    </Suspense>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="sign-in" element={<AuthPage />} />
        <Route path="sign-up" element={<AuthPage />} />
        <Route path="sso-callback" element={<SSOCallbackPage />} />

        <Route element={<AppLayout />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route index element={<LandingPage />} />
          <Route path="rotations" element={<RotationsHubRoute />} />
          <Route path="rotations/mine" element={<MyRotationsRoute />} />
          <Route path="rotations/editor" element={<RotationEditorRoute />} />
          <Route
            path="rotations/editor/:rotationId"
            element={<RotationEditorRoute />}
          />
          <Route
            path="rotations/:rotationId"
            element={<RotationDetailRoute />}
          />
          <Route path="characters/:characterId?" element={<CharactersRoute />} />

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
      <Analytics />
    </>
  )
}
