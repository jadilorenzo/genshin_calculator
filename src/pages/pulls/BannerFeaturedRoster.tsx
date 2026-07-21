import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCharacterByName } from '../rotations/characters.ts'
import { CharacterIcon } from '../rotations/CharacterIcon.tsx'
import type { CharacterData } from '../rotations/types.ts'
import type { BannerFeaturedCharacter } from '../../model/bannerSchedule.ts'

const FALLBACK_CDN = 'https://gi.yatta.moe/assets/UI'

function BannerPortrait({
  character,
  variant,
}: {
  character: Pick<CharacterData, 'name' | 'icon' | 'sideIcon' | 'iconFile' | 'element'>
  variant: 'featured' | 'rateup'
}) {
  const [failed, setFailed] = useState(0)
  const yatta = character.iconFile
    ? `${FALLBACK_CDN}/${character.iconFile}.png`
    : null
  const sources =
    variant === 'featured'
      ? [character.icon, yatta, character.sideIcon]
      : [character.icon, yatta, character.sideIcon]
  const src = sources.filter(Boolean)[failed] ?? null

  if (!src) {
    return (
      <span
        className={`banner-featured-portrait fallback ${variant}`}
        data-element={character.element}
        aria-hidden
      >
        {character.name.slice(0, 1)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={`banner-featured-portrait ${variant}`}
      data-element={character.element}
      loading="lazy"
      onError={() => setFailed((step) => step + 1)}
    />
  )
}

function FeaturedCard({
  character,
  kit,
}: {
  character: BannerFeaturedCharacter
  kit: CharacterData | undefined
}) {
  const card = (
    <article
      className="banner-featured-card"
      data-element={kit?.element ?? 'unknown'}
    >
      <div className="banner-featured-portrait-frame">
        {kit ? (
          <BannerPortrait character={kit} variant="featured" />
        ) : (
          <span className="banner-featured-portrait fallback featured" aria-hidden>
            {character.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="banner-featured-card-copy">
        <p className="banner-featured-name">{character.name}</p>
        <p className="banner-featured-meta">
          {kit ? `${kit.element} · ${kit.weapon}` : 'Featured'}
          <span className="rotation-rarity r5">5★</span>
        </p>
      </div>
    </article>
  )

  if (!kit) return card

  return (
    <Link
      to={`/characters/${kit.id}`}
      className="banner-featured-card-link"
      aria-label={`View ${character.name} kit`}
    >
      {card}
    </Link>
  )
}

export function BannerFeaturedRoster({
  characters,
  upcoming = false,
}: {
  characters: BannerFeaturedCharacter[]
  upcoming?: boolean
}) {
  if (characters.length === 0) return null

  const fiveStars = characters.filter((character) => character.rarity === 5)
  const fourStars = characters.filter((character) => character.rarity === 4)

  return (
    <div
      className={upcoming ? 'banner-featured-roster upcoming' : 'banner-featured-roster'}
      aria-label={upcoming ? 'Upcoming banner characters' : 'Current banner characters'}
    >
      <div className="banner-featured-five-grid">
        {fiveStars.map((character) => (
          <FeaturedCard
            key={character.name}
            character={character}
            kit={getCharacterByName(character.name)}
          />
        ))}
      </div>

      {fourStars.length > 0 ? (
        <div className="banner-featured-four-block">
          <p className="banner-featured-rateup-label">Rate-up 4★</p>
          <ul className="banner-featured-four-row">
            {fourStars.map((character) => {
              const kit = getCharacterByName(character.name)
              if (!kit) {
                return (
                  <li key={character.name} className="banner-featured-four-chip">
                    <span className="banner-featured-four-icon fallback" aria-hidden>
                      {character.name.slice(0, 1)}
                    </span>
                    <span className="banner-featured-four-name">{character.name}</span>
                  </li>
                )
              }

              return (
                <li key={character.name}>
                  <Link
                    to={`/characters/${kit.id}`}
                    className="banner-featured-four-chip"
                    aria-label={`View ${character.name} kit`}
                  >
                    <CharacterIcon character={kit} className="banner-featured-four-icon" />
                    <span className="banner-featured-four-name">{character.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
