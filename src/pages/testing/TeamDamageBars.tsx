import { useMemo } from 'react'
import { CharacterIcon } from '../rotations/CharacterIcon'
import { getCharacter } from '../rotations/characters'
import type { TestingCharacterRow, TestingRun } from './types'

type TeamDamageBarsProps = {
  runs: TestingRun[]
  selectedRunId: string | null
  mode: 'selected' | 'average-by-main'
}

type BarRow = {
  key: string
  characterId: string
  name: string
  damage: number
  teamPct: number
}

export function TeamDamageBars({
  runs,
  selectedRunId,
  mode,
}: TeamDamageBarsProps) {
  const rows = useMemo(() => {
    const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0]
    const mainDpsId = activeRun?.mainDpsId || ''
    const mainName = getCharacter(mainDpsId)?.name || ''

    /** Main DPS pinned to the top, everyone else alphabetical. */
    const byMainThenName = (a: BarRow, b: BarRow) => {
      const aMain = isMain(a, mainDpsId, mainName)
      const bMain = isMain(b, mainDpsId, mainName)
      if (aMain !== bMain) return aMain ? -1 : 1
      return a.name.localeCompare(b.name)
    }

    if (mode === 'selected') {
      if (!activeRun) return [] as BarRow[]
      return activeRun.characters
        .filter((c) => c.name || c.characterId)
        .map((c) => toBar(c))
        .sort(byMainThenName)
    }

    // Average character share per main DPS grouping — flatten all runs for now
    // into overall averages when viewing "average" mode.
    const byChar = new Map<
      string,
      { characterId: string; name: string; damage: number; pct: number; n: number }
    >()
    for (const run of runs) {
      for (const c of run.characters) {
        if (!c.name && !c.characterId) continue
        const key = c.characterId || c.name
        const prev = byChar.get(key) || {
          characterId: c.characterId,
          name: c.name,
          damage: 0,
          pct: 0,
          n: 0,
        }
        prev.damage += c.damage ?? 0
        prev.pct += c.teamPct ?? 0
        prev.n += 1
        byChar.set(key, prev)
      }
    }
    return [...byChar.values()]
      .map((entry) => ({
        key: entry.characterId || entry.name,
        characterId: entry.characterId,
        name: entry.name || getCharacter(entry.characterId)?.name || 'Unknown',
        damage: entry.n ? entry.damage / entry.n : 0,
        teamPct: entry.n ? entry.pct / entry.n : 0,
      }))
      .sort(byMainThenName)
  }, [runs, selectedRunId, mode])

  if (rows.length === 0) {
    return <p className="field-note">No team breakdown yet.</p>
  }

  const maxDamage = Math.max(1, ...rows.map((r) => r.damage))

  return (
    <ul className="testing-damage-bars">
      {rows.map((row) => {
        const character = getCharacter(row.characterId)
        const widthPct = Math.max(2, (row.damage / maxDamage) * 100)
        return (
          <li key={row.key}>
            <div className="testing-damage-bar-meta">
              {character ? (
                <CharacterIcon
                  character={character}
                  className="testing-char-icon"
                />
              ) : null}
              <span className="testing-damage-bar-name">{row.name}</span>
              <span className="testing-damage-bar-nums">
                {Math.round(row.damage).toLocaleString()}
                {row.teamPct != null
                  ? ` · ${row.teamPct.toFixed(1)}%`
                  : ''}
              </span>
            </div>
            <div className="testing-damage-bar-track">
              <div
                className="testing-damage-bar-fill"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** OCR rows may resolve only a name, so fall back to comparing display names. */
function isMain(row: BarRow, mainDpsId: string, mainName: string): boolean {
  if (mainDpsId && row.characterId) return row.characterId === mainDpsId
  return Boolean(mainName) && row.name === mainName
}

function toBar(c: TestingCharacterRow): BarRow {
  return {
    key: c.characterId || c.name || String(c.slot),
    characterId: c.characterId,
    name: c.name || getCharacter(c.characterId)?.name || `Slot ${c.slot + 1}`,
    damage: c.damage ?? 0,
    teamPct: c.teamPct ?? 0,
  }
}
