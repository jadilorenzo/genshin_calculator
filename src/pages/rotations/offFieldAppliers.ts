/**
 * Off-field aura appliers — companions / DoTs / fields that keep applying
 * element while another character is on-field (Columbina Ripple, Oz, Guoba, …).
 *
 * Intervals are from gcsim where available; durations prefer kit attributes.
 */
import { getCombatCharacter } from './combatMechanicsData'
import { getCharacter } from './characters'
import type { ElementApp } from './combatMechanics'

export type OffFieldSource = 'skill' | 'burst'

export type OffFieldApplierDef = {
  id: string
  label: string
  source: OffFieldSource
  element: string
  /** Fallback gauge if elementApps match is missing. */
  gaugeUnits: number
  intervalSeconds: number
  /** Kit attribute name substring used to resolve duration (unit s). */
  durationAttr?: string
  /** Fallback duration when kit attr is missing. */
  durationSeconds: number
  /** Delay from cast to first tick (defaults to intervalSeconds). */
  firstTickDelaySeconds?: number
  /** Match combatMechanics elementApps.abil for ICD / gauge. */
  abilMatch?: RegExp
  icdTag?: string
  icdGroup?: string
  note?: string
}

export type ResolvedOffFieldApplier = OffFieldApplierDef & {
  characterId: string
  resolvedDuration: number
  resolvedGauge: number
  resolvedIcdTag: string
  resolvedIcdGroup: string
  abil: string | null
  attackTag: string | null
}

/**
 * Curated timer-based off-field appliers (gcsim tick rates).
 * Coordinated attackers (Xingqiu / Yelan wave) are not pure timers — omitted for now.
 */
