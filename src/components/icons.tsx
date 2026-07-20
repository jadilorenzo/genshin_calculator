import type { ReactNode, SVGProps } from 'react'
import type { Slot } from '../model'

type IconProps = SVGProps<SVGSVGElement> & { title?: string }

function Icon({ title, children, className, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </Icon>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
    </Icon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** Filled crescent for brand/logo — angled ~45°, smaller cutout */
export function BrandMoonLogo({ className, title, ...props }: IconProps) {
  return (
    <svg
      className={className ? `icon brand-moon ${className}` : 'icon brand-moon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M20.8 14.6A9 9 0 0 1 9.6 3.4 6.2 6.2 0 1 0 20.8 14.6Z"
      />
    </svg>
  )
}

function FlowerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 4.5c1.4 2.2 1.4 4.3 0 5.5-1.4-1.2-1.4-3.3 0-5.5Z" />
      <path d="M12 14c1.4 1.2 1.4 3.3 0 5.5-1.4-2.2-1.4-4.3 0-5.5Z" />
      <path d="M4.5 12c2.2-1.4 4.3-1.4 5.5 0-1.2 1.4-3.3 1.4-5.5 0Z" />
      <path d="M14 12c1.2-1.4 3.3-1.4 5.5 0-2.2 1.4-4.3 1.4-5.5 0Z" />
      <path d="M6.8 6.8c2.4.6 3.9 2 4.2 3.6-1.6-.3-3-1.8-4.2-3.6Z" />
      <path d="M13 13.6c.3 1.6 1.8 3 4.2 3.6-1.2-1.8-2.6-3.3-4.2-3.6Z" />
      <path d="M13 10.4c1.6-.3 3-1.8 4.2-3.6-2.4.6-3.9 2-4.2 3.6Z" />
      <path d="M6.8 17.2c1.2-1.8 2.6-3.3 4.2-3.6-.3 1.6-1.8 3-4.2 3.6Z" />
    </Icon>
  )
}

function PlumeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 19c4-1 8-5 11-11 1.2 3.5.2 7.2-2.5 10.2C11.8 20.8 8 20.5 6 19Z" />
      <path d="M17 8c-2.2 2.8-5 5.4-8.2 7.5" />
      <path d="M14.2 10.2c-1.6 2-3.6 3.9-5.9 5.5" />
    </Icon>
  )
}

function SandsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h10M7 20h10" />
      <path d="M8 4c0 3.2 1.6 5 4 6.5C14.4 9 16 7.2 16 4" />
      <path d="M8 20c0-3.2 1.6-5 4-6.5C14.4 15 16 16.8 16 20" />
      <path d="M12 10.5v3" />
    </Icon>
  )
}

function GobletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8l-.8 6.2A3.2 3.2 0 0 1 12 13.2a3.2 3.2 0 0 1-3.2-3L8 4Z" />
      <path d="M12 13.2V18" />
      <path d="M9.5 20h5" />
      <path d="M7.5 6.5h9" />
    </Icon>
  )
}

function CircletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 15.5 7.5 8l2.8 4.2L12 6.5l1.7 5.7L16.5 8 19 15.5" />
      <path d="M4.5 15.5h15" />
      <path d="M6 18h12" />
    </Icon>
  )
}

const SLOT_ICONS: Record<Slot, (props: IconProps) => ReactNode> = {
  flower: FlowerIcon,
  plume: PlumeIcon,
  sands: SandsIcon,
  goblet: GobletIcon,
  circlet: CircletIcon,
}

export function SlotIcon({ slot, ...props }: IconProps & { slot: Slot }) {
  const Comp = SLOT_ICONS[slot]
  return <Comp {...props} />
}
