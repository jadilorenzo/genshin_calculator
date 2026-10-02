import {
  getCharacter,
  getCharacterByName,
} from '../../rotations/characters'
import type { CharacterData } from '../../rotations/types'

const emptyKit = (): CharacterData['kit'] => ({
  normalAttack: null,
  elementalSkill: null,
  elementalBurst: null,
  passives: [],
  constellations: [],
})

/**
 * Names the combat-overlay OCR should recognize before a full kit import.
 * Released 7.1 characters use their live identity; 7.2+ names are roster
 * stubs so screenshots still resolve.
 */
export const OCR_CHARACTERS: CharacterData[] = [
  {
    id: 'vodyanitsa',
    name: 'Vodyanitsa',
    element: 'Hydro',
    weapon: 'Catalyst',
    rarity: 5,
    constellationName: 'Piscicula Aurea',
    version: '7.1',
    iconFile: 'UI_AvatarIcon_Vodyanitsa',
    icon: 'https://enka.network/ui/UI_AvatarIcon_Vodyanitsa.png',
    sideIcon: 'https://enka.network/ui/UI_AvatarIcon_Side_Vodyanitsa.png',
    kit: emptyKit(),
  },
  {
    id: 'vesna',
    name: 'Vesna',
    element: 'Anemo',
    weapon: 'Sword',
    rarity: 5,
    constellationName: 'Amentum Vernum',
    version: '7.1',
    iconFile: 'UI_AvatarIcon_Vesna',
    icon: 'https://enka.network/ui/UI_AvatarIcon_Vesna.png',
    sideIcon: 'https://enka.network/ui/UI_AvatarIcon_Side_Vesna.png',
    kit: emptyKit(),
  },
  {
    id: 'mitya',
    name: 'Mitya',
    element: 'Electro',
    weapon: '',
    rarity: 5,
    constellationName: '',
    version: '7.2',
    icon: null,
    sideIcon: null,
    kit: emptyKit(),
  },
  {
    id: 'valeriy',
    name: 'Valeriy',
    element: 'Electro',
    weapon: '',
    rarity: 5,
    constellationName: '',
    version: '7.2',
    icon: null,
    sideIcon: null,
    kit: emptyKit(),
  },
  {
    id: 'tsaritsa',
    name: 'Tsaritsa',
    element: 'Cryo',
    weapon: '',
    rarity: 5,
    constellationName: '',
    version: null,
    icon: null,
    sideIcon: null,
    kit: emptyKit(),
  },
  {
    id: 'danica',
    name: 'Danica',
    element: '',
    weapon: '',
    rarity: 5,
    constellationName: '',
    version: null,
    icon: null,
    sideIcon: null,
    kit: emptyKit(),
  },
]

const OCR_BY_ID = Object.fromEntries(OCR_CHARACTERS.map((c) => [c.id, c]))
const OCR_BY_NAME = Object.fromEntries(
  OCR_CHARACTERS.map((c) => [c.name.toLowerCase(), c]),
)

/** Drop OCR stubs once the same character lands in the kit file. */
export function ocrCharactersNotInKits(): CharacterData[] {
  return OCR_CHARACTERS.filter(
    (c) => !getCharacter(c.id) && !getCharacterByName(c.name),
  )
}

export function getOcrCharacterByName(name: string): CharacterData | undefined {
  return OCR_BY_NAME[name.toLowerCase()]
}

/** Kit roster first, then OCR-only names used by testing screenshots. */
export function getTestingCharacter(id: string): CharacterData | undefined {
  return getCharacter(id) ?? OCR_BY_ID[id]
}
