import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { CHARACTER_KITS, ELEMENTS, getCharacter } from '../rotations/characters'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CharacterKitView } from './CharacterKitView'

export default function CharactersPage() {
  useDocumentTitle(PAGE_TITLES.characters)
  const navigate = useNavigate()
  const { characterId } = useParams()
  const listRef = useRef<HTMLUListElement>(null)
  const linkedCharacter = characterId ? getCharacter(characterId) : undefined
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(
    () => linkedCharacter?.id ?? null,
  )

  useEffect(() => {
    if (!linkedCharacter) return
    setQuery('')
    setElement('all')
    setSelectedId(linkedCharacter.id)
  }, [linkedCharacter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CHARACTER_KITS.filter((c) => {
      if (element !== 'all' && c.element !== element) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.weapon.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q) ||
        (c.constellationName?.toLowerCase().includes(q) ?? false)
      )
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [query, element])

  useEffect(() => {
    if (linkedCharacter) return
    if (!selectedId || !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId, linkedCharacter])

  useEffect(() => {
    if (!selectedId || !listRef.current) return
    const item = listRef.current.querySelector(
      `[data-character-id="${selectedId}"]`,
    )
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, filtered])

  const selected =
    filtered.find((c) => c.id === selectedId) ??
    (selectedId ? getCharacter(selectedId) : null) ??
    null

  const openCharacter = (id: string) => {
    setSelectedId(id)
    navigate(`/characters/${id}`, { replace: true })
  }

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Characters</h1>
        </div>
        <p className="field-note">
          {CHARACTER_KITS.length} kits — animation timings, talents, passives,
          and constellations.
        </p>
      </header>

      <div className="characters-workspace">
        <aside className="characters-list-panel" aria-label="Character list">
          <label className="rotation-search">
            <span className="visually-hidden">Search characters</span>
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="chip-row wrap" role="group" aria-label="Element filter">
            <button
              type="button"
              className={element === 'all' ? 'chip compact active' : 'chip compact'}
              onClick={() => setElement('all')}
            >
              All
            </button>
            {ELEMENTS.map((el) => (
              <button
                key={el}
                type="button"
                className={element === el ? 'chip compact active' : 'chip compact'}
                onClick={() => setElement(el)}
              >
                {el}
              </button>
            ))}
          </div>

          <p className="field-note characters-list-count">
            {filtered.length} shown
          </p>

          <ul className="characters-list" ref={listRef}>
            {filtered.map((c) => {
              const active = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-character-id={c.id}
                    className={
                      active
                        ? 'characters-list-item selected'
                        : 'characters-list-item'
                    }
                    data-element={c.element}
                    onClick={() => openCharacter(c.id)}
                  >
                    <CharacterIcon
                      character={c}
                      className="characters-list-icon"
                    />
                    <span className="characters-list-meta">
                      <span className="characters-list-name">{c.name}</span>
                      <span className="characters-list-sub">
                        {c.element} · {c.weapon}
                      </span>
                    </span>
                    <span
                      className={`rotation-rarity r${c.rarity}`}
                      aria-label={`${c.rarity} star`}
                    >
                      {c.rarity}★
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section
          className="characters-detail-panel"
          aria-label={selected ? `${selected.name} kit` : 'Character details'}
        >
          {selected ? (
            <CharacterKitView
              key={selected.id}
              character={selected}
              className="characters-detail-kit"
            />
          ) : (
            <p className="field-note">No characters match these filters.</p>
          )}
        </section>
      </div>
    </>
  )
}
