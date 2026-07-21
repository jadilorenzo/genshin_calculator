import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { lazy, Suspense } from 'react'
import { AppLayout } from './layout/AppLayout.tsx'
import ArtifactLayout from './pages/artifacts/ArtifactLayout.tsx'
import ArtifactChancesPage from './pages/artifacts/ArtifactChancesPage.tsx'
import ArtifactComparePage from './pages/artifacts/ArtifactComparePage.tsx'
import BuildsPage from './pages/BuildsPage.tsx'
import PullLayout from './pages/pulls/PullLayout.tsx'
import PullOddsPage from './pages/pulls/PullOddsPage.tsx'
import PullPacePage from './pages/pulls/PullPacePage.tsx'
import PullingDayPage from './pages/pulls/PullingDayPage.tsx'
import BannerCountdownPage from './pages/pulls/BannerCountdownPage.tsx'
import './App.css'

const RotationsPage = lazy(() => import('./pages/RotationsPage.tsx'))
const CharactersPage = lazy(() => import('./pages/characters/CharactersPage.tsx'))

function RotationsRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading rotations…</p>}>
      <RotationsPage />
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
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/rotations" replace />} />
          <Route path="rotations" element={<RotationsRoute />} />
          <Route path="characters/:characterId?" element={<CharactersRoute />} />
          <Route path="builds" element={<BuildsPage />} />
          <Route path="artifacts" element={<ArtifactLayout />}>
            <Route index element={<Navigate to="compare" replace />} />
            <Route path="compare" element={<ArtifactComparePage />} />
            <Route path="expectations" element={<ArtifactChancesPage />} />
            <Route path="chances" element={<Navigate to="/artifacts/expectations" replace />} />
            <Route path="farm" element={<Navigate to="/artifacts/expectations" replace />} />
          </Route>
          <Route path="pulls" element={<PullLayout />}>
            <Route index element={<Navigate to="day" replace />} />
            <Route path="odds" element={<PullOddsPage />} />
            <Route path="pace" element={<PullPacePage />} />
            <Route path="day" element={<PullingDayPage />} />
            <Route path="countdown" element={<BannerCountdownPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/rotations" replace />} />
        </Route>
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}
