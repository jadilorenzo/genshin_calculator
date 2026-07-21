/**
 * Regenerates src/data/characterAnimationTimings.json
 *
 * Sources:
 *   - Character roster from characterKits.json (NA hit counts from talent labels)
 *   - Optional local gcsim checkout: GCSIM_CHARS=/path/to/internal/characters
 *     (defaults to /tmp/gcsim-chars if present)
 *   - Open gcsim PRs overlaid into that tree (see scripts/fetchGcsimPrChars.mjs);
 *     folders with .gcsim-pr-source.json are tagged gcsim-pr-<number>
 *   - Coarse skill/burst seconds from src/pages/rotations/fieldTimings.ts
 *
 *   node scripts/fetchGcsimPrChars.mjs   # optional: pull open PR packages
 *   node scripts/extractAnimationTimings.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const KITS = path.join(ROOT, 'src/data/characterKits.json')
const OUT = path.join(ROOT, 'src/data/characterAnimationTimings.json')
const FIELD_TIMINGS = path.join(ROOT, 'src/pages/rotations/fieldTimings.ts')
const GCSIM =
  process.env.GCSIM_CHARS ||
  (fs.existsSync('/tmp/gcsim-chars') ? '/tmp/gcsim-chars' : null)

const FPS = 60

/** Our kit ids → gcsim package folder names (relative to GCSIM root) */
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
  'traveler-cryo': 'traveler/common/anemo', // fallback until cryo kit lands in gcsim
}

const CANCEL_KEYS = {
  ActionAttack: 'attack',
  ActionCharge: 'charge',
  ActionSkill: 'skill',
  ActionBurst: 'burst',
  ActionDash: 'dash',
  ActionJump: 'jump',
  ActionWalk: 'walk',
  ActionSwap: 'swap',
  ActionAim: 'aim',
}

function round(n) {
  return Math.round(n * 1000) / 1000
}

function secondsToFrames(sec) {
  if (sec == null || Number.isNaN(Number(sec))) return null
  return Math.round(Number(sec) * FPS)
}

function inferNaCount(character) {
  const attrs = character.kit?.normalAttack?.attributes || []
  const hits = new Set()
  for (const a of attrs) {
    const m = String(a.name || '').match(/^(\d+)-Hit DMG\b/i)
    if (m) hits.add(Number(m[1]))
  }
  if (hits.size) return Math.max(...hits)
  // Bows sometimes only list Aimed Shot
  if (attrs.some((a) => /Aimed Shot/i.test(a.name))) return 1
  return 0
}

function parseFieldTimingsSeconds() {
  if (!fs.existsSync(FIELD_TIMINGS)) return {}
  const src = fs.readFileSync(FIELD_TIMINGS, 'utf8')
  const byId = {}
  // Match blocks like:  mavuika: { ... skillCast: 5.0, ... burstCast: 1.6, ... }
  const re =
    /^\s*(?:'([^']+)'|"([^"]+)"|([a-z0-9-]+))\s*:\s*\{([\s\S]*?)^\s*\},/gm
  let m
  while ((m = re.exec(src))) {
    const id = m[1] || m[2] || m[3]
    if (!id || id === 'DEFAULT_TIMINGS') continue
    const body = m[4]
    const num = (key) => {
      const km = body.match(new RegExp(`${key}\\s*:\\s*([^,\\n]+)`))
      if (!km) return null
      const raw = km[1].trim()
      const asNum = Number(raw)
      if (!Number.isNaN(asNum)) return asNum
      // round(32 / 60)
      const rm = raw.match(/round\(\s*(\d+)\s*\/\s*60\s*\)/)
      if (rm) return Number(rm[1]) / 60
      return null
    }
    byId[id] = {
      skillCast: num('skillCast'),
      skillHoldCast: num('skillHoldCast'),
      burstCast: num('burstCast'),
    }
  }
  return byId
}

function parseIntList(text) {
  if (!text) return []
  return [...text.matchAll(/-?\d+/g)].map((x) => Number(x[0]))
}

function extractGoCompositeBody(src, varName) {
  const re = new RegExp(`${varName}\\s*=\\s*(?:\\[[^\\n{]*?)?\\{`)
  const match = re.exec(src)
  if (!match) return null
  const braceStart = match.index + match[0].length - 1
  let depth = 0
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(braceStart + 1, i)
    }
  }
  return null
}

function parseHitmarkGroups(body) {
  if (!body) return []
  if (body.includes('{')) return parseNestedIntLists(`{${body}}`)
  return parseIntList(body).map((n) => [n])
}

function parseNestedIntLists(text) {
  // [[21], {14, 26}] or {{21}, {14, 26}} Go-style
  const inner = []
  const re = /\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) {
    const nums = parseIntList(m[1])
    if (nums.length) inner.push(nums)
  }
  return inner
}

