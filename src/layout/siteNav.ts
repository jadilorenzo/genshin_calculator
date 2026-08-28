import type { ComponentType, SVGProps } from 'react'
import {
  CharacterGoalsNavIcon,
  DataNavIcon,
  FarmNavIcon,
  RotationsNavIcon,
  TestingNavIcon,
  WishNavIcon,
} from '../components/icons.tsx'

export type DeskId = 'rotations' | 'farm' | 'goals' | 'wish' | 'testing' | 'data'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>

export type SiteLink = {
  to: string
  label: string
  end?: boolean
  isActive: (pathname: string) => boolean
}

export type PrimaryLink = {
  desk: DeskId
  to: string
  label: string
  icon: IconComponent
  align?: 'start' | 'end'
  defaultExpanded?: boolean
}

export function deskForPath(pathname: string): DeskId | null {
  if (pathname.startsWith('/testing')) return 'testing'
  if (pathname.startsWith('/characters')) return 'data'
  if (pathname.startsWith('/farming')) return 'goals'
  if (
    pathname.startsWith('/rotations') ||
    pathname.startsWith('/mine')
  ) {
    return 'rotations'
  }
  if (
    pathname.startsWith('/artifacts') ||
    pathname.startsWith('/builds')
  ) {
    return 'farm'
  }
  if (pathname.startsWith('/banners') || pathname.startsWith('/pulls')) {
    return 'wish'
  }
  return null
}

export const PRIMARY_LINKS: PrimaryLink[] = [
  {
    desk: 'rotations',
    to: '/rotations',
    label: 'Rotation Visualizer',
    icon: RotationsNavIcon,
  },
  {
    desk: 'farm',
    to: '/artifacts/lineup',
    label: 'Artifact Expectations',
    icon: FarmNavIcon,
  },
  {
    desk: 'goals',
    to: '/farming',
    label: 'Character Goals',
    icon: CharacterGoalsNavIcon,
  },
  {
    desk: 'wish',
    to: '/banners/odds',
    label: 'Wish Planning',
    icon: WishNavIcon,
  },
  {
    desk: 'testing',
    to: '/testing',
    label: 'DPS Test Dashboard',
    icon: TestingNavIcon,
  },
  {
    desk: 'data',
    to: '/characters',
    label: 'Data',
    icon: DataNavIcon,
    align: 'end',
  },
]

export const MAIN_NAV_LINKS = PRIMARY_LINKS.filter((link) => link.align !== 'end')
export const END_NAV_LINKS = PRIMARY_LINKS.filter((link) => link.align === 'end')

export const ROTATIONS_LINKS: SiteLink[] = [
  {
    to: '/rotations',
    label: 'Browse',
    end: true,
    isActive: (pathname) =>
      pathname === '/rotations' ||
      (pathname.startsWith('/rotations/') &&
        !pathname.startsWith('/rotations/editor') &&
        !pathname.startsWith('/rotations/mine')),
  },
  {
    to: '/rotations/editor',
    label: 'Editor',
    isActive: (pathname) => pathname.startsWith('/rotations/editor'),
  },
  {
    to: '/rotations/mine',
    label: 'Saved',
    isActive: (pathname) =>
      pathname.startsWith('/rotations/mine') ||
      pathname.startsWith('/mine/rotations'),
  },
]

export const FARM_LINKS: SiteLink[] = [
  {
    to: '/artifacts/lineup',
    label: 'Set lineup',
    isActive: (pathname) =>
      pathname.startsWith('/artifacts/lineup') || pathname === '/artifacts',
  },
  {
    to: '/artifacts/single/expectations',
    label: 'One piece',
    isActive: (pathname) =>
      pathname.includes('/artifacts/single/expectations') ||
      pathname.endsWith('/artifacts/single') ||
      pathname.includes('/artifacts/expectations') ||
      pathname.includes('/artifacts/chances') ||
      pathname.includes('/artifacts/farm'),
  },
  {
    to: '/artifacts/single/compare',
    label: 'Compare',
    isActive: (pathname) =>
      pathname.includes('/artifacts/single/compare') ||
      pathname.includes('/artifacts/compare'),
  },
]

export const GOALS_LINKS: SiteLink[] = [
  {
    to: '/farming',
    label: 'All goals',
    end: true,
    isActive: (pathname) => pathname === '/farming',
  },
]

export const TESTING_LINKS: SiteLink[] = [
  {
    to: '/testing',
    label: 'Sessions',
    end: true,
    isActive: (pathname) =>
      pathname === '/testing' ||
      (pathname.startsWith('/testing/') &&
        !pathname.startsWith('/testing/compare')),
  },
  {
    to: '/testing/compare',
    label: 'Compare over time',
    isActive: (pathname) => pathname.startsWith('/testing/compare'),
  },
]

export const WISH_LINKS: SiteLink[] = [
  {
    to: '/banners/odds',
    label: '5★ odds',
    isActive: (pathname) => pathname.includes('/odds'),
  },
  {
    to: '/banners/day',
    label: 'Pulling day',
    isActive: (pathname) => pathname.includes('/day'),
  },
  {
    to: '/banners/pace',
    label: 'Daily pace',
    isActive: (pathname) => pathname.includes('/pace'),
  },
  {
    to: '/banners/countdown',
    label: 'Countdown',
    isActive: (pathname) => pathname.includes('/countdown'),
  },
]

export function linksForDesk(desk: DeskId): SiteLink[] {
  if (desk === 'rotations') return ROTATIONS_LINKS
  if (desk === 'farm') return FARM_LINKS
  if (desk === 'goals') return GOALS_LINKS
  if (desk === 'testing') return TESTING_LINKS
  if (desk === 'wish') return WISH_LINKS
  return []
}

export function deskLabel(desk: DeskId): string {
  return PRIMARY_LINKS.find((link) => link.desk === desk)?.label ?? desk
}
