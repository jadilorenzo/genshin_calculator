import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout.tsx'
import ArtifactPage from './pages/ArtifactPage.tsx'
import PullPage from './pages/PullPage.tsx'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/artifacts" replace />} />
          <Route path="artifacts" element={<ArtifactPage />} />
          <Route path="pulls" element={<PullPage />} />
          <Route path="*" element={<Navigate to="/artifacts" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
