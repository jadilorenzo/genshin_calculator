/**
 * Extracts combat-mechanic metadata into src/data/combatMechanics.json
 *
 * Covers (from local gcsim character packages + kit duration hints):
 *   - Element application ICD (tag/group) + durability/gauge per AttackInfo
 *   - Verdant Dew / moon-style team resources (global + Nefer consume frames)
 *   - Nightsoul max points, timed blessing duration, drain rates
 *   - Moonsign contribution, Arkhe flags
 *   - Kit-side duration hints (Nightsoul Point Time Limit, Shadow Dance, etc.)
 *
 *   node scripts/fetchGcsimPrChars.mjs   # optional
 *   node scripts/extractCombatMechanics.mjs
 *
 * Env:
 *   GCSIM_CHARS=/path/to/internal/characters   (default /tmp/gcsim-chars)
 *   GCSIM_ROOT=/path/to/gcsim                  (optional; for verdant dew globals)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const KITS = path.join(ROOT, 'src/data/characterKits.json')
const OUT = path.join(ROOT, 'src/data/combatMechanics.json')
const GCSIM =
  process.env.GCSIM_CHARS ||
  (fs.existsSync('/tmp/gcsim-chars') ? '/tmp/gcsim-chars' : null)
const GCSIM_ROOT =
  process.env.GCSIM_ROOT ||
  (fs.existsSync('/tmp/gcsim-main') ? '/tmp/gcsim-main' : null)

const FPS = 60

/** Our kit ids → gcsim package folder names */
const GCSIM_ALIAS = {
  'arataki-itto': 'itto',
  'hu-tao': 'hutao',
  'kaedehara-kazuha': 'kazuha',
  'kamisato-ayaka': 'ayaka',
  'kamisato-ayato': 'ayato',
  'kujou-sara': 'sara',
  'kuki-shinobu': 'kuki',
  'lan-yan': 'lanyan',
  'raiden-shogun': 'raiden',
  'sangonomiya-kokomi': 'kokomi',
  'shikanoin-heizou': 'heizou',
  'yae-miko': 'yaemiko',
  'yumemizuki-mizuki': 'mizuki',
  'yun-jin': 'yunjin',
  'traveler-anemo': 'traveler/common/anemo',
  'traveler-geo': 'traveler/common/geo',
  'traveler-electro': 'traveler/common/electro',
  'traveler-dendro': 'traveler/common/dendro',
  'traveler-hydro': 'traveler/common/hydro',
  'traveler-pyro': 'traveler/common/pyro',
  'traveler-cryo': 'traveler/common/anemo',
}

/**
 * Known ICD group definitions (KQM TCL / wiki / gcsim conventions).
 * Groups not listed here still appear on attacks; definition may be null.
 */
const ICD_GROUP_DEFS = {
  Default: {
    resetSeconds: 2.5,
    gaugeSequence: [1, 0, 0],
    note: 'Standard 2.5s / 3-hit elemental application ICD',
  },
  None: {
    resetSeconds: null,
    gaugeSequence: null,
    note: 'ICDTagNone — every hit can apply (subject to gauge)',
  },
  Burning: {
    resetSeconds: 2,
    gaugeSequence: [1],
    note: 'Burning DoT-style — first hit only in sequence',
  },
  PoleExtraAttack: {
    resetSeconds: 0.5,
    gaugeSequence: [1],
    note: 'Polearm charged / thrusting style',
  },
}

const KIT_HINT_NAME_RE =
  /nightsoul|verdant\s*dew|shadow\s*dance|moonsign|lunar|arkhe|pneuma|ousia|sourcewater|bond\s*of\s*life|dreamdrifter|windwheel|phantasm|blessing/i