export const OFF_FIELD_APPLIER_CATALOG: Record<string, OffFieldApplierDef[]> = {
  lauma: [
    {
      id: 'frostgrove-sanctuary',
      label: 'Frostgrove Sanctuary',
      source: 'skill',
      element: 'Dendro',
      gaugeUnits: 1,
      intervalSeconds: 2,
      firstTickDelaySeconds: 2,
      durationAttr: 'Frostgrove Sanctuary Duration',
      durationSeconds: 15,
      abilMatch: /^Frostgrove Sanctuary$/i,
      icdTag: 'None',
      note: 'Sanctuary AoE Dendro every 2s for 15s (Tap or Hold skill)',
    },
  ],
  sucrose: [
    {
      id: 'isomer-field',
      label: 'Forbidden Creation — Isomer 75/Type II',
      source: 'burst',
      element: 'Anemo',
      gaugeUnits: 1,
      // gcsim: first tick 137f, then every 113f; duration 360f (6s) / 480f C2
      intervalSeconds: 113 / 60,
      firstTickDelaySeconds: 137 / 60,
      durationAttr: 'Duration',
      durationSeconds: 6,
      abilMatch: /Forbidden Creation-Isomer 75\/Type II$/i,
      icdTag: 'None',
      note: 'Burst DoT only — skill is a single hit, not an off-field applier',
    },
  ],
  columbina: [
    {
      id: 'gravity-ripple',
      label: 'Gravity Ripple',
      source: 'skill',
      element: 'Hydro',
      gaugeUnits: 1,
      intervalSeconds: 117 / 60,
      durationAttr: 'Gravity Ripple Duration',
      durationSeconds: 25,
      abilMatch: /Skill \(DoT\)/i,
      icdTag: 'None',
      note: 'gcsim skillTick every 117f',
    },
  ],
  fischl: [
    {
      id: 'oz',
      label: 'Oz',
      source: 'skill',
      element: 'Electro',
      gaugeUnits: 1,
      intervalSeconds: 59 / 60,
      firstTickDelaySeconds: 1,
      durationAttr: "Oz's Duration",
      durationSeconds: 10,
      abilMatch: /^Oz/i,
      note: 'gcsim ozTickInterval 59f',
    },
  ],
  xiangling: [
    {
      id: 'guoba',
      label: 'Guoba',
      source: 'skill',
      element: 'Pyro',
      gaugeUnits: 1,
      intervalSeconds: 100 / 60,
      firstTickDelaySeconds: 113 / 60,
      durationSeconds: 438 / 60,
      abilMatch: /Guoba/i,
      icdTag: 'None',
      note: 'gcsim guoba pew every 100f',
    },
  ],
  'yae-miko': [
    {
      id: 'sesshou-sakura',
      label: 'Sesshou Sakura',
      source: 'skill',
      element: 'Electro',
      gaugeUnits: 1,
      intervalSeconds: 176 / 60,
      durationAttr: 'Duration',
      durationSeconds: 14,
      abilMatch: /Sesshou Sakura/i,
      note: 'gcsim kitsuneTick 176f (per totem; approx one cadence)',
    },
  ],
  zhongli: [
    {
      id: 'stone-stele',
      label: 'Stone Stele Resonance',
      source: 'skill',
      element: 'Geo',
      gaugeUnits: 1,
      intervalSeconds: 2,
      durationSeconds: 30,
      abilMatch: /Stone Stele/i,
      note: 'gcsim resonance every 120f',
    },
  ],
  mona: [
    {
      id: 'mirror-doom',
      label: 'Mirror Reflection of Doom',
      source: 'skill',
      element: 'Hydro',
      gaugeUnits: 1,
      intervalSeconds: 59 / 60,
      durationSeconds: 5,
      abilMatch: /Mirror Reflection|Tick/i,
      note: 'gcsim skill ticks every 59f for ~5s',
    },
  ],
  lisa: [
    {
      id: 'lightning-rose',
      label: 'Lightning Rose',
      source: 'burst',
      element: 'Electro',
      gaugeUnits: 1,
      intervalSeconds: 0.5,
      durationAttr: 'Duration',
      durationSeconds: 15,
      abilMatch: /Lightning Rose/i,
      note: 'gcsim burst tick every 30f',
    },
  ],
  rosaria: [
    {
      id: 'rites-dot',
      label: 'Rites of Termination (DoT)',
      source: 'burst',
      element: 'Cryo',
      gaugeUnits: 1,
      intervalSeconds: 2,
      durationAttr: 'Duration',
      durationSeconds: 8,
      abilMatch: /Rites of Termination \(DoT\)/i,
      icdTag: 'None',
      note: 'gcsim DoT every 120f',
    },
  ],
  shenhe: [
    {
      id: 'divine-maiden-dot',
      label: "Divine Maiden's Deliverance (DoT)",
      source: 'burst',
      element: 'Cryo',
      gaugeUnits: 1,
      intervalSeconds: 18 / 60,
      durationAttr: 'Duration',
      durationSeconds: 12,
      abilMatch: /Divine Maiden.*DoT/i,
      note: 'gcsim burst DoT every 18f',
    },
  ],
  ineffa: [
    {
      id: 'birgitta',
      label: 'Birgitta',
      source: 'skill',
      element: 'Electro',
      gaugeUnits: 1,
      intervalSeconds: 119 / 60,
      firstTickDelaySeconds: 42 / 60,
      durationAttr: 'Birgitta Duration',
      durationSeconds: 20,
      abilMatch: /^Birgitta$/i,
      icdTag: 'None',
      note: 'gcsim birgittaDischarge every 119f',
    },
  ],
  furina: [
    {
      id: 'salon-members',
      label: 'Salon Members',
      source: 'skill',
      element: 'Hydro',
      gaugeUnits: 1,
      intervalSeconds: 2,
      firstTickDelaySeconds: 72 / 60,
      durationAttr: 'Duration',
      durationSeconds: 30,
      abilMatch: /Salon|Chevalmarin|Usher|Crabaletta|Singer/i,
      note: 'Approx salon tick cadence (~2s); real intervals vary per member',
    },
  ],
  dehya: [
    {
      id: 'fieldextension-dot',
      label: 'Molten Inferno (DoT)',
      source: 'skill',
      element: 'Pyro',
      gaugeUnits: 1,
      intervalSeconds: 2.5,
      durationSeconds: 12,
      abilMatch: /skillDoTAbil|DoT/i,
      note: 'Approx Dehya field DoT',
    },
  ],
  xinyan: [
    {
      id: 'sweeping-fervor',
      label: 'Sweeping Fervor (DoT)',
      source: 'skill',
      element: 'Pyro',
      gaugeUnits: 1,
      intervalSeconds: 2,
      durationAttr: 'Duration',
      durationSeconds: 12,
      abilMatch: /Sweeping Fervor \(DoT\)/i,
      icdTag: 'None',
    },
    {
      id: 'riff-revolution-dot',
      label: 'Riff Revolution (DoT)',
      source: 'burst',
      element: 'Pyro',
      gaugeUnits: 1,
      intervalSeconds: 2,
      durationAttr: 'Duration',
      durationSeconds: 2,
      abilMatch: /Riff Revolution \(DoT\)/i,
    },
  ],
  skirk: [
    {
      id: 'havoc-ruin-dot',
      label: 'Havoc: Ruin (DoT)',
      source: 'burst',
      element: 'Cryo',
      gaugeUnits: 1,
      intervalSeconds: 1.5,
      durationAttr: 'Duration',
      durationSeconds: 10,
      abilMatch: /Havoc: Ruin \(DoT\)/i,
    },
  ],
  citlali: [
    {
      id: 'itzpapa-frostfall',
      label: 'Itzpapa Frostfall Storm',
      source: 'skill',
      element: 'Cryo',
      gaugeUnits: 1,
      // Attacks every 1s; 1.5s ICD → Cryo gauge about every 2s (ICD applied in sim).
      intervalSeconds: 1,
      firstTickDelaySeconds: 1,
      // Kit lists 20s follow time; with EQ, Opal Fire Cryo uptime is ~12–13s.
      durationSeconds: 12,
      abilMatch: /frostFallAbil|Frostfall/i,
      icdTag: 'CitlaliFrostfallStorm',
      icdGroup: 'CitlaliFrostfallStorm',
      note: 'KQM: Opal Fire every 1s, ICD 1.5s → app ~every 2s; ~12s with EQ',
    },
  ],
  mavuika: [
    {
      id: 'ring-of-searing-radiance',
      label: 'Ring of Searing Radiance',
      source: 'skill',
      element: 'Pyro',
      gaugeUnits: 1,
      intervalSeconds: 2,
      firstTickDelaySeconds: 2,
      durationSeconds: 12,
      abilMatch: /^Rings of Searing Radiance$/i,
      icdTag: 'None',
      note: 'Tap skill ring: 2s interval, ~12s / 6 hits at C0 (80 NS); 1U no ICD',
    },
  ],
  escoffier: [
    {
      id: 'frosty-parfait',
      label: 'Frosty Parfait',
      source: 'skill',
      element: 'Cryo',
      gaugeUnits: 1,
      intervalSeconds: 1,
      firstTickDelaySeconds: 1,
      durationAttr: 'Cold Storage Mode Duration',
      durationSeconds: 20,
      abilMatch: /^Frosty Parfait$/i,
      note: 'Cooking Mek Cold Storage Mode — Frosty Parfaits ~1s',
    },
  ],
  'kuki-shinobu': [
    {
      id: 'grass-ring',
      label: 'Grass Ring of Sanctification',
      source: 'skill',
      element: 'Electro',
      gaugeUnits: 1,
      intervalSeconds: 1.5,
      firstTickDelaySeconds: 1.5,
      durationAttr: 'Duration',
      durationSeconds: 12,
      abilMatch: /Grass Ring of Sanctification/i,
      note: 'Ring ticks every 1.5s for 12s',
    },
  ],
}

