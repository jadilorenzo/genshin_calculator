import type { DeskId } from './siteNav.ts'

/** Warm the lazy chunk for a desk when the user hovers a sidebar link. */
const DESK_PREFETCH: Partial<Record<DeskId, () => Promise<unknown>>> = {
  rotations: () => import('../pages/rotations/RotationsHubPage.tsx'),
  farm: () => import('../pages/BuildsPage.tsx'),
  goals: () => import('../pages/farming/FarmingPage.tsx'),
  wish: () => import('../pages/pulls/PullOddsPage.tsx'),
  testing: () => import('../pages/testing/TestingHubPage.tsx'),
  data: () => import('../pages/characters/CharactersPage.tsx'),
}

export function prefetchDesk(desk: DeskId) {
  DESK_PREFETCH[desk]?.()
}