function extractCancelsAfter(block) {
  const cancels = {}
  const re =
    /\[action\.(Action[A-Za-z]+)\]\s*=\s*(\d+)/g
  let m
  while ((m = re.exec(block))) {
    const key = CANCEL_KEYS[m[1]]
    if (key) cancels[key] = Number(m[2])
  }
  return cancels
}

const STATE_META = {
  attack: { id: 'default', label: 'Default' },
  bikeAttack: { id: 'skill_state', label: 'Flamestrider / skill bike' },
  attackSkill: { id: 'skill_state', label: 'Skill state' },
  skillAttack: { id: 'skill_state', label: 'Skill-state attacks' },
  melee: { id: 'skill_state', label: 'Melee / stance' },
  attackB: { id: 'burst_state', label: 'Burst-state attacks' },
  ppAttack: { id: 'burst_state', label: 'Paramita / burst NA' },
  fieryAttack: { id: 'skill_state', label: 'Fiery / skill-state NA' },
  sharkBite: { id: 'skill_state', label: 'Shark Bite / skill NA' },
  roller: { id: 'skill_state', label: 'Roller / skill-state NA' },
  sword: { id: 'skill_state', label: 'Musou / sword state' },
}

function buildConstMap(src) {
  const map = Object.create(null)
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(-?\d+)\b/g)) {
    // Prefer first assignment; consts usually appear once
    if (map[m[1]] == null) map[m[1]] = Number(m[2])
  }
  return map
}

function evalIntExpr(expr, consts) {
  if (expr == null) return null
  let e = String(expr).trim()
  // Strip trailing comments
  e = e.replace(/\/\/.*$/, '').trim()
  e = e.replace(/\b([A-Za-z_]\w*)\b/g, (name) =>
    Object.prototype.hasOwnProperty.call(consts, name) ? String(consts[name]) : name,
  )
  if (!/^[\d\s+\-*()/]+$/.test(e)) return null
  try {
    // eslint-disable-next-line no-new-func
    return Math.round(Function(`"use strict"; return (${e})`)())
  } catch {
    return null
  }
}

function parseHitmarkGroupsEval(body, consts) {
  if (!body) return []
  if (body.includes('{')) {
    const groups = []
    const re = /\{([^{}]*)\}/g
    let m
    while ((m = re.exec(body))) {
      const parts = m[1].split(',').map((p) => p.trim()).filter(Boolean)
      const nums = parts
        .map((p) => evalIntExpr(p, consts))
        .filter((n) => n != null)
      if (nums.length) groups.push(nums)
    }
    return groups
  }
  return body
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => evalIntExpr(p, consts))
    .filter((n) => n != null)
    .map((n) => [n])
}

function stateMetaForPrefix(prefix) {
  if (STATE_META[prefix]) return STATE_META[prefix]
  if (/burst|ppattack|paramita/i.test(prefix)) {
    return { id: 'burst_state', label: prefix }
  }
  if (/skill|bike|melee|sword|shark|roller|fiery|nightsoul/i.test(prefix)) {
    return { id: 'skill_state', label: prefix }
  }
  if (prefix === 'attack') return STATE_META.attack
  return { id: prefix.replace(/([A-Z])/g, '_$1').toLowerCase(), label: prefix }
}

