import { useMemo, useState } from 'react'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { CHARACTER_KITS, getCharacter } from '../rotations/characters'

type CharacterPickerFieldProps = {
  value: string
  onChange: (characterId: string) => void
  label?: string
  allowEmpty?: boolean
}

export function CharacterPickerField({
  value,
  onChange,
  label = 'Character',
  allowEmpty = true,
}: CharacterPickerFieldProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = value ? getCharacter(value) : undefined

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CHARACTER_KITS.slice(0, 12)
    return CHARACTER_KITS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q),
    ).slice(0, 16)
  }, [query])

  return (
    <div className="testing-char-picker">
      <span className="label">{label}</span>
      <button
        type="button"
        className="testing-char-picker-current chip compact"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {selected ? (
          <>
            <CharacterIcon character={selected} className="testing-char-icon" />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="field-note">Pick character</span>
        )}
      </button>
      {open ? (
        <div className="testing-char-picker-menu">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            autoFocus
          />
          <ul>
            {allowEmpty ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  Clear
                </button>
              </li>
            ) : null}
            {matches.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className={character.id === value ? 'active' : undefined}
                  onClick={() => {
                    onChange(character.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <CharacterIcon
                    character={character}
                    className="testing-char-icon"
                  />
                  <span>{character.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
