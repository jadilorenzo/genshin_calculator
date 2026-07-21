import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  BANNER_REGION_OPTIONS,
  inferBannerRegion,
  type BannerRegion,
} from '../model/bannerSchedule.ts'
import { useLocalStorage } from './useLocalStorage.ts'

function isBannerRegion(value: unknown): value is BannerRegion {
  return BANNER_REGION_OPTIONS.some((option) => option.id === value)
}

type BannerRegionContextValue = {
  region: BannerRegion
  setRegion: Dispatch<SetStateAction<BannerRegion>>
}

const BannerRegionContext = createContext<BannerRegionContextValue | null>(null)

export function BannerRegionProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<BannerRegion>(
    'gc:bannerRegion',
    inferBannerRegion(),
  )
  const region = isBannerRegion(stored) ? stored : inferBannerRegion()

  const value = useMemo(
    () => ({ region, setRegion: setStored }),
    [region, setStored],
  )

  return (
    <BannerRegionContext.Provider value={value}>{children}</BannerRegionContext.Provider>
  )
}

/** Shared server region — one source of truth for banner countdowns site-wide. */
export function useBannerRegion(): [BannerRegion, (region: BannerRegion) => void] {
  const context = useContext(BannerRegionContext)
  if (!context) {
    throw new Error('useBannerRegion must be used within BannerRegionProvider')
  }
  return [context.region, context.setRegion]
}