function parseAttackGo(src) {
  const consts = buildConstMap(src)
  const statesById = new Map()

  // Discover every XxxFrames[i] = frames.InitNormalCancelSlice(..., animLen)
  const prefixes = new Set()
  for (const m of src.matchAll(
    /\b([A-Za-z_]\w*)Frames\s*=\s*make\(\[\]\[\]int/g,
  )) {
    prefixes.add(m[1])
  }
  for (const m of src.matchAll(
    /\b([A-Za-z_]\w*)Frames\[\d+\]\s*=\s*frames\.InitNormalCancelSlice/g,
  )) {
    prefixes.add(m[1])
  }
  if (!prefixes.size) prefixes.add('attack')

  for (const prefix of prefixes) {
    const meta = stateMetaForPrefix(prefix)
    const hitBody =
      extractGoCompositeBody(src, `${prefix}Hitmarks`) ||
      (prefix === 'attack' ? extractGoCompositeBody(src, 'attackHitmarks') : null)
    const hitmarks = parseHitmarkGroupsEval(hitBody, consts)

    // Traveler-style: attackFrames[gender][naIndex]
    const gendered = [
      ...src.matchAll(
        new RegExp(
          `${prefix}Frames\\[(\\d+)\\]\\[(\\d+)\\]\\s*=\\s*frames\\.InitNormalCancelSlice\\(([^,]+),\\s*([^)]+)\\)([\\s\\S]*?)(?=${prefix}Frames\\[\\d+\\]\\[\\d+\\]\\s*=|func |$)`,
          'g',
        ),
      ),
    ]
    if (gendered.length) {
      const byGender = new Map()
      for (const m of gendered) {
        const gender = Number(m[1])
        const i = Number(m[2])
        const frames = evalIntExpr(m[4], consts)
        const cancels = {}
        for (const cm of (m[5] || '').matchAll(
          /\[action\.(Action[A-Za-z]+)\]\s*=\s*([^/\n]+)/g,
        )) {
          const key = CANCEL_KEYS[cm[1]]
          if (!key) continue
          const ev = evalIntExpr(cm[2], consts)
          if (ev != null) cancels[key] = ev
        }
        const genderHitmarks = hitmarks[gender] || hitmarks[i] || []
        // For traveler, hitmarks are [gender][na] flat in rows
        let marks = []
        if (Array.isArray(hitmarks[gender]) && !Array.isArray(hitmarks[gender][0])) {
          // row is list of per-NA marks: {{13,13,16,30,25},{...}} parsed as groups
          marks = hitmarks[gender]?.[i] != null ? [hitmarks[gender][i]] : []
        } else if (hitmarks[gender]?.[i]) {
          marks = hitmarks[gender][i]
        } else if (typeof hitmarks[gender]?.[i] === 'number') {
          marks = [hitmarks[gender][i]]
        }
        // parseHitmarkGroupsEval on {{13,13,16,30,25},{16,...}} gives [[13,13,16,30,25],[16,...]]
        if (hitmarks[gender] && typeof hitmarks[gender][i] === 'number') {
          marks = [hitmarks[gender][i]]
        } else if (Array.isArray(hitmarks[gender])) {
          const row = hitmarks[gender]
          marks = row[i] != null ? [row[i]] : []
        }

        const stateId = gender === 0 ? meta.id : `${meta.id}_lumine`
        const stateLabel =
          gender === 0
            ? `${meta.label} (Aether)`
            : `${meta.label} (Lumine)`
        if (!byGender.has(stateId)) {
          byGender.set(stateId, {
            id: stateId === 'default' ? 'default' : stateId,
            label: stateLabel,
            actions: [],
          })
        }
        byGender.get(stateId).actions[i] = {
          id: `na${i + 1}`,
          label: `Normal Attack ${i + 1}`,
          kind: `na${i + 1}`,
          frames,
          seconds: frames != null ? round(frames / FPS) : null,
          hitmarks: marks,
          cancels,
          source: frames != null ? 'gcsim' : null,
          gcsimVar: `${prefix}Frames[${gender}][${i}]`,
        }
      }
      for (const st of byGender.values()) {
        st.actions = st.actions.filter(Boolean)
        if (!statesById.has(st.id)) statesById.set(st.id, st)
        else {
          for (const action of st.actions) {
            const existing = statesById.get(st.id).actions.find((a) => a.id === action.id)
            if (!existing) statesById.get(st.id).actions.push(action)
            else if (existing.frames == null) Object.assign(existing, action)
          }
        }
      }
      continue
    }

    const makeHitNum = src.match(
      new RegExp(`${prefix}Frames\\s*=\\s*make\\(\\[\\]\\[\\]int,\\s*([^)]+)\\)`),
    )
    let hitNum = makeHitNum ? evalIntExpr(makeHitNum[1], consts) : null
    if (!hitNum) {
      const namedHit =
        src.match(new RegExp(`${prefix}HitNum\\s*=\\s*(\\d+)`)) ||
        (prefix === 'attack' && src.match(/normalHitNum\s*=\s*(\d+)/)) ||
        (prefix === 'bikeAttack' && src.match(/bikeHitNum\s*=\s*(\d+)/)) ||
        (prefix === 'skillAttack' && src.match(/skillHitNum\s*=\s*(\d+)/)) ||
        (prefix === 'attackB' && src.match(/burstHitNum\s*=\s*(\d+)/))
      hitNum = namedHit ? Number(namedHit[1]) : null
    }
    if (!hitNum) {
      const idxs = [
        ...src.matchAll(new RegExp(`${prefix}Frames\\[(\\d+)\\]`, 'g')),
      ].map((x) => Number(x[1]) + 1)
      hitNum = idxs.length ? Math.max(...idxs) : 0
    }

    const actions = []
    for (let i = 0; i < hitNum; i++) {
      const slice = src.match(
        new RegExp(
          `${prefix}Frames\\[${i}\\]\\s*=\\s*frames\\.InitNormalCancelSlice\\(([^,]+),\\s*([^)]+)\\)([\\s\\S]*?)(?=${prefix}Frames\\[\\d+\\]\\s*=|func |$)`,
        ),
      )
      const frames = slice ? evalIntExpr(slice[2], consts) : null
      const cancelsRaw = slice ? extractCancelsAfter(slice[3] || '') : {}
      const cancels = {}
      for (const [k, v] of Object.entries(cancelsRaw)) {
        const ev = typeof v === 'number' ? v : evalIntExpr(String(v), consts)
        if (ev != null) cancels[k] = ev
      }
      // Also evaluate cancel lines with windup: = 10 + windup
      if (slice?.[3]) {
        for (const cm of slice[3].matchAll(
          /\[action\.(Action[A-Za-z]+)\]\s*=\s*([^/\n]+)/g,
        )) {
          const key = CANCEL_KEYS[cm[1]]
          if (!key) continue
          const ev = evalIntExpr(cm[2], consts)
          if (ev != null) cancels[key] = ev
        }
      }

      let marks = hitmarks[i] || []
      // Flat hitmarks sometimes used with InitNormalCancelSlice(hitmarks[i], ...)
      if (!marks.length && slice?.[1]) {
        const hm = evalIntExpr(
          slice[1].replace(new RegExp(`${prefix}Hitmarks\\[\\d+\\](?:\\[\\d+\\])?`), (s) => {
            const idx = [...s.matchAll(/\d+/g)].map(Number)
            if (hitmarks[idx[0]]) {
              return String(hitmarks[idx[0]][idx[1] ?? 0] ?? hitmarks[idx[0]][0])
            }
            return s
          }),
          consts,
        )
        // simpler: if first arg is just an expression with consts
        const direct = evalIntExpr(slice[1], consts)
        if (direct != null) marks = [direct]
        void hm
      }

      actions.push({
        id: `na${i + 1}`,
        label:
          meta.id === 'default'
            ? `Normal Attack ${i + 1}`
            : `${meta.label} NA ${i + 1}`,
        kind: `na${i + 1}`,
        frames,
        seconds: frames != null ? round(frames / FPS) : null,
        hitmarks: marks,
        cancels,
        source: frames != null ? 'gcsim' : null,
        gcsimVar: `${prefix}Frames[${i}]`,
      })
    }

    if (!actions.length) continue

    if (!statesById.has(meta.id)) {
      statesById.set(meta.id, {
        id: meta.id,
        label: meta.label,
        actions: [],
      })
    }
    const state = statesById.get(meta.id)
    // Prefer first prefix's NAs; merge additional if ids missing
    for (const action of actions) {
      const existing = state.actions.find((a) => a.id === action.id)
      if (!existing) state.actions.push(action)
      else if (existing.frames == null && action.frames != null) {
        Object.assign(existing, action)
      }
    }
  }

  return [...statesById.values()]
}

/**
 * Alternate charged routes that aren't a simple chargeFrames slice
 * (e.g. Nefer Phantasm Performance).
 */
function parseSpecialChargedAttacks(src) {
  if (!src) return []
  const actions = []

  const phantasmLen = src.match(
    /phantasmAnimationLength\s*=\s*(\d+)/,
  )
  const windup = src.match(/basicChargeWindup\s*=\s*(\d+)/)
  if (phantasmLen) {
    const windupFrames = windup ? Number(windup[1]) : 0
    const anim = Number(phantasmLen[1])
    const frames = windupFrames + anim
    const hitmarks = []
    for (const m of src.matchAll(/phantasmHit(\d+)\s*=\s*(\d+)/g)) {
      hitmarks.push(windupFrames + Number(m[2]))
    }
    hitmarks.sort((a, b) => a - b)
    const cancels = {}
    const postAtk = src.match(/phantasmPostAttackCancel\s*=\s*(\d+)/)
    const postCa = src.match(/phantasmPostChargeCancel\s*=\s*(\d+)/)
    if (postAtk) cancels.attack = windupFrames + Number(postAtk[1])
    if (postCa) cancels.charge = windupFrames + Number(postCa[1])
    actions.push({
      id: 'ca_phantasm',
      label: 'Charged Attack (Phantasm)',
      kind: 'ca',
      frames,
      seconds: Math.round((frames / FPS) * 1000) / 1000,
      hitmarks,
      cancels,
      source: 'gcsim',
      notes: 'Phantasm Performance special CA (Verdant Dew)',
      gcsimVar: 'phantasmAnimationLength',
      stateHint: 'default',
    })
  }

  return actions
}

function parseAbilFile(src, options) {
  const {
    varPrefix,
    actionId,
    label,
    kind,
    stateId = 'default',
  } = options
  const actions = []

  // Single slice: fooFrames = frames.InitAbilSlice(42)
  const single = [
    ...src.matchAll(
      new RegExp(
        `${varPrefix}(?:Frames)?(?:Hold|Press|Aim)?\\s*=\\s*frames\\.InitAbilSlice\\((\\d+)\\)([\\s\\S]*?)(?=\\n\\t(?:[a-zA-Z].*Frames|const |var |func )|\\n\\})`,
        'g',
      ),
    ),
  ]

  // Also catch skillFramesHold etc. more explicitly
  const named = [
    ...src.matchAll(
      /(\w*Frames\w*)\s*=\s*frames\.InitAbilSlice\((\d+)\)([\s\S]*?)(?=\n\t\w|\n\}|\nfunc )/g,
    ),
  ]

  // Named index: chargeFrames[SaichiSlash] = InitAbilSlice(131)
  const namedIndex = [
    ...src.matchAll(
      /(\w+Frames)\[(\w+)\]\s*=\s*frames\.InitAbilSlice\((\d+)\)([\s\S]*?)(?=\1\[|\nfunc |\n\})/g,
    ),
  ]

  const entries = []
  for (const m of named) {
    entries.push({
      varName: m[1],
      frames: Number(m[2]),
      cancelBlock: m[3] || '',
      indexName: null,
    })
  }
  for (const m of namedIndex) {
    entries.push({
      varName: `${m[1]}_${m[2]}`,
      frames: Number(m[3]),
      cancelBlock: m[4] || '',
      indexName: m[2],
      baseVar: m[1],
    })
  }

  const seen = new Set()
  for (const entry of entries) {
    const { varName, frames, cancelBlock, indexName } = entry
    if (seen.has(varName)) continue
    const lower = varName.toLowerCase()
    const family = varPrefix.toLowerCase()
    if (family === 'charge' && !/charge/i.test(varName)) continue
    if (family === 'burst' && !/burst/i.test(varName)) continue
    if (family === 'skill' && !/skill/i.test(varName)) continue
    if (family === 'dash' && !/dash/i.test(varName)) continue
    if (family === 'plunge' && !/plunge/i.test(varName)) continue
    if ((family === 'aim' || family === 'aimed') && !/aim/i.test(varName)) continue
    if (family === 'jump' && !/jump/i.test(varName)) continue
    if (
      !lower.includes(family) &&
      !['charge', 'burst', 'skill', 'dash', 'plunge', 'aim', 'aimed', 'jump'].includes(
        family,
      )
    ) {
      continue
    }

    seen.add(varName)
    const cancels = extractCancelsAfter(cancelBlock)
    let id = actionId
    let actionLabel = label
    let actionKind = kind
    let state = stateId

    if (indexName && !/^\d+$/.test(indexName)) {
      id = `${actionId}_${indexName.toLowerCase()}`
      actionLabel = `${label} (${indexName})`
      actionKind = `${kind}_${indexName.toLowerCase()}`
    } else if (indexName && /^\d+$/.test(indexName) && /aim/i.test(varName + family)) {
      const n = Number(indexName)
      if (n === 0) {
        id = 'aim'
        actionLabel = 'Aimed Shot'
        actionKind = 'aim'
      } else if (n === 1) {
        id = 'aim_charged'
        actionLabel = 'Aimed Shot (Charged)'
        actionKind = 'aim_charged'
      } else {
        id = 'aim_fully_charged'
        actionLabel = 'Aimed Shot (Fully Charged)'
        actionKind = 'aim_fully_charged'
      }
    } else if (/hold/i.test(varName)) {
      id = `${actionId}_hold`
      actionLabel = `${label} (Hold)`
      actionKind = `${kind}_hold`
    } else if (/bike|skillstate|nightsoul/i.test(varName)) {
      state = 'skill_state'
      id = `${actionId}_${varName.replace(/Frames$/i, '').toLowerCase()}`
      actionLabel = `${label} (${varName})`
    } else if (/final/i.test(varName)) {
      id = `${actionId}_final`
      actionLabel = `${label} Final`
      actionKind = `${kind}_final`
    } else if (/low/i.test(varName)) {
      id = 'plunge_low'
      actionLabel = 'Low Plunge'
      actionKind = 'plunge_low'
    } else if (/high/i.test(varName)) {
      id = 'plunge_high'
      actionLabel = 'High Plunge'
      actionKind = 'plunge_high'
    } else if (varName !== `${varPrefix}Frames` && varName !== `${family}Frames`) {
      id = `${actionId}_${varName.replace(/Frames$/i, '').toLowerCase()}`
      actionLabel = `${label} (${varName.replace(/Frames$/i, '')})`
    }

    actions.push({
      id,
      label: actionLabel,
      kind: actionKind,
      frames,
      seconds: round(frames / FPS),
      hitmarks: [],
      cancels,
      source: 'gcsim',
      stateHint: state,
      gcsimVar: varName,
    })
  }

  // Indexed skillFrames[0] = InitAbilSlice
  const indexed = [
    ...src.matchAll(
      /(\w+Frames)\[(\d+)\]\s*=\s*frames\.InitAbilSlice\((\d+)\)([\s\S]*?)(?=\1\[|\nfunc |\n\})/g,
    ),
  ]
  for (const m of indexed) {
    const varName = m[1]
    if (!varName.toLowerCase().includes(varPrefix.toLowerCase())) continue
    const idx = Number(m[2])
    const frames = Number(m[3])
    const cancels = extractCancelsAfter(m[4] || '')
    const holdish = idx > 0
    actions.push({
      id: holdish ? `${actionId}_${idx}` : actionId,
      label: holdish ? `${label} (variant ${idx})` : label,
      kind: holdish ? `${kind}_variant_${idx}` : kind,
      frames,
      seconds: round(frames / FPS),
      hitmarks: [],
      cancels,
      source: 'gcsim',
      stateHint: 'default',
      gcsimVar: `${varName}[${idx}]`,
    })
  }

  // Hitmarks constants
  const hitConst = src.match(
    new RegExp(`(?:const\\s*\\(|var\\s+)?(\\w*[Hh]itmark\\w*)\\s*=\\s*(\\d+)`),
  )
  if (hitConst && actions[0] && !actions[0].hitmarks.length) {
    actions[0].hitmarks = [Number(hitConst[2])]
  }

  // Mavuika bike CA specials
  if (familyIsCharge(varPrefix) && /bikeChargeAttackMinimumDuration/.test(src)) {
    const min = Number(src.match(/bikeChargeAttackMinimumDuration\s*=\s*(\d+)/)?.[1])
    const max = Number(src.match(/bikeChargeAttackMaximumDuration\s*=\s*(\d+)/)?.[1])
    const startHit = Number(src.match(/bikeChargeAttackStartupHitmark\s*=\s*(\d+)/)?.[1])
    const finalHit = Number(src.match(/bikeChargeFinalHitmark\s*=\s*(\d+)/)?.[1])
    const spin = Number(src.match(/bikeChargeAttackSpinFrames\s*=\s*(\d+)/)?.[1])
    if (min) {
      actions.push({
        id: 'ca_cycle',
        label: 'Charged Attack cycle (donut / spin)',
        kind: 'ca_cycle',
        frames: min,
        framesMax: max || null,
        seconds: round(min / FPS),
        secondsMax: max ? round(max / FPS) : null,
        hitmarks: startHit ? [startHit] : [],
        spinFrames: spin || null,
        cancels: {},
        source: 'gcsim',
        stateHint: 'skill_state',
        notes:
          'Flamestrider CA: hold spins; release into CA final. Duration clamped between min and max frames.',
      })
    }
    if (finalHit) {
      // final frames already may exist from bikeChargeFinalFrames
      const existing = actions.find((a) => a.id.includes('final'))
      if (!existing) {
        actions.push({
          id: 'ca_final',
          label: 'Charged Attack Final',
          kind: 'ca_final',
          frames: null,
          seconds: null,
          hitmarks: [finalHit],
          cancels: {},
          source: 'gcsim',
          stateHint: 'skill_state',
        })
      } else if (!existing.hitmarks.length) {
        existing.hitmarks = [finalHit]
      }
    }
  }

  void single
  return actions
}

