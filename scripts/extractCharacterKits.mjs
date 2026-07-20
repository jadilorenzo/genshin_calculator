/**
 * Regenerates src/data/characterKits.json from genshin-db.
 *
 *   npm i -D genshin-db
 *   node scripts/extractCharacterKits.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import genshindb from 'genshin-db'

const TALENT_LEVEL = 9
const PARAM_INDEX = TALENT_LEVEL - 1

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../src/data/characterKits.json')

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseLabeledValue(label, parameters) {
  const [rawName, rawFmt] = label.split('|')
  const name = (rawName || '').trim()
  const match = (rawFmt || '').match(/\{(param\d+)(?::([^}]+))?\}/)
  if (!match) {
    return { name, raw: rawFmt?.trim() ?? null, value: null, unit: null }
  }
  const paramKey = match[1]
  const format = match[2] || ''
  const series = parameters?.[paramKey]
  const raw = Array.isArray(series) ? (series[PARAM_INDEX] ?? series[0] ?? null) : null
  let unit = null
  if (/\bs\b/i.test(rawFmt || '') || /duration|cd|cooldown/i.test(name)) unit = 's'
  if (/energy cost/i.test(name)) unit = 'energy'
  return { name, paramKey, format, raw, unit }
}

function extractTiming(labels, parameters) {
  const attributes = (labels || []).map((l) => parseLabeledValue(l, parameters))
  const find = (re) => attributes.find((p) => re.test(p.name))
  const cd = find(/^cd$/i) || find(/cooldown/i)
  const energy = find(/energy cost/i)
  const duration = find(/^duration$/i) || find(/skill duration/i)
  return {
    cooldown: cd?.raw ?? null,
    energyCost: energy?.raw ?? null,
    duration: duration?.raw ?? null,
    attributes,
  }
}

function skillFromCombat(combat) {
  if (!combat) return null
  const timing = extractTiming(combat.attributes?.labels, combat.attributes?.parameters)
  return {
    name: combat.name,
    description: combat.description,
    cooldown: timing.cooldown,
    energyCost: timing.energyCost,
    duration: timing.duration,
    attributes: timing.attributes,
    parameters: combat.attributes?.parameters ?? {},
    labels: combat.attributes?.labels ?? [],
  }
}

function characterForTalent(talentName) {
  const travelerMatch = talentName.match(/^Traveler \((.+)\)$/)
  if (travelerMatch) {
    const base = genshindb.characters('Aether')
    return {
      name: talentName,
      elementText: travelerMatch[1],
      weaponText: base?.weaponText ?? 'Sword',
      rarity: 5,
      constellation: base?.constellation ?? 'Viator',
      images: base?.images ?? {},
      version: base?.version,
    }
  }
  return genshindb.characters(talentName)
}

const talentNames = genshindb.talents('names', { matchCategories: true })
const characters = []

for (const talentName of talentNames) {
  const talent = genshindb.talents(talentName)
  const char = characterForTalent(talentName)
  if (!talent || !char) continue

  const cons = genshindb.constellations(talentName) || genshindb.constellations(char.name)
  const constellations = []
  if (cons) {
    for (const key of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
      const c = cons[key]
      if (c) {
        constellations.push({
          level: Number(key.slice(1)),
          name: c.name,
          description: c.description,
        })
      }
    }
  }

  const travelerMatch = talentName.match(/^Traveler \((.+)\)$/)
  const iconFile = travelerMatch
    ? 'UI_AvatarIcon_PlayerBoy'
    : char.images?.filename_icon
  const sideFile = travelerMatch
    ? 'UI_AvatarIcon_Side_PlayerBoy'
    : char.images?.filename_sideIcon

  characters.push({
    id: slugify(talentName),
    name: talentName,
    element: char.elementText,
    weapon: char.weaponText,
    rarity: char.rarity,
    constellationName: char.constellation,
    version: char.version ?? talent.version ?? null,
    iconFile: iconFile || null,
    icon: iconFile ? `https://enka.network/ui/${iconFile}.png` : null,
    sideIcon: sideFile ? `https://enka.network/ui/${sideFile}.png` : null,
    kit: {
      normalAttack: skillFromCombat(talent.combat1),
      elementalSkill: skillFromCombat(talent.combat2),
      elementalBurst: skillFromCombat(talent.combat3),
      passives: [talent.passive1, talent.passive2, talent.passive3]
        .filter(Boolean)
        .map((p) => ({ name: p.name, description: p.description })),
      constellations,
    },
  })
}

characters.sort((a, b) => a.name.localeCompare(b.name))

const payload = {
  source: 'genshin-db',
  extractedAt: new Date().toISOString(),
  talentLevelForScalars: TALENT_LEVEL,
  count: characters.length,
  characters,
}

fs.writeFileSync(OUT, JSON.stringify(payload))
console.log(`Wrote ${characters.length} characters → ${OUT}`)
console.log(`Size: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`)
