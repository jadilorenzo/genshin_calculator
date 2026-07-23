import combatFile from '../../data/combatMechanics.json'
import type {
  CombatCharacterMechanics,
  CombatMechanicsFile,
  ElementApp,
  IcdGroupDef,
} from './combatMechanics'

const data = combatFile as CombatMechanicsFile

export function getCombatMechanicsFile(): CombatMechanicsFile {
  return data
}

export function getCombatCharacter(
  characterId: string,
): CombatCharacterMechanics | null {
  return data.characters[characterId] ?? null
}

export function getIcdGroup(name: string | null | undefined): IcdGroupDef | null {
  if (!name) return null
  return data.globals.icdGroups[name] ?? null
}

export function getVerdantDewGlobals() {
  return data.globals.verdantDew
}

/** Moonsign level from unique party members (sum of contribution, typically 0–2+). */
export function partyMoonsignLevel(characterIds: string[]): number {
  let total = 0
  const seen = new Set<string>()
  for (const id of characterIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const c = getCombatCharacter(id)
    total += c?.resources?.moonsignContribution ?? 0
  }
  return total
}

export function partyConvertsElectroCharged(
  characterIds: string[],
): boolean {
  // Flins / Ineffa Moonsign Benediction convert EC → Lunar-Charged
  for (const id of characterIds) {
    const c = getCombatCharacter(id)
    if (!c) continue
    if (
      c.resources?.moonsignContribution &&
      (c.element === 'Electro' || /flins|ineffa/i.test(c.id))
    ) {
      // Heuristic: Electro Moonsign DPS (Flins/Ineffa) convert EC
      if (c.id === 'flins' || c.id === 'ineffa') return true
    }
  }
  return characterIds.some((id) => id === 'flins' || id === 'ineffa')
}

export function partyConvertsBloom(characterIds: string[]): boolean {
  return characterIds.some((id) => id === 'lauma' || id === 'nefer')
}

/**
 * Pick the best ElementApp for a combo action id.
 * Prefers matching attackTag / sourceFile over noisy abil strings.
 */
export function matchElementApp(
  characterId: string,
  actionId: string,
): ElementApp | null {
  const character = getCombatCharacter(characterId)
  if (!character?.elementApps?.length) return null

  const family = actionFamily(actionId)
  const apps = character.elementApps.filter((a) => a.icdTag || a.icdGroup)

  const scored = apps
    .map((app) => ({ app, score: scoreApp(app, family, actionId) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.app ?? null
}

function actionFamily(actionId: string): string {
  const x = actionId.toLowerCase()
  if (x === 'normals' || /^na\d/.test(x) || x.startsWith('na_')) return 'na'
  if (x === 'ca' || x.startsWith('ca_') || x.startsWith('aim')) return 'ca'
  if (x === 'skill' || x.startsWith('skill')) return 'skill'
  if (x === 'burst' || x.startsWith('burst')) return 'burst'
  if (x.includes('phantasm')) return 'ca'
  return 'other'
}

function scoreApp(app: ElementApp, family: string, actionId: string): number {
  let score = 0
  const tag = (app.attackTag || '').toLowerCase()
  const file = (app.sourceFile || '').toLowerCase()
  const abil = (app.abil || '').toLowerCase()
  const aid = actionId.toLowerCase()

  // Direct lunar hits are reaction damage, not normal gauge apps for E/Q/NA
  if (tag.includes('directlunar') || tag.includes('direct_lunar')) {
    if (family === 'ca' && (abil.includes('phantasm') || aid.includes('phantasm'))) {
      score += 6
    } else {
      return 0
    }
  }

  if (family === 'na') {
    if (tag === 'normal' || tag.includes('normal')) score += 5
    if (file === 'attack.go') score += 3
  } else if (family === 'ca') {
    if (tag === 'extra' || tag.includes('extra') || tag.includes('lunar'))
      score += 5
    if (file === 'charge.go' || file === 'aimed.go') score += 3
    if (abil.includes('phantasm') && aid.includes('phantasm')) score += 8
    if (abil.includes('moondew') && aid.includes('moondew')) score += 8
  } else if (family === 'skill') {
    if (tag.includes('elementalart') || tag.includes('art')) score += 5
    if (file === 'skill.go') score += 3
    if (/hold/i.test(abil) && /hold/i.test(aid)) score += 2
  } else if (family === 'burst') {
    if (tag.includes('burst')) score += 5
    if (file === 'burst.go') score += 3
  }

  // Prefer apps that actually apply gauge
  if ((app.gaugeUnits ?? 0) > 0) score += 1
  // Prefer non-dynamic elements
  if (app.element && !app.elementDynamic) score += 1

  return score
}