function familyIsCharge(prefix) {
  return prefix === 'charge'
}

function readGo(dir, name) {
  const p = path.join(dir, name)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

function mergeActionsIntoStates(statesById, actions) {
  for (const action of actions) {
    const stateId = action.stateHint || 'default'
    delete action.stateHint
    if (!statesById.has(stateId)) {
      statesById.set(stateId, {
        id: stateId,
        label:
          stateId === 'default'
            ? 'Default'
            : stateId === 'skill_state'
              ? 'Skill / Nightsoul state'
              : stateId === 'burst'
                ? 'Burst state'
                : stateId,
        actions: [],
      })
    }
    const state = statesById.get(stateId)
    const idx = state.actions.findIndex((a) => a.id === action.id)
    if (idx >= 0) state.actions[idx] = { ...state.actions[idx], ...action }
    else state.actions.push(action)
  }
}

function readAllGo(dir) {
  if (!fs.existsSync(dir)) return ''
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.go') && !f.startsWith('zz_'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n\n')
}

function parseGcsimCharacter(folder) {
  const statesById = new Map()
  const attack = readGo(folder, 'attack.go')
  if (attack) {
    for (const st of parseAttackGo(attack)) {
      statesById.set(st.id, {
        id: st.id,
        label: st.label,
        actions: [...st.actions],
      })
    }
  }

  const allGo = readAllGo(folder)

  const charge = readGo(folder, 'charge.go') || allGo
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(charge, {
      varPrefix: 'charge',
      actionId: 'ca',
      label: 'Charged Attack',
      kind: 'ca',
    }),
  )
  mergeActionsIntoStates(statesById, parseSpecialChargedAttacks(charge))

  // Aimed shots (bows) — file is often aimed.go
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(allGo, {
      varPrefix: 'aimed',
      actionId: 'aim',
      label: 'Aimed Shot',
      kind: 'aim',
    }),
  )
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(allGo, {
      varPrefix: 'aim',
      actionId: 'aim',
      label: 'Aimed Shot',
      kind: 'aim',
    }),
  )

  const skill = readGo(folder, 'skill.go') || allGo
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(skill, {
      varPrefix: 'skill',
      actionId: 'skill',
      label: 'Elemental Skill',
      kind: 'skill',
    }),
  )

  const burst = readGo(folder, 'burst.go') || allGo
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(burst, {
      varPrefix: 'burst',
      actionId: 'burst',
      label: 'Elemental Burst',
      kind: 'burst',
    }),
  )

  const plunge = readGo(folder, 'plunge.go') || allGo
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(plunge, {
      varPrefix: 'plunge',
      actionId: 'plunge',
      label: 'Plunge',
      kind: 'plunge',
    }),
  )

  // Dash is often in character.go / dash.go
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(allGo, {
      varPrefix: 'dash',
      actionId: 'dash',
      label: 'Dash',
      kind: 'dash',
    }),
  )

  // Jump
  mergeActionsIntoStates(
    statesById,
    parseAbilFile(allGo, {
      varPrefix: 'jump',
      actionId: 'jump',
      label: 'Jump',
      kind: 'jump',
    }),
  )

  // Default dash by body type when character-specific dash frames are absent
  applyDefaultDash(statesById, folder)

  return [...statesById.values()]
}

