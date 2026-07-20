import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import './App.css'

const RotationsPage = lazy(() => import('./pages/RotationsPage.tsx'))

function RotationsRoute() {
  return (
    <Suspense fallback={<p className="field-note">Loading rotations…</p>}>
      <RotationsPage />
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/artifacts/compare" replace />} />
          <Route path="builds" element={<BuildsPage />} />
          <Route path="artifacts" element={<ArtifactLayout />}>
            <Route index element={<Navigate to="compare" replace />} />
            <Route path="compare" element={<ArtifactComparePage />} />
            <Route path="expectations" element={<ArtifactChancesPage />} />
            <Route path="chances" element={<Navigate to="/artifacts/expectations" replace />} />
            <Route path="farm" element={<Navigate to="/artifacts/expectations" replace />} />
          </Route>
          <Route path="rotations" element={<RotationsRoute />} />
          <Route path="pulls" element={<PullLayout />}>
            <Route index element={<Navigate to="odds" replace />} />
            <Route path="odds" element={<PullOddsPage />} />
            <Route path="pace" element={<PullPacePage />} />
            <Route path="day" element={<PullingDayPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/artifacts/compare" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
