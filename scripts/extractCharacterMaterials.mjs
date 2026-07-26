/**
 * Regenerates src/data/characterMaterials.json from genshin-db.
 *
 *   npm i -D genshin-db
 *   node scripts/extractCharacterMaterials.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import genshindb from 'genshin-db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../src/data/characterMaterials.json')

const ASCEND_KEYS = [
  'ascend1',
  'ascend2',
  'ascend3',
  'ascend4',
  'ascend5',
  'ascend6',
]
const TALENT_KEYS = [
  'lvl2',
  'lvl3',
  'lvl4',
  'lvl5',
  'lvl6',
  'lvl7',
  'lvl8',
  'lvl9',
  'lvl10',
]

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function costItems(costs, key) {
  const list = costs?.[key]
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item?.name && item.count > 0)
    .map((item) => ({
      id: item.id ?? null,
      name: item.name,
      count: item.count,
    }))
}

function materialMeta(name) {
  const mat = genshindb.materials(name)
  if (!mat) {
    return {
      name,
      rarity: null,
      typeText: null,
      daysOfWeek: [],
      domain: null,
      icon: null,
    }
  }
  return {
    name: mat.name || name,
    rarity: mat.rarity ?? null,
    typeText: mat.typeText ?? mat.category ?? null,
    daysOfWeek: Array.isArray(mat.daysOfWeek) ? mat.daysOfWeek : [],
    domain: mat.dropDomainName ?? null,
    icon: mat.images?.filename_icon || mat.images?.icon || null,
  }
}

function resolveCharacter(name) {
  if (name.startsWith('Traveler')) {
    const base = genshindb.characters('Aether')
    return base
      ? {
          ...base,
          name,
          elementText: name.match(/\(([^)]+)\)/)?.[1] || base.elementText,
        }
      : null
  }
  return genshindb.characters(name)
}

function resolveTalents(name) {
  return genshindb.talents(name)
}

const talentNames = genshindb.talents('names', { matchCategories: true })
const characters = []
const materials = new Map()

function rememberMaterials(items) {
  for (const item of items) {
    if (!materials.has(item.name)) {
      materials.set(item.name, materialMeta(item.name))
    }
  }
}

for (const talentName of talentNames) {
  const char = resolveCharacter(talentName)
  const talents = resolveTalents(talentName)
  if (!char || !talents) continue

  const ascension = {}
  for (const key of ASCEND_KEYS) {
    const items = costItems(char.costs, key)
    ascension[key] = items
    rememberMaterials(items)
  }

  const talent = {}
  for (const key of TALENT_KEYS) {
    const items = costItems(talents.costs, key)
    talent[key] = items
    rememberMaterials(items)
  }

  characters.push({
    id: slugify(talentName),
    name: talentName,
    element: char.elementText || '',
    rarity: char.rarity ?? null,
    ascension,
    talent,
  })
}

characters.sort((a, b) => a.name.localeCompare(b.name))

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'genshin-db',
  ascendLabels: {
    ascend1: 'Ascension 1 (20)',
    ascend2: 'Ascension 2 (40)',
    ascend3: 'Ascension 3 (50)',
    ascend4: 'Ascension 4 (60)',
    ascend5: 'Ascension 5 (70)',
    ascend6: 'Ascension 6 (80/90)',
  },
  talentLabels: {
    lvl2: 'Talent 2',
    lvl3: 'Talent 3',
    lvl4: 'Talent 4',
    lvl5: 'Talent 5',
    lvl6: 'Talent 6',
    lvl7: 'Talent 7',
    lvl8: 'Talent 8',
    lvl9: 'Talent 9',
    lvl10: 'Talent 10',
  },
  materials: [...materials.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
  characters,
}

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)
console.log(
  `Wrote ${characters.length} characters, ${materials.size} materials → ${OUT}`,
)