/** Abil patterns that look like repeating off-field / field DoT appliers. */
const AUTO_OFF_FIELD_ABIL =
  /(DoT|Tick|Frostgrove Sanctuary|^Oz|Guoba|Birgitta|Ripple|Salon|Isomer|Sesshou|Lightning Rose|Rites of Termination \(DoT\)|Divine Maiden.*DoT|Havoc: Ruin \(DoT\)|Sweeping Fervor \(DoT\)|Riff Revolution \(DoT\)|Stone Stele \(Tick\)|skillDoTAbil|Rings of Searing Radiance|frostFallAbil|Frosty Parfait|Grass Ring of Sanctification)/i

function inferIntervalSeconds(abil: string): number {
  const a = abil.toLowerCase()
  if (a.includes('frostgrove')) return 2
  if (a.includes('oz') || a.includes('birgitta')) return 1
  if (a.includes('guoba')) return 100 / 60
  if (a.includes('ripple')) return 117 / 60
  if (a.includes('isomer')) return 113 / 60
  if (a.includes('sesshou')) return 176 / 60
  if (a.includes('lightning rose')) return 0.5
  if (a.includes('divine maiden')) return 18 / 60
  if (a.includes('stele')) return 2
  if (a.includes('salon')) return 2
  if (a.includes('dehya') || a.includes('skilldot')) return 2.5
  if (a.includes('searing radiance') || a.includes('rings of searing')) return 2
  if (a.includes('frostfall') || a.includes('frosty parfait')) return 1
  if (a.includes('grass ring')) return 1.5
  return 2
}

