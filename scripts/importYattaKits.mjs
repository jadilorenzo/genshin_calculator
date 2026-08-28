/**
 * Merge Yatta avatar payloads into characterKits.json + characterMaterials.json.
 *
 *   node scripts/importYattaKits.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const KITS = path.join(ROOT, 'src/data/characterKits.json')
const MATS = path.join(ROOT, 'src/data/characterMaterials.json')
const TALENT_LEVEL = 9

const CACHE_DIR = process.env.YATTA_CACHE || '/tmp/yatta-kits'

const AVATARS = [
  {
    id: 'odette',
    yattaId: 10000150,
    name: 'Odette',
    version: '7.0',
  },
  {
    id: 'alyosha',
    yattaId: 10000148,
    name: 'Alyosha',
    version: '7.0',
  },
  {
    id: 'traveler-cryo',
    yattaId: '10000005-cryo',
    name: 'Traveler (Cryo)',
    version: '7.0',
    keepMaterials: true,
  },
]

const WEAPON = {
  WEAPON_SWORD_ONE_HAND: 'Sword',
  WEAPON_CLAYMORE: 'Claymore',
  WEAPON_POLE: 'Polearm',
  WEAPON_BOW: 'Bow',
  WEAPON_CATALYST: 'Catalyst',
}

const ELEMENT = {
  Ice: 'Cryo',
  Electric: 'Electro',
  Fire: 'Pyro',
  Water: 'Hydro',
  Wind: 'Anemo',
  Rock: 'Geo',
  Grass: 'Dendro',
}

const MATERIAL_TYPE = {
  101275: { typeText: 'Local Specialty (Snezhnaya)', rarity: 1 },
  101276: { typeText: 'Local Specialty (Snezhnaya)', rarity: 1 },
  104365: { typeText: 'Character Talent Material', rarity: 2 },
  104366: { typeText: 'Character Talent Material', rarity: 3 },
  104367: { typeText: 'Character Talent Material', rarity: 4 },
  104368: { typeText: 'Character Talent Material', rarity: 2 },
  104369: { typeText: 'Character Talent Material', rarity: 3 },
  104370: { typeText: 'Character Talent Material', rarity: 4 },
  112146: { typeText: 'Character and Weapon Enhancement Material', rarity: 2 },
  112147: { typeText: 'Character and Weapon Enhancement Material', rarity: 3 },
  112148: { typeText: 'Character and Weapon Enhancement Material', rarity: 4 },
  112149: { typeText: 'Character and Weapon Enhancement Material', rarity: 2 },
  112150: { typeText: 'Character and Weapon Enhancement Material', rarity: 3 },
  112151: { typeText: 'Character and Weapon Enhancement Material', rarity: 4 },
  113083: { typeText: 'Character Level-Up Material', rarity: 5 },
  113088: { typeText: 'Character Level-Up Material', rarity: 5 },
  113090: { typeText: 'Character Level-Up Material', rarity: 4 },
  113091: { typeText: 'Character Level-Up Material', rarity: 4 },
}

function cleanText(s) {
  return String(s || '')
    .replace(/\{LAYOUT_PC#([^}]+)\}/g, '$1')
    .replace(/\{LAYOUT_[^}]+\}/g, '')
    .replace(/\{LINK#[^}]+\}/g, '')
    .replace(/\{\/LINK\}/g, '')
    .replace(/<color=[^>]+>/gi, '')
    .replace(/<\/color>/gi, '')
    .replace(/\\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseLabel(label, params, levelIndex) {
  const [rawName, rawFmt] = String(label).split('|')
  const name = (rawName || '').trim()
  if (!name) return null
  const match = (rawFmt || '').match(/\{(param\d+)(?::([^}]+))?\}/)
  if (!match) {
    return { name, raw: rawFmt?.trim() ?? null, value: null, unit: null }
  }
  const paramKey = match[1]
  const format = match[2] || ''
  const idx = Number(paramKey.replace('param', '')) - 1
  const raw = Array.isArray(params) ? (params[idx] ?? null) : null
  let unit = null
  if (/\bs\b/i.test(rawFmt || '') || /duration|cd|cooldown/i.test(name)) unit = 's'
  if (/energy cost/i.test(name)) unit = 'energy'
  return {
    name,
    paramKey,
    format,
    raw: raw == null ? null : raw,
    unit,
  }
}

function skillFromTalent(talent) {
  if (!talent) return null
  const promotes = talent.promote || {}
  const level = promotes[String(TALENT_LEVEL)] || promotes['1']
  const labels = (level?.description || []).filter((l) => String(l).trim())
  const paramSeries = {}
  const maxLevel = Math.max(
    ...Object.keys(promotes).map(Number).filter((n) => n > 0),
    1,
  )
  const width = Array.isArray(level?.params) ? level.params.length : 0
  for (let i = 0; i < width; i++) {
    const key = `param${i + 1}`
    paramSeries[key] = []
    for (let lv = 1; lv <= maxLevel; lv++) {
      const row = promotes[String(lv)]?.params
      paramSeries[key].push(Array.isArray(row) ? (row[i] ?? 0) : 0)
    }
  }
  const attributes = labels
    .map((l) => parseLabel(l, level?.params, TALENT_LEVEL - 1))
    .filter(Boolean)
  const cdAttr =
    attributes.find((p) => /^cd$/i.test(p.name)) ||
    attributes.find((p) => /cooldown/i.test(p.name))
  const energyAttr = attributes.find((p) => /energy cost/i.test(p.name))
  const durationAttr =
    attributes.find((p) => /^duration$/i.test(p.name)) ||
    attributes.find(
      (p) =>
        p.unit === 's' &&
        typeof p.raw === 'number' &&
        p.raw > 0 &&
        /duration/i.test(p.name) &&
        !/cd|cooldown/i.test(p.name),
    )
  return {
    name: talent.name,
    description: cleanText(talent.description),
    cooldown: talent.cooldown || cdAttr?.raw || null,
    energyCost: talent.cost || energyAttr?.raw || null,
    duration: durationAttr?.raw ?? null,
    attributes,
    parameters: paramSeries,
    labels: (level?.description || []).filter((l) => String(l).trim()),
  }
}

function kitFromAvatar(data, spec) {
  const t = data.talent || {}
  const passives = ['4', '5', '6', '8', '9']
    .map((k) => t[k])
    .filter(Boolean)
    .map((p) => ({
      name: p.name,
      description: cleanText(p.description),
    }))
  const constellations = []
  for (const key of ['0', '1', '2', '3', '4', '5']) {
    const c = data.constellation?.[key]
    if (!c) continue
    constellations.push({
      level: Number(key) + 1,
      name: cleanText(c.name).replace(/^"|"$/g, ''),
      description: cleanText(c.description),
    })
  }
  const iconFile = data.icon || null
  return {
    id: spec.id,
    name: spec.name,
    element: ELEMENT[data.element] || data.element,
    weapon: WEAPON[data.weaponType] || data.weaponType,
    rarity: data.rank,
    constellationName: data.fetter?.constellation || '',
    version: spec.version,
    iconFile,
    icon: iconFile ? `https://enka.network/ui/${iconFile}.png` : null,
    sideIcon: iconFile
      ? `https://enka.network/ui/${iconFile.replace('UI_AvatarIcon_', 'UI_AvatarIcon_Side_')}.png`
      : null,
    kit: {
      normalAttack: skillFromTalent(t['0']),
      elementalSkill: skillFromTalent(t['1']),
      elementalBurst: skillFromTalent(t['3']),
      passives,
      constellations,
    },
  }
}

function costItems(costMap, coinCost, items) {
  const out = []
  if (coinCost) {
    out.push({ id: 202, name: 'Mora', count: coinCost })
  }
  for (const [id, count] of Object.entries(costMap || {})) {
    const meta = items[id]
    out.push({
      id: Number(id) || id,
      name: meta?.name || String(id),
      count,
    })
  }
  return out
}

function materialsFromAvatar(data, spec) {
  const items = data.items || {}
  const promote = data.upgrade?.promote || []
  const ascension = {}
  for (let i = 1; i <= 6; i++) {
    const row = promote[i] || {}
    ascension[`ascend${i}`] = costItems(row.costItems, row.coinCost, items)
  }
  const talentPromote = data.talent?.['1']?.promote || {}
  const talent = {}
  for (let lv = 2; lv <= 10; lv++) {
    const row = talentPromote[String(lv)] || {}
    talent[`lvl${lv}`] = costItems(row.costItems, row.coinCost, items)
  }
  return {
    id: spec.id,
    name: spec.name,
    element: ELEMENT[data.element] || data.element,
    rarity: data.rank,
    ascension,
    talent,
    items,
  }
}

function rememberMaterial(list, id, item) {
  if (!item?.name || item.name === 'Mora') return
  if (list.some((m) => m.name === item.name)) return
  const extra = MATERIAL_TYPE[Number(id)] || {}
  list.push({
    name: item.name,
    rarity: extra.rarity ?? item.rank ?? null,
    typeText: extra.typeText ?? null,
    daysOfWeek: [],
    domain: null,
    icon: item.icon || null,
  })
}

const kitsFile = JSON.parse(fs.readFileSync(KITS, 'utf8'))
const matsFile = JSON.parse(fs.readFileSync(MATS, 'utf8'))

async function loadAvatar(spec) {
  const cacheFile = path.join(CACHE_DIR, `${spec.id}.json`)
  if (fs.existsSync(cacheFile)) {
    const payload = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    if (payload?.data) return payload.data
  }
  const url = `https://gi.yatta.moe/api/v2/en/avatar/${spec.yattaId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const payload = await res.json()
  if (!payload?.data) throw new Error(`No data for ${spec.id}`)
  return payload.data
}

for (const spec of AVATARS) {
  const data = await loadAvatar(spec)

  const character = kitFromAvatar(data, spec)
  const idx = kitsFile.characters.findIndex((c) => c.id === spec.id)
  if (idx >= 0) kitsFile.characters[idx] = character
  else kitsFile.characters.push(character)

  if (!spec.keepMaterials) {
    const mats = materialsFromAvatar(data, spec)
    const { items, ...row } = mats
    const midx = matsFile.characters.findIndex((c) => c.id === spec.id)
    if (midx >= 0) matsFile.characters[midx] = row
    else matsFile.characters.push(row)
    for (const [id, item] of Object.entries(items)) {
      rememberMaterial(matsFile.materials, id, item)
    }
  }
}

kitsFile.characters.sort((a, b) => a.name.localeCompare(b.name))
kitsFile.count = kitsFile.characters.length
kitsFile.extractedAt = new Date().toISOString()
kitsFile.source = 'genshin-db + yatta 7.0 (Odette, Alyosha, Traveler Cryo)'

matsFile.characters.sort((a, b) => a.name.localeCompare(b.name))
matsFile.materials.sort((a, b) => a.name.localeCompare(b.name))
matsFile.generatedAt = new Date().toISOString()

fs.writeFileSync(KITS, JSON.stringify(kitsFile))
fs.writeFileSync(MATS, `${JSON.stringify(matsFile, null, 2)}\n`)
console.log(`Kits: ${kitsFile.count} characters`)
console.log(`Materials: ${matsFile.characters.length} characters, ${matsFile.materials.length} items`)