function round(n, digits = 3) {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function framesToSeconds(frames) {
  if (frames == null || !Number.isFinite(frames)) return null
  return round(frames / FPS)
}

function durabilityToGauge(durability) {
  if (durability == null || !Number.isFinite(durability)) return null
  // gcsim Durability 25 ≈ 1U, 50 ≈ 2U
  return round(durability / 25, 2)
}

function stripIdent(name) {
  return String(name || '')
    .replace(/^attacks\./, '')
    .replace(/^attributes\./, '')
    .replace(/^ICD(?:Tag|Group)/, '')
    .replace(/^AttackTag/, '')
    .replace(/^StrikeType/, '')
}

const VALID_ELEMENTS = new Set([
  'Physical',
  'Pyro',
  'Hydro',
  'Dendro',
  'Electro',
  'Anemo',
  'Cryo',
  'Geo',
])

function cleanAbil(raw) {
  if (!raw) return null
  let s = raw.trim()
  const sprintf =
    s.match(/fmt\.Sprintf\(\s*"([^"]+)"/) ||
    s.match(/fmt\.Sprintf\(\s*`([^`]+)`/)
  if (sprintf) {
    s = sprintf[1].replace(/%[.#0-9]*[a-zA-Z]/g, '').trim()
  }
  s = s.replace(/^"|"$/g, '').replace(/^`|`$/g, '')
  if (/^(abil|name|elem|ele|ai|atkTag)$/i.test(s)) return null
  return s || null
}

function cleanElement(raw) {
  if (!raw) return { element: null, elementDynamic: false }
  const stripped = stripIdent(raw).replace(/^attributes\./, '')
  if (VALID_ELEMENTS.has(stripped)) {
    return { element: stripped, elementDynamic: false }
  }
  return { element: null, elementDynamic: true }
}

function walkGoFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return []
  const out = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of fs.readdirSync(cur)) {
      if (name.startsWith('.')) continue
      const full = path.join(cur, name)
      const st = fs.statSync(full)
      if (st.isDirectory()) stack.push(full)
      else if (name.endsWith('.go') && !name.endsWith('_test.go')) out.push(full)
    }
  }
  return out
}

function readPackageSources(pkgDir) {
  return walkGoFiles(pkgDir).map((file) => ({
    file: path.relative(pkgDir, file).replaceAll('\\', '/'),
    src: fs.readFileSync(file, 'utf8'),
  }))
}

function buildConstMap(sources) {
  const map = Object.create(null)
  for (const { src } of sources) {
    for (const m of src.matchAll(
      /(?:const\s*\(|^\s*)([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?(?:\s*\*\s*\d+)?)/gm,
    )) {
      if (map[m[1]] != null) continue
      const raw = m[2].replace(/\s+/g, '')
      if (/^\d+(?:\.\d+)?\*\d+$/.test(raw)) {
        const [a, b] = raw.split('*').map(Number)
        map[m[1]] = a * b
      } else {
        const n = Number(raw)
        if (Number.isFinite(n)) map[m[1]] = n
      }
    }
    // Prefer explicit frame consts like `= 9` and `= 5 * 60`
    for (const m of src.matchAll(
      /\b([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*\*\s*60\b/g,
    )) {
      map[m[1]] = Number(m[2]) * 60
    }
  }
  return map
}

function evalNumericExpr(expr, consts) {
  if (expr == null) return null
  let e = String(expr)
    .replace(/\/\/.*$/, '')
    .trim()
  e = e.replace(/\bint\s*\(/g, '(')
  e = e.replace(/\bc\.[A-Za-z_]\w*\(\)/g, '1')
  e = e.replace(/\b([A-Za-z_]\w*)\b/g, (name) =>
    Object.prototype.hasOwnProperty.call(consts, name)
      ? String(consts[name])
      : name,
  )
  if (/[A-Za-z_]/.test(e)) {
    const frames = e.match(/(\d+(?:\.\d+)?)\s*\*\s*60/)
    if (frames) return Number(frames[1]) * 60
    return null
  }
  if (!/^[\d\s+\-*()./]+$/.test(e)) return null
  try {
    // eslint-disable-next-line no-new-func
    const n = Function(`"use strict"; return (${e})`)()
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** Extract AttackInfo{ ... } / info.AttackInfo{ ... } blocks with ICD fields. */
function extractElementApps(sources, consts) {
  const apps = []
  const seen = new Set()

  for (const { file, src } of sources) {
    const re = /(?:info\.)?AttackInfo\s*\{([\s\S]*?)\n\s*\}/g
    let m
    while ((m = re.exec(src))) {
      const body = m[1]
      if (!/ICDTag\s*:/.test(body) && !/ICDGroup\s*:/.test(body)) continue

      const field = (key) => {
        const fm = body.match(
          new RegExp(`${key}\\s*:\\s*([^,\\n]+)`, 'i'),
        )
        return fm ? fm[1].trim() : null
      }

      const abil = cleanAbil(field('Abil'))
      const icdTag = stripIdent(field('ICDTag') || '') || null
      const icdGroup = stripIdent(field('ICDGroup') || '') || null
      const { element, elementDynamic } = cleanElement(field('Element') || '')
      const attackTag = stripIdent(field('AttackTag') || '') || null
      const durabilityExpr = field('Durability')
      const durability = durabilityExpr
        ? evalNumericExpr(durabilityExpr, consts)
        : null

      if (!icdTag && !icdGroup && !element && !elementDynamic) continue

      const key = [
        abil || '',
        icdTag,
        icdGroup,
        element,
        elementDynamic ? 'dyn' : '',
        durability ?? '',
        file,
      ].join('|')
      if (seen.has(key)) continue
      seen.add(key)

      apps.push({
        abil,
        sourceFile: file,
        attackTag,
        icdTag,
        icdGroup,
        element,
        elementDynamic: elementDynamic || undefined,
        durability: durability != null ? round(durability, 2) : null,
        gaugeUnits: durabilityToGauge(durability),
      })
    }
  }

  apps.sort((a, b) => {
    const ae = a.element || ''
    const be = b.element || ''
    if (ae !== be) return ae.localeCompare(be)
    return String(a.abil || '').localeCompare(String(b.abil || ''))
  })
  return apps
}

function extractNightsoul(sources, consts) {
  const joined = sources.map((s) => s.src).join('\n')
  if (!/nightsoulState|nightsoul\.New|AdditionalTagNightsoul/i.test(joined)) {
    return null
  }

  const maxPoints = []
  for (const m of joined.matchAll(
    /nightsoulState\.MaxPoints\s*=\s*([^;\n]+)/g,
  )) {
    const n = evalNumericExpr(m[1], consts)
    if (n != null) maxPoints.push(n)
  }

  const timedBlessings = []
  for (const m of joined.matchAll(
    /EnterTimedBlessing\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,/g,
  )) {
    const amount = evalNumericExpr(m[1], consts)
    const durationFrames = evalNumericExpr(m[2], consts)
    timedBlessings.push({
      enterPoints: amount,
      durationFrames:
        durationFrames != null ? Math.round(durationFrames) : null,
      durationSeconds: framesToSeconds(durationFrames),
    })
  }

  const drainCalls = []
  for (const m of joined.matchAll(
    /(?:reduceNightsoulPoints|ConsumePoints)\s*\(\s*([^)]+)\)/g,
  )) {
    const amount = evalNumericExpr(m[1], consts)
    if (amount == null) continue
    drainCalls.push(round(amount, 3))
  }

  // Periodic drain inside QueueCharTask / reduce task: e.g. 0.5 every ~6f or 0.8
  const periodic = []
  for (const m of joined.matchAll(
    /reduceNightsoulPoints\((\d+(?:\.\d+)?)\)\s*\n\s*.*nightsoulPointReduceTask/gs,
  )) {
    periodic.push({ amount: Number(m[1]), note: 'recursive reduce task' })
  }
  // Common pattern: ConsumePoints(0.8) or reduceNightsoulPoints(0.5) in a task
  for (const amount of [0.5, 0.8, 1, 1.0]) {
    if (
      drainCalls.includes(amount) &&
      /nightsoulPointReduceTask|QueueCharTask/.test(joined)
    ) {
      if (!periodic.some((p) => p.amount === amount)) {
        periodic.push({
          amount,
          note: 'appears in nightsoul reduce loop (interval char-specific)',
        })
      }
    }
  }

  const uniqueDrains = [...new Set(drainCalls)].sort((a, b) => a - b)

  return {
    maxPoints: maxPoints.length
      ? Math.max(...maxPoints)
      : null,
    maxPointsVariants: maxPoints.length > 1 ? [...new Set(maxPoints)] : undefined,
    timedBlessings: timedBlessings.length ? timedBlessings : undefined,
    pointConsumes: uniqueDrains.length ? uniqueDrains : undefined,
    periodicDrainHints: periodic.length ? periodic : undefined,
  }
}

function extractVerdantDew(sources, consts) {
  const joined = sources.map((s) => s.src).join('\n')
  if (
    !/VerdantDew|verdant.?dew|ConsumeVerdantDew|AddVerdantDew|ConsumeDew\s*\(/i.test(
      joined,
    )
  ) {
    return null
  }

  const consumes = []
  for (const { file, src } of sources) {
    for (const m of src.matchAll(
      /Consume(?:Verdant)?Dew\s*\(\s*(\d+)\s*\)/g,
    )) {
      const before = src.slice(Math.max(0, m.index - 400), m.index)
      const frameMatch =
        before.match(
          /QueueCharTask\s*\([\s\S]*?,\s*([A-Za-z_]\w*|\d+)\s*\)\s*$/,
        ) ||
        before.match(
          /,\s*([A-Za-z_]\w*|phantasmConsumeDewFrame|\d+)\s*\)\s*(?:\/\/[^\n]*)?\s*$/,
        )
      let frame = null
      if (frameMatch) {
        frame = evalNumericExpr(frameMatch[1], consts)
      }
      if (frame == null && /phantasmConsumeDewFrame/.test(before)) {
        frame = consts.phantasmConsumeDewFrame ?? null
      }
      consumes.push({
        amount: Number(m[1]),
        frame: frame != null ? Math.round(frame) : null,
        seconds: framesToSeconds(frame),
        sourceFile: file,
      })
    }
  }

  const rateMods = []
  for (const m of joined.matchAll(
    /AddVerdantDewRateMod\s*\(\s*[^,]+,\s*([^,]+)/g,
  )) {
    rateMods.push({
      durationFrames: evalNumericExpr(m[1], consts),
      note: 'rate modifier while status active',
    })
  }

  return {
    consumes: consumes.length ? consumes : undefined,
    rateMods: rateMods.length ? rateMods : undefined,
    usesTeamVerdantDew: true,
  }
}

function extractFlags(sources) {
  const joined = sources.map((s) => s.src).join('\n')
  const flags = {}

  const moonsign = joined.match(/\.Moonsign\s*=\s*(\d+)/)
  if (moonsign) flags.moonsignContribution = Number(moonsign[1])

  if (/HasArkhe\s*=\s*true/.test(joined)) flags.arkhe = true
  if (/HasArkhe\s*=\s*false/.test(joined)) flags.arkhe = false

  if (/sourcewaterdroplet\.New|GadgetTypSourcewaterDroplet/i.test(joined)) {
    flags.sourcewaterDroplets = true
  }
  if (/BondOfLife|bond.?of.?life/i.test(joined)) flags.bondOfLife = true
  if (
    /dendrocore\.New\b|GadgetTypDendroCore/.test(joined) &&
    /dendrocore\.New\b/.test(joined)
  ) {
    flags.dendroCore = true
  } else if (/GadgetTypDendroCore|OnDendroCore/.test(joined)) {
    flags.dendroCoreInteract = true
  }
  if (/GetMoonsignLevel|ascendantGleam/i.test(joined)) {
    flags.moonsignAware = true
  }
  if (/ConsumeVerdantDew|VerdantDew\(\)|ConsumeDew\(/i.test(joined)) {
    flags.usesVerdantDew = true
  }

  return Object.keys(flags).length ? flags : null
}

function extractKitHints(character) {
  const kit = character.kit
  if (!kit) return null
  const durations = []
  const other = []

  const scanSkill = (skill, source) => {
    if (!skill) return
    for (const attr of skill.attributes || []) {
      const name = String(attr.name || '')
      if (!KIT_HINT_NAME_RE.test(name)) continue
      const entry = {
        name,
        source,
        raw: attr.raw,
        unit: attr.unit,
      }
      if (attr.unit === 's' && typeof attr.raw === 'number') {
        durations.push({ ...entry, seconds: attr.raw })
      } else {
        other.push(entry)
      }
    }
  }

  scanSkill(kit.elementalSkill, 'skill')
  scanSkill(kit.elementalBurst, 'burst')
  scanSkill(kit.normalAttack, 'normalAttack')

  if (!durations.length && !other.length) return null
  return {
    durations: durations.length ? durations : undefined,
    attributes: other.length ? other : undefined,
  }
}

function parseGlobalVerdantDew() {
  const candidates = [
    GCSIM_ROOT &&
      path.join(GCSIM_ROOT, 'pkg/core/player/verdantdew.go'),
    '/tmp/gcsim-main/pkg/core/player/verdantdew.go',
  ].filter(Boolean)

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    const max =
      Number(src.match(/MaxVerdantDew\s*=\s*(\d+)/)?.[1]) || 3
    const partial =
      Number(src.match(/maxPartialDew\s*=\s*(\d+)/)?.[1]) || null
    const window =
      Number(src.match(/verdantDewEndFrame\s*=\s*(\d+)/)?.[1]) || null
    return {
      max,
      partialFramesPerDew: partial,
      secondsPerDew: framesToSeconds(partial),
      generationWindowFrames: window,
      generationWindowSeconds: framesToSeconds(window),
      note: 'Team Verdant Dew ticks while a Lunar-Bloom window is open; Nefer / Lauma / Columbina consume for special CAs or skills',
      sourceFile: 'gcsim pkg/core/player/verdantdew.go',
    }
  }
  return {
    max: 3,
    partialFramesPerDew: 146,
    secondsPerDew: framesToSeconds(146),
    generationWindowFrames: 149,
    generationWindowSeconds: framesToSeconds(149),
    note: 'Fallback constants from known gcsim verdant dew implementation',
  }
}

function collectIcdGroupsUsed(characters) {
  const used = new Set()
  for (const ch of Object.values(characters)) {
    for (const app of ch.elementApps || []) {
      if (app.icdGroup) used.add(app.icdGroup)
    }
  }
  const groups = {}
  for (const name of [...used].sort()) {
    groups[name] = ICD_GROUP_DEFS[name] || {
      resetSeconds: null,
      gaugeSequence: null,
      note: 'Seen in gcsim packages; exact reset/sequence not bundled — check KQM ICD table or gcsim ICDGroup defs',
    }
  }
  // Always include Default + None
  groups.Default = ICD_GROUP_DEFS.Default
  groups.None = ICD_GROUP_DEFS.None
  return groups
}

function extractCharacter(character, pkgRel) {
  const pkgDir = path.join(GCSIM, pkgRel)
  const sources = fs.existsSync(pkgDir) ? readPackageSources(pkgDir) : []
  const consts = buildConstMap(sources)
  const elementApps = sources.length ? extractElementApps(sources, consts) : []
  const nightsoul = sources.length ? extractNightsoul(sources, consts) : null
  const verdantDew = sources.length ? extractVerdantDew(sources, consts) : null
  const flags = sources.length ? extractFlags(sources) : null
  const kitHints = extractKitHints(character)

  let prMeta = null
  const prFile = path.join(pkgDir, '.gcsim-pr-source.json')
  if (fs.existsSync(prFile)) {
    try {
      prMeta = JSON.parse(fs.readFileSync(prFile, 'utf8'))
    } catch {
      prMeta = null
    }
  }

  const resources = {}
  if (nightsoul) {
    // Fill max points from kit when gcsim assignment wasn't a plain number
    if (nightsoul.maxPoints == null && kitHints?.attributes) {
      const lim = kitHints.attributes.find((a) =>
        /Nightsoul Point Limit/i.test(a.name),
      )
      if (lim && typeof lim.raw === 'number') nightsoul.maxPoints = lim.raw
    }
    // Prefer kit time limit when timed blessing duration failed to parse
    if (
      kitHints?.durations &&
      (!nightsoul.timedBlessings?.length ||
        nightsoul.timedBlessings.every((t) => t.durationSeconds == null))
    ) {
      const lim = kitHints.durations.find((d) =>
        /Nightsoul Point Time Limit/i.test(d.name),
      )
      if (lim?.seconds != null) {
        nightsoul.timedBlessings = [
          {
            enterPoints: nightsoul.timedBlessings?.[0]?.enterPoints ?? null,
            durationFrames: Math.round(lim.seconds * FPS),
            durationSeconds: lim.seconds,
            source: 'kit',
          },
        ]
      }
    }
    resources.nightsoul = nightsoul
  }
  if (verdantDew) resources.verdantDew = verdantDew
  if (flags) Object.assign(resources, flags)

  return {
    id: character.id,
    name: character.name,
    element: character.element,
    gcsimPackage: sources.length ? pkgRel : null,
    gcsimPr: prMeta
      ? {
          number: prMeta.number ?? prMeta.pr ?? null,
          repo: prMeta.repo ?? null,
          branch: prMeta.branch ?? null,
        }
      : undefined,
    elementApps,
    resources: Object.keys(resources).length ? resources : undefined,
    kitHints: kitHints || undefined,
  }
}

function main() {
  if (!fs.existsSync(KITS)) {
    console.error('Missing', KITS)
    process.exit(1)
  }
  if (!GCSIM) {
    console.error(
      'No gcsim characters dir. Set GCSIM_CHARS or populate /tmp/gcsim-chars',
    )
    process.exit(1)
  }

  const kits = JSON.parse(fs.readFileSync(KITS, 'utf8'))
  const characters = {}
  let withApps = 0
  let withNs = 0
  let withDew = 0

  for (const c of kits.characters || []) {
    const alias = GCSIM_ALIAS[c.id] || c.id
    const entry = extractCharacter(c, alias)
    characters[c.id] = entry
    if (entry.elementApps?.length) withApps += 1
    if (entry.resources?.nightsoul) withNs += 1
    if (entry.resources?.verdantDew) withDew += 1
  }

  const doc = {
    source: 'gcsim character packages + characterKits duration hints',
    extractedAt: new Date().toISOString(),
    fps: FPS,
    gcsimChars: GCSIM,
    globals: {
      icdGroups: collectIcdGroupsUsed(characters),
      verdantDew: parseGlobalVerdantDew(),
      durabilityNote:
        'gcsim Durability 25 ≈ 1 gauge unit (1U); 50 ≈ 2U. gaugeUnits = durability / 25.',
      meltNote:
        'Melt/vape app rate ≈ hitmarks that pass ICD (icdTag+icdGroup) and apply non-zero gauge. Use elementApps + animation hitmarks together.',
    },
    stats: {
      characters: Object.keys(characters).length,
      withElementApps: withApps,
      withNightsoul: withNs,
      withVerdantDew: withDew,
    },
    characters,
  }

  fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`)
  console.log(
    `Wrote ${OUT} (${doc.stats.characters} chars, ${withApps} with ICD apps, ${withNs} nightsoul, ${withDew} verdant dew)`,
  )
}

main()
