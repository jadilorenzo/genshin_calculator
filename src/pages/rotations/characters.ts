import kitData from '../../data/characterKits.json'
import type { CharacterData, CharacterKitsFile } from './types'

const data = kitData as unknown as CharacterKitsFile

export const CHARACTER_KITS: CharacterData[] = data.characters

export const CHARACTER_BY_ID: Record<string, CharacterData> = Object.fromEntries(
  CHARACTER_KITS.map((c) => [c.id, c]),
)

export const ELEMENTS = [
  'Anemo',
  'Cryo',
  'Dendro',
  'Electro',
  'Geo',
  'Hydro',
  'Pyro',
] as const

export function getCharacter(id: string): CharacterData | undefined {
  return CHARACTER_BY_ID[id]
}