const DASH_BY_BODY = {
  BODY_BOY: 21,
  BODY_LOLI: 21,
  BODY_MALE: 19,
  BODY_LADY: 22,
  BODY_GIRL: 20,
}

function readGcsimBody(folder) {
  const candidates = [
    path.join(folder, '_data.dm.textproto'),
    // Traveler: common/anemo → ../../anemo/aether
    path.join(folder, '../../anemo/aether/_data.dm.textproto'),
    path.join(folder, '../../../anemo/aether/_data.dm.textproto'),
  ]
  // Element-specific traveler body
  const elem = folder.match(/traveler\/common\/(\w+)/)?.[1]
  if (elem) {
    candidates.unshift(
      path.join(folder, `../../${elem}/aether/_data.dm.textproto`),
    )
  }
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/body:\s*(BODY_\w+)/)
    if (m) return m[1]
  }
  return null
}

function applyDefaultDash(statesById, folder) {
  const def = statesById.get('default')
  if (!def) return
  const existing = def.actions.find((a) => a.id === 'dash')
  if (existing?.frames != null) return
  const body = readGcsimBody(folder)
  const frames = (body && DASH_BY_BODY[body]) || 20
  const action = {
    id: 'dash',
    label: 'Dash',
    kind: 'dash',
    frames,
    seconds: round(frames / FPS),
    hitmarks: [],
    cancels: {},
    source: 'gcsim',
    notes: `Default gcsim dash length for ${body || 'unknown body'}`,
    gcsimVar: 'template.DashLength',
  }
  if (existing) Object.assign(existing, action)
  else def.actions.push(action)
}

