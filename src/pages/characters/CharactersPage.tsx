import { useEffect, useMemo, useState } from 'react'
import { CHARACTER_KITS, ELEMENTS } from '../rotations/characters'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CharacterKitView } from './CharacterKitView'

export default function CharactersPage() {
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    if (!selectedId || !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Characters</h1>
        </div>
        <p className="field-note">
          {CHARACTER_KITS.length} kits — talents, passives, and constellations.
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

          <ul className="characters-list">
            {filtered.map((c) => {
              const active = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={
                      active
                        ? 'characters-list-item selected'
                        : 'characters-list-item'
                    }
                    data-element={c.element}
                    onClick={() => setSelectedId(c.id)}
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
