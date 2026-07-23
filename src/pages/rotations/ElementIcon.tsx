import { useState } from 'react'

const ELEMENT_ICON_BASE = 'https://genshin.jmp.blue/elements'

/** Map aura / reaction elements to genshin.jmp.blue slug. */
const ELEMENT_SLUG: Record<string, string> = {
  Pyro: 'pyro',
  Hydro: 'hydro',
  Electro: 'electro',
  Cryo: 'cryo',
  Anemo: 'anemo',
  Geo: 'geo',
  Dendro: 'dendro',
  Quicken: 'dendro',
  Frozen: 'cryo',
  Burning: 'pyro',
}

export function elementIconSrc(element: string): string | null {
  const slug = ELEMENT_SLUG[element]
  if (!slug) return null
  return `${ELEMENT_ICON_BASE}/${slug}/icon`
}

interface ElementIconProps {
  element: string
  className?: string
  title?: string
}

/** Official-style element glyph (jmp.blue CDN). */
export function ElementIcon({ element, className, title }: ElementIconProps) {
  const [failed, setFailed] = useState(false)
  const src = elementIconSrc(element)

  if (!src || failed) {
    return (
      <span
        className={`${className ?? ''} fallback`.trim()}
        title={title ?? element}
        aria-hidden
      >
        {element.slice(0, 1)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      title={title ?? element}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