function stubStates(character, field) {
  const naCount = inferNaCount(character)
  const actions = []
  for (let i = 1; i <= naCount; i++) {
    actions.push({
      id: `na${i}`,
      label: `Normal Attack ${i}`,
      kind: `na${i}`,
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    })
  }
  actions.push({
    id: 'ca',
    label: 'Charged Attack',
    kind: 'ca',
    frames: null,
    seconds: null,
    hitmarks: [],
    cancels: {},
    source: null,
  })
  if (field?.skillCast != null) {
    actions.push({
      id: 'skill',
      label: 'Elemental Skill',
      kind: 'skill',
      frames: secondsToFrames(field.skillCast),
      seconds: round(field.skillCast),
      hitmarks: [],
      cancels: {},
      source: 'estimated',
      notes: 'From fieldTimings.ts coarse cast lock',
    })
  } else {
    actions.push({
      id: 'skill',
      label: 'Elemental Skill',
      kind: 'skill',
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    })
  }
  if (field?.skillHoldCast != null) {
    actions.push({
      id: 'skill_hold',
      label: 'Elemental Skill (Hold / long)',
      kind: 'skill_hold',
      frames: secondsToFrames(field.skillHoldCast),
      seconds: round(field.skillHoldCast),
      hitmarks: [],
      cancels: {},
      source: 'estimated',
      notes: 'From fieldTimings.ts coarse cast lock',
    })
  }
  if (field?.burstCast != null) {
    actions.push({
      id: 'burst',
      label: 'Elemental Burst',
      kind: 'burst',
      frames: secondsToFrames(field.burstCast),
      seconds: round(field.burstCast),
      hitmarks: [],
      cancels: {},
      source: 'estimated',
      notes: 'From fieldTimings.ts coarse cast lock',
    })
  } else {
    actions.push({
      id: 'burst',
      label: 'Elemental Burst',
      kind: 'burst',
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    })
  }
  actions.push(
    {
      id: 'plunge_low',
      label: 'Low Plunge',
      kind: 'plunge_low',
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    },
    {
      id: 'plunge_high',
      label: 'High Plunge',
      kind: 'plunge_high',
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    },
    {
      id: 'dash',
      label: 'Dash',
      kind: 'dash',
      frames: null,
      seconds: null,
      hitmarks: [],
      cancels: {},
      source: null,
    },
  )

  return [
    {
      id: 'default',
      label: 'Default',
      actions,
    },
  ]
}

