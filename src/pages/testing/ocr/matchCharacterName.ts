import {
  CHARACTER_KITS,
  getCharacterByName,
} from '../../rotations/characters'
import type { CharacterData } from '../../rotations/types'

const levenshtein = (a: string, b: string): number => {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  const prev = new Array(right.length + 1)
  const curr = new Array(right.length + 1)
  for (let j = 0; j <= right.length; j += 1) prev[j] = j
  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j]
  }
  return prev[right.length]
}

/** Collapse common OCR confusions before matching. */
export function normalizeOcrName(raw: string): string {
  return raw
    .replace(/[^A-Za-z .'-]/g, ' ')
    .replace(/\b[Il1]\b/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Common short OCR misreads → kit display name. */
const OCR_NAME_ALIASES: Record<string, string> = {
  neer: 'Nefer',
  net: 'Nefer',
  nef: 'Nefer',
  nefer: 'Nefer',
  lneffa: 'Ineffa',
  ineffa: 'Ineffa',
  columb1na: 'Columbina',
  columblna: 'Columbina',
  columbina: 'Columbina',
  alno: 'Aino',
  aina: 'Aino',
  laurna: 'Lauma',
  sicrose: 'Sucrose',
  sucrose: 'Sucrose',
}

/** Exact kit lookup, then best Levenshtein match within a small distance. */
export function matchCharacterName(raw: string): CharacterData | null {
  const cleaned = normalizeOcrName(raw)
  if (!cleaned || cleaned.length < 2) return null

  const alias =
    OCR_NAME_ALIASES[cleaned.toLowerCase().replace(/\s+/g, '')] ||
    OCR_NAME_ALIASES[raw.toLowerCase().replace(/[^a-z0-9]/g, '')]
  if (alias) {
    const fromAlias = getCharacterByName(alias)
    if (fromAlias) return fromAlias
  }

  const exact = getCharacterByName(cleaned)
  if (exact) return exact

  // Spaced OCR junk ("A SE TE ES", "oy Lo") false-positives on short names.
  // Only allow multi-word via exact kit match, or the first word alone.
  if (/\s/.test(cleaned)) {
    const collapsed = getCharacterByName(cleaned.replace(/\s+/g, ''))
    if (collapsed) return collapsed
    const first = cleaned.split(/\s+/)[0]
    if (first.length >= 3) return matchCharacterName(first)
    return null
  }

  let best: CharacterData | null = null
  let bestDist = Infinity
  for (const character of CHARACTER_KITS) {
    const dist = Math.min(
      levenshtein(cleaned, character.name),
      levenshtein(cleaned.replace(/\s+/g, ''), character.name.replace(/\s+/g, '')),
    )
    if (dist < bestDist) {
      bestDist = dist
      best = character
    }
  }
  const threshold =
    cleaned.length <= 4 ? 1 : cleaned.length <= 7 ? 2 : cleaned.length <= 12 ? 3 : 4
  return best && bestDist <= threshold ? best : null
}
