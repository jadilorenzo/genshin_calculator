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
  // Ineffa / Flins / Columbina (and similar) convert EC → Lunar-Charged
  return characterIds.some(
    (id) => id === 'flins' || id === 'ineffa' || id === 'columbina',
  )
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

  // Direct lunar hits are reaction DMG — never prefer them for aura gauge matching.
  if (tag.includes('directlunar') || tag.includes('direct_lunar')) {
    return 0
  }
  // Shade coordinated phantasm hits are 0U lunar-bloom.
  if (abil.includes('shade') && abil.includes('phantasm')) {
    return 0
  }
  if (abil.includes('c6') && abil.includes('phantasm')) {
    return 0
  }

  if (family === 'na') {
    if (tag === 'normal' || tag.includes('normal')) score += 5
    if (file === 'attack.go') score += 3
  } else if (family === 'ca') {
    if (tag === 'extra' || tag.includes('extra')) score += 5
    if (file === 'charge.go' || file === 'aimed.go') score += 3
    if (abil.includes('phantasm') && aid.includes('phantasm')) {
      score += 10
      // Prefer numbered Nefer self-hits over vague "Charge Attack"
      if (/nefer\s*[12]/.test(abil)) score += 4
    }
    if (abil.includes('moondew') && aid.includes('moondew')) score += 8
    if (abil === 'charge attack' && aid.includes('phantasm')) score -= 4
  } else if (family === 'skill') {
    if (tag.includes('elementalart') || tag.includes('art')) score += 5
    if (file === 'skill.go') score += 3
    if (/hold/i.test(abil) && /hold/i.test(aid)) score += 2
  } else if (family === 'burst') {
    if (tag.includes('burst')) score += 5
    if (file === 'burst.go') score += 3
  }

  // Prefer apps that actually apply gauge
  if ((app.gaugeUnits ?? 0) > 0) score += 3
  // Prefer non-dynamic elements
  if (app.element && !app.elementDynamic) score += 1
  // On-field cast matching should not pick Skill (DoT) / burst ticks
  if (/dot|tick|frostgrove|oz\b|guoba|birgitta|ripple|salon|isomer|sesshou/i.test(abil) && !/dot|tick|offfield/i.test(aid)) {
    score -= 6
  }

  return score
}

/**
 * Gauge-applying Phantasm Performance hits (Nefer self 1/2), excluding shades / C6 extras.
 */
export function listPhantasmGaugeApps(characterId: string): ElementApp[] {
  const character = getCombatCharacter(characterId)
  if (!character?.elementApps?.length) return []
  return character.elementApps
    .filter((a) => {
      const abil = (a.abil || '').toLowerCase()
      const tag = (a.attackTag || '').toLowerCase()
      const file = (a.sourceFile || '').toLowerCase()
      if (!abil.includes('phantasm performance')) return false
      if (file !== 'charge.go') return false
      if (abil.includes('shade') || abil.includes('c6')) return false
      if (tag.includes('directlunar') || tag.includes('direct_lunar')) return false
      return (a.gaugeUnits ?? 0) > 0
    })
    .sort((a, b) => (a.abil || '').localeCompare(b.abil || ''))
}