function promoteNamedCa(states) {
  const def = states.find((s) => s.id === 'default')
  if (!def) return
  const ca = def.actions.find((a) => a.id === 'ca')
  if (ca?.frames != null) return
  const named = def.actions.filter(
    (a) => a.id.startsWith('ca_') && a.frames != null && a.id !== 'ca_cycle',
  )
  if (!named.length) return
  const preferred =
    named.find((a) => /final/i.test(a.id)) ||
    named.find((a) => /saichi|slash/i.test(a.id)) ||
    named[0]
  const mirrored = {
    id: 'ca',
    label: 'Charged Attack',
    kind: 'ca',
    frames: preferred.frames,
    seconds: preferred.seconds,
    hitmarks: preferred.hitmarks || [],
    cancels: preferred.cancels || {},
    source: preferred.source,
    notes: `Primary CA mirrored from ${preferred.id}`,
  }
  if (ca) Object.assign(ca, mirrored)
  else def.actions.push(mirrored)
}

function promoteBowAimToCa(states) {
  const def = states.find((s) => s.id === 'default')
  if (!def) return
  const ca = def.actions.find((a) => a.id === 'ca')
  const aim =
    def.actions.find((a) => a.id === 'aim_fully_charged' && a.frames != null) ||
    def.actions.find((a) => a.id === 'aim_charged' && a.frames != null) ||
    def.actions.find((a) => a.id === 'aim' && a.frames != null)
  if (!aim) return
  if (ca?.frames != null) return
  const mirrored = {
    id: 'ca',
    label: 'Charged Attack (Aimed)',
    kind: 'ca',
    frames: aim.frames,
    seconds: aim.seconds,
    hitmarks: aim.hitmarks || [],
    cancels: aim.cancels || {},
    source: aim.source,
    notes: `Mirrored from ${aim.id}`,
  }
  if (ca) Object.assign(ca, mirrored)
  else def.actions.push(mirrored)
}