function inferDurationSeconds(
  characterId: string,
  abil: string,
  source: OffFieldSource,
): number {
  const combat = getCombatCharacter(characterId)
  const hints = combat?.kitHints?.durations ?? []
  const prefer =
    source === 'burst'
      ? hints.filter((d) => /burst/i.test(d.source))
      : hints.filter((d) => /skill|art/i.test(d.source))
  const pool = prefer.length ? prefer : hints
  const named = pool.find((d) =>
    /duration|oz|guoba|frostgrove|sanctuary|field|salon|isomer|stele|rose|ruin|fervor/i.test(
      d.name,
    ),
  )
  if (named?.seconds && named.seconds > 0) return named.seconds
  const a = abil.toLowerCase()
  if (a.includes('frostgrove')) return 15
  if (a.includes('oz')) return 10
  if (a.includes('ripple')) return 25
  if (a.includes('isomer')) return 6
  if (a.includes('birgitta')) return 20
  if (a.includes('salon')) return 30
  if (a.includes('sesshou')) return 14
  if (a.includes('lightning rose')) return 15
  if (a.includes('rites')) return 8
  if (a.includes('maiden')) return 12
  if (a.includes('stele')) return 30
  if (a.includes('guoba')) return 7
  if (a.includes('searing radiance') || a.includes('rings of searing')) return 12
  if (a.includes('frostfall')) return 12
  if (a.includes('frosty parfait')) return 20
  if (a.includes('grass ring')) return 12
  return 12
}

function inferSource(app: ElementApp): OffFieldSource {
  if (app.sourceFile === 'burst.go' || /burst/i.test(app.attackTag ?? '')) {
    return 'burst'
  }
  return 'skill'
}

