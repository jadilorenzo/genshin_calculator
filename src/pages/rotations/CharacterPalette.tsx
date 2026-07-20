import { useMemo, useState, type DragEvent } from 'react'
import { CHARACTER_KITS, ELEMENTS } from './characters'
import { CharacterIcon } from './CharacterIcon'
import type { CharacterData } from './types'

const DRAG_TYPE = 'application/x-fmr-character'

export function readCharacterDrag(e: DragEvent): string | null {
  const id = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData('text/plain')
  return id || null
}

export function setCharacterDrag(e: DragEvent, characterId: string) {
  e.dataTransfer.setData(DRAG_TYPE, characterId)
  e.dataTransfer.setData('text/plain', characterId)
  e.dataTransfer.effectAllowed = 'copyMove'
}

interface CharacterPaletteProps {
  selectedId: string | null
  onSelect: (character: CharacterData) => void
}

export function CharacterPalette({ selectedId, onSelect }: CharacterPaletteProps) {
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CHARACTER_KITS.filter((c) => {
      if (element !== 'all' && c.element !== element) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.weapon.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q)
      )
    })
  }, [query, element])

  return (
    <aside className="rotation-palette" aria-label="Characters">
      <div className="rotation-palette-head">
        <h2 className="rotation-section-title">Characters</h2>
        <p className="field-note">{CHARACTER_KITS.length} kits loaded</p>
      </div>

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

      <ul className="rotation-char-list">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={
                selectedId === c.id
                  ? 'rotation-char-card selected'
                  : 'rotation-char-card'
              }
              draggable
              onDragStart={(e) => setCharacterDrag(e, c.id)}
              onClick={() => onSelect(c)}
            >
              {c.icon || c.iconFile ? (
                <CharacterIcon character={c} className="rotation-char-icon" />
              ) : (
                <span className="rotation-char-icon fallback" aria-hidden>
                  {c.name.slice(0, 1)}
                </span>
              )}
              <span className="rotation-char-meta">
                <span className="rotation-char-name">{c.name}</span>
                <span className="rotation-char-sub">
                  {c.element} · {c.weapon}
                </span>
              </span>
              <span className={`rotation-rarity r${c.rarity}`} aria-label={`${c.rarity} star`}>
                {c.rarity}★
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