function ensureAction(states, stateId, action) {
  let state = states.find((s) => s.id === stateId)
  if (!state) {
    state = {
      id: stateId,
      label: stateId === 'default' ? 'Default' : stateId,
      actions: [],
    }
    states.push(state)
  }
  if (!state.actions.some((a) => a.id === action.id)) {
    state.actions.push(action)
  }
}

function mergeStubGaps(states, character, field) {
  const stubs = stubStates(character, field)[0].actions
  for (const action of stubs) {
    ensureAction(states, 'default', action)
  }
  return states
}

function countFilled(states) {
  let total = 0
  let filled = 0
  for (const st of states) {
    for (const a of st.actions) {
      total += 1
      if (a.frames != null) filled += 1
    }
  }
  return { total, filled }
}

function main() {
  const kits = JSON.parse(fs.readFileSync(KITS, 'utf8'))
  const fieldById = parseFieldTimingsSeconds()

  const characters = []
  let withGcsim = 0

  for (const c of kits.characters) {
    const alias = GCSIM_ALIAS[c.id] || c.id
    const folder = GCSIM ? path.join(GCSIM, alias) : null
    let states
    let sources = []
    let gcsimPr = null
    if (folder && fs.existsSync(folder)) {
      states = parseGcsimCharacter(folder)
      const prMetaPath = path.join(folder, '.gcsim-pr-source.json')
      if (fs.existsSync(prMetaPath)) {
        try {
          gcsimPr = JSON.parse(fs.readFileSync(prMetaPath, 'utf8'))
        } catch {
          gcsimPr = null
        }
        sources.push(gcsimPr?.pr != null ? `gcsim-pr-${gcsimPr.pr}` : 'gcsim-pr')
      } else {
        sources.push('gcsim')
      }
      withGcsim += 1
    } else {
      states = []
    }
    states = mergeStubGaps(states, c, fieldById[c.id])
    promoteBowAimToCa(states)
    promoteNamedCa(states)
    if (fieldById[c.id]) sources.push('fieldTimings')

    const { total, filled } = countFilled(states)
    characters.push({
      id: c.id,
      name: c.name,
      fps: FPS,
      gcsimPackage: folder && fs.existsSync(folder) ? alias : null,
      gcsimPr: gcsimPr
        ? {
            number: gcsimPr.pr ?? null,
            repo: gcsimPr.repo ?? null,
            branch: gcsimPr.branch ?? null,
          }
        : null,
      sources,
      completeness: { actionsWithFrames: filled, actionsTotal: total },
      incomplete: filled < total,
      states,
    })
  }

  const payload = {
    source: GCSIM
      ? 'gcsim internal/characters (+ open PRs) + characterKits roster + fieldTimings'
      : 'characterKits roster + fieldTimings (no gcsim path)',
    extractedAt: new Date().toISOString(),
    fps: FPS,
    notes: [
      'Frames are at 60 FPS. seconds = frames / 60.',
      'hitmarks are frame offsets from action start.',
      'cancels are earliest queue frames into the listed next action.',
      'States separate default kit from skill/burst-modified kits (e.g. Mavuika Flamestrider).',
      'null frames mean not yet sourced — fill via GCSIM_CHARS, open PRs (fetchGcsimPrChars), or manual edits.',
      'ca_cycle / ca_final cover charged loops such as Mavuika donut spinning.',
      'Claymore charged-attack frames are intentionally left null (flexible / rarely simmed).',
    ],
    count: characters.length,
    withGcsim,
    characters,
  }

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(
    `Wrote ${OUT} (${characters.length} characters, ${withGcsim} with gcsim parse)`,
  )
}

main()