function slugId(abil: string): string {
  return abil
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function kitDurationSeconds(
  characterId: string,
  attrName: string | undefined,
  fallback: number,
): number {
  if (!attrName) return fallback
  const character = getCharacter(characterId)
  if (!character?.kit) return fallback
  for (const skill of [
    character.kit.elementalSkill,
    character.kit.elementalBurst,
  ]) {
    if (!skill?.attributes) continue
    for (const attr of skill.attributes) {
      if (!attr.name) continue
      if (!attr.name.toLowerCase().includes(attrName.toLowerCase())) continue
      const n = typeof attr.raw === 'number' ? attr.raw : Number(attr.raw)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  const combat = getCombatCharacter(characterId)
  const hint = combat?.kitHints?.durations?.find((d) =>
    d.name.toLowerCase().includes(attrName.toLowerCase()),
  )
  if (hint?.seconds && hint.seconds > 0) return hint.seconds
  return fallback
}

/** Auto-derive timer appliers from combatMechanics DoT/Tick-style element apps. */
function autoOffFieldDefs(characterId: string): OffFieldApplierDef[] {
  const character = getCombatCharacter(characterId)
  if (!character?.elementApps?.length) return []

  const seen = new Set<string>()
  const defs: OffFieldApplierDef[] = []
  for (const app of character.elementApps) {
    const abil = app.abil ?? ''
    if (!AUTO_OFF_FIELD_ABIL.test(abil)) continue
    if ((app.gaugeUnits ?? 0) <= 0) continue
    if (!app.element || app.elementDynamic) continue
    // Skip on-field channel holds that aren't persistent fields
    if (/windwheel/i.test(abil)) continue
    // Skip initial-only hits
    if (/\(initial\)|\(summon\)|parfait/i.test(abil) && !/dot|tick/i.test(abil)) {
      continue
    }
    const id = slugId(abil)
    if (seen.has(id)) continue
    seen.add(id)
    const source = inferSource(app)
    defs.push({
      id,
      label: abil,
      source,
      element: app.element,
      gaugeUnits: app.gaugeUnits ?? 1,
      intervalSeconds: inferIntervalSeconds(abil),
      durationSeconds: inferDurationSeconds(characterId, abil, source),
      abilMatch: new RegExp(
        `^${abil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i',
      ),
      icdTag: app.icdTag ?? undefined,
      icdGroup: app.icdGroup ?? undefined,
      note: 'Auto-derived from combatMechanics elementApps',
    })
  }
  return defs
}

function matchElementApp(
  characterId: string,
  def: OffFieldApplierDef,
): ElementApp | null {
  const character = getCombatCharacter(characterId)
  if (!character?.elementApps?.length) return null
  if (def.abilMatch) {
    const hit = character.elementApps.find((a) =>
      def.abilMatch!.test(a.abil ?? ''),
    )
    if (hit) return hit
  }
  // Fallback: source-file DoT for skill/burst
  const file = def.source === 'burst' ? 'burst.go' : 'skill.go'
  return (
    character.elementApps.find(
      (a) =>
        a.sourceFile === file &&
        /dot|tick/i.test(a.abil ?? '') &&
        (a.gaugeUnits ?? 0) > 0,
    ) ?? null
  )
}

function resolveDef(
  characterId: string,
  def: OffFieldApplierDef,
): ResolvedOffFieldApplier {
  const app = matchElementApp(characterId, def)
  const duration = kitDurationSeconds(
    characterId,
    def.durationAttr,
    def.durationSeconds,
  )
  return {
    ...def,
    characterId,
    resolvedDuration: duration,
    resolvedGauge:
      app?.gaugeUnits != null && app.gaugeUnits > 0
        ? app.gaugeUnits
        : def.gaugeUnits,
    resolvedIcdTag: app?.icdTag ?? def.icdTag ?? 'None',
    resolvedIcdGroup: app?.icdGroup ?? def.icdGroup ?? 'Default',
    abil: app?.abil ?? def.label,
    attackTag: app?.attackTag ?? null,
  }
}

/** Resolved off-field appliers for a character (catalog + auto DoT/Tick apps). */
export function listOffFieldAppliers(
  characterId: string,
): ResolvedOffFieldApplier[] {
  const catalog = OFF_FIELD_APPLIER_CATALOG[characterId] ?? []
  const catalogIds = new Set(catalog.map((d) => d.id))
  const catalogAbils = catalog
    .map((d) => d.abilMatch)
    .filter(Boolean) as RegExp[]

  const auto = autoOffFieldDefs(characterId).filter((d) => {
    if (catalogIds.has(d.id)) return false
    // Skip if a catalog entry already covers this ability
    if (catalogAbils.some((re) => re.test(d.label))) return false
    return true
  })

  // Also merge any offFieldAppliers embedded in combatMechanics.json
  const fromJson = (getCombatCharacter(characterId)?.offFieldAppliers ?? [])
    .filter((a) => a.intervalSeconds && a.intervalSeconds > 0 && a.element)
    .map((a) => {
      const def: OffFieldApplierDef = {
        id: a.id,
        label: a.label,
        source: a.source,
        element: a.element!,
        gaugeUnits: a.gaugeUnits ?? 1,
        intervalSeconds: a.intervalSeconds!,
        durationSeconds: a.durationSeconds ?? 12,
        firstTickDelaySeconds: a.firstTickDelaySeconds ?? undefined,
        icdTag: a.icdTag ?? undefined,
        icdGroup: a.icdGroup ?? undefined,
        note: a.note,
      }
      return def
    })
    .filter((d) => !catalogIds.has(d.id) && !auto.some((x) => x.id === d.id))

  return [...catalog, ...auto, ...fromJson].map((def) =>
    resolveDef(characterId, def),
  )
}

export function hasOffFieldAppliers(characterId: string): boolean {
  return listOffFieldAppliers(characterId).length > 0
}
