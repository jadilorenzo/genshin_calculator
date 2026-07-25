import { matchCharacterName } from './matchCharacterName'
import type { TestingCharacterRow } from '../types'

export type ParsedOverlay = {
  dps: number | null
  totalDamage: number | null
  elapsedSeconds: number | null
  strongestHit: number | null
  /** ISO timestamp when the overlay includes a calendar date/time. */
  capturedAt: string | null
  characters: TestingCharacterRow[]
  mainDpsId: string
  warnings: string[]
}

const NUM_TOKEN = '([\\d,OolISs.]+)'

const toInt = (raw: string): number | null => {
  const cleaned = raw
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[^\d]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const toFloat = (raw: string): number | null => {
  const cleaned = raw
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const META_LABELS =
  /^(dps|damage|time|elapsed|strongest|hit|team|total|seconds?|complete|stage|exit)$/i

const normalizeLines = (raw: string): string[] =>
  raw
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ':')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/**
 * Fixed combat-result overlay rows (top → bottom). Labels are OCR-tolerant.
 * "Complete stage & exit" / U is chrome and ignored.
 */
export const OVERLAY_META_ROWS = {
  /** Green exit button — skip when parsing values. */
  completeStage: /Complete\s*stage|stage\s*&\s*exit/i,
  dps: /D[\sP]*P[\sS]*S|OPS|0PS|DP5|cos|ors|sors|eos|ars|aos|prs/i,
  damage: /Dam(?:age|aqe|aqc|ege)|Damaqe|Total\s*Dam/i,
  timeElapsed: /Time\s*Elaps(?:ed|e)|Elapsed|Time\s*El/i,
  strongestHit: /Strongest\s*Hit|Strongest|Max\s*Hit|Stronge(?:st)?/i,
} as const

const fuzzyLabelValue = (
  text: string,
  label: RegExp,
): string | null => {
  // Wrap label so alternations still attach to the trailing number capture.
  const sameLine = text.match(
    new RegExp(`(?:${label.source})\\s*[:.\\-]?\\s*${NUM_TOKEN}`, 'i'),
  )
  if (sameLine?.[1]) return sameLine[1]

  // Adjacent lines: Label\nvalue  (or Label with trailing value)
  const lines = normalizeLines(text)
  for (let i = 0; i < lines.length; i += 1) {
    const compact = lines[i].replace(/[:.\-\s]/g, '')
    if (!label.test(compact) && !label.test(lines[i])) continue
    // Skip the exit-button chrome row even if it contains stray digits.
    if (OVERLAY_META_ROWS.completeStage.test(lines[i])) continue
    const inline = lines[i].match(new RegExp(`${NUM_TOKEN}\\s*s?$`, 'i'))
    if (inline?.[1] && /\d/.test(inline[1])) return inline[1]
    const next = lines[i + 1]
    if (next) {
      const nextVal = next.match(new RegExp(`^${NUM_TOKEN}\\s*s?$`, 'i'))
      if (nextVal?.[1]) return nextVal[1]
    }
  }
  return null
}

/**
 * Walk the known overlay row order and pull values from hardcoded labels.
 * Returns whichever fields it can resolve; missing ones stay null.
 */
export function parseHardcodedMetaRows(raw: string): {
  dps: number | null
  totalDamage: number | null
  elapsedSeconds: number | null
  strongestHit: number | null
} {
  const text = raw.replace(/\r/g, '\n')
  // Drop the exit button line so its OCR noise can't steal DPS/time matches.
  const cleaned = normalizeLines(text)
    .filter((line) => !OVERLAY_META_ROWS.completeStage.test(line))
    .join('\n')

  const dpsRaw = fuzzyLabelValue(cleaned, OVERLAY_META_ROWS.dps)
  const damageRaw = fuzzyLabelValue(cleaned, OVERLAY_META_ROWS.damage)
  const timeRaw = fuzzyLabelValue(cleaned, OVERLAY_META_ROWS.timeElapsed)
  const strongestRaw = fuzzyLabelValue(cleaned, OVERLAY_META_ROWS.strongestHit)

  let totalDamage = damageRaw ? toInt(damageRaw) : null
  const dps = dpsRaw ? toInt(dpsRaw) : null
  const elapsedSeconds = timeRaw ? toFloat(timeRaw) : null
  {
    const damageMatches = [
      ...cleaned.matchAll(
        /(?:Dam(?:age|aqe|aqc|ege)|Damaqe|Total\s*Dam)[^\d\n]{0,12}([\d,OolISs]{4,})/gi,
      ),
    ]
    const candidates: number[] = []
    for (const match of damageMatches) {
      const n = toInt(match[1] || '')
      if (n != null) candidates.push(n)
    }
    if (totalDamage != null) candidates.push(totalDamage)

    if (candidates.length) {
      // Prefer a total consistent with DPS × elapsed when both are known.
      if (dps != null && elapsedSeconds != null && elapsedSeconds > 0) {
        const expected = dps * elapsedSeconds
        candidates.sort(
          (a, b) => Math.abs(a - expected) - Math.abs(b - expected),
        )
        totalDamage = candidates[0]
      } else {
        // Otherwise prefer the longest plausible reading (avoids truncated totals).
        candidates.sort(
          (a, b) =>
            String(b).length - String(a).length || b - a,
        )
        totalDamage = candidates[0]
      }
    }
  }

  return {
    dps,
    totalDamage,
    elapsedSeconds,
    strongestHit: strongestRaw ? toInt(strongestRaw) : null,
  }
}

/** Find kit names mentioned near the damage block even when numbers are garbled. */
const findLooseCharacterNames = (text: string): string[] => {
  const names: string[] = []
  const seen = new Set<string>()
  // Single words only — spaced OCR junk ("oy Lo") false-positives on short names.
  const tokens = text.match(/\b[A-Za-z][A-Za-z'-]{1,20}\b/g) || []
  for (const token of tokens) {
    if (META_LABELS.test(token.trim())) continue
    const resolved = matchCharacterName(token)
    if (!resolved) continue
    const key = resolved.id
    if (seen.has(key)) continue
    seen.add(key)
    names.push(resolved.name)
    if (names.length >= 4) break
  }
  return names
}

const fillResidualDamages = (
  characters: TestingCharacterRow[],
  totalDamage: number | null,
  text: string,
): TestingCharacterRow[] => {
  const rows = characters.map((row) => ({ ...row }))

  // Infer damage from team % when OCR ate digits but kept the percent.
  if (totalDamage != null && totalDamage > 0) {
    for (const row of rows) {
      if (row.damage == null && row.teamPct != null && row.teamPct > 0) {
        row.damage = Math.round((totalDamage * row.teamPct) / 100)
      }
    }
  }

  if (totalDamage == null || totalDamage <= 0) return rows

  const knownSum = rows.reduce((sum, row) => sum + (row.damage ?? 0), 0)
  const residual = totalDamage - knownSum
  if (residual <= 0) return rows

  // Prefer assigning residual to a named row with missing damage.
  const missingDmg = rows.find((row) => row.name && row.damage == null)
  if (missingDmg) {
    missingDmg.damage = residual
    if (missingDmg.teamPct == null && totalDamage > 0) {
      missingDmg.teamPct = Math.round((residual / totalDamage) * 100)
    }
    return rows
  }

  // Yellow active-DPS row often vanishes; recover from leftover total + loose name.
  const knownIds = new Set(
    rows.filter((row) => row.characterId).map((row) => row.characterId),
  )
  const knownNames = new Set(
    rows.filter((row) => row.name).map((row) => row.name.toLowerCase()),
  )
  const loose = findLooseCharacterNames(text).find((name) => {
    const resolved = matchCharacterName(name)
    if (!resolved) return !knownNames.has(name.toLowerCase())
    return !knownIds.has(resolved.id)
  })

  // Only invent a row when residual is a meaningful share of total (main DPS).
  if (residual / totalDamage < 0.15 && !loose) return rows

  if (rows.length < 4 || rows.some((row) => !row.name && row.damage == null)) {
    const resolved = loose ? matchCharacterName(loose) : null
    const emptyIdx = rows.findIndex((row) => !row.name && row.damage == null)
    const target =
      emptyIdx >= 0
        ? rows[emptyIdx]
        : rows.length < 4
          ? {
              slot: rows.length,
              characterId: '',
              name: '',
              damage: null as number | null,
              teamPct: null as number | null,
            }
          : null
    if (target && emptyIdx < 0 && rows.length < 4) rows.push(target)
    if (target) {
      target.characterId = resolved?.id || ''
      target.name = resolved?.name || loose || 'Unknown'
      target.damage = residual
      target.teamPct = Math.round((residual / totalDamage) * 100)
    }
  }

  return rows
}

const parseCharacterRows = (text: string): TestingCharacterRow[] => {
  const characters: TestingCharacterRow[] = []
  const seen = new Set<string>()

  const pushRow = (
    nameRaw: string,
    damageRaw: string,
    pctRaw: string,
    allowNameOnly = false,
  ) => {
    const name = nameRaw.trim()
    if (!name || META_LABELS.test(name)) return
    if (characters.length >= 4) return
    const damage = damageRaw ? toInt(damageRaw) : null
    let teamPct = pctRaw ? toFloat(pctRaw) : null
    if (teamPct != null && (teamPct < 0 || teamPct > 100)) teamPct = null
    if (damage == null && teamPct == null && !allowNameOnly) return
    const resolved = matchCharacterName(name)
    const key = (resolved?.id || name).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    characters.push({
      slot: characters.length,
      characterId: resolved?.id || '',
      name: resolved?.name || name,
      damage,
      teamPct,
    })
  }

  // Name : 3,452,040 (26%)  — tolerant of missing colon / spaced %
  const rowRe =
    /([A-Za-z][A-Za-z .'-]{1,40}?)\s*[:.\-]?\s*([\d,OolISs]+)\s*[\(\[]\s*(\d+(?:\.\d+)?)\s*%?\s*[\)\]]/g
  let match: RegExpExecArray | null
  while ((match = rowRe.exec(text)) && characters.length < 4) {
    pushRow(match[1], match[2], match[3])
  }

  // Fallback: scan lines for "Name" then "number (pct)" nearby
  const lines = normalizeLines(text)
  for (let i = 0; i < lines.length && characters.length < 4; i += 1) {
    const line = lines[i]
    const combined = rowRe.exec(line)
    rowRe.lastIndex = 0
    if (combined) {
      pushRow(combined[1], combined[2], combined[3])
      continue
    }

    const pctOnly = line.match(
      /^([\d,OolISs]+)\s*[\(\[]\s*(\d+(?:\.\d+)?)\s*%?\s*[\)\]]$/i,
    )
    if (pctOnly) {
      const prev = lines[i - 1]
      if (prev && /^[A-Za-z][A-Za-z .'-]{1,40}$/.test(prev)) {
        pushRow(prev, pctOnly[1], pctOnly[2])
      }
      continue
    }

    const nameThenNums = line.match(
      /^([A-Za-z][A-Za-z .'-]{1,40})\s+([\d,OolISs]+)\s+(\d+(?:\.\d+)?)\s*%?$/i,
    )
    if (nameThenNums) {
      pushRow(nameThenNums[1], nameThenNums[2], nameThenNums[3])
      continue
    }

    // Name present but damage garbled (common for yellow active DPS row).
    const nameOnly = line.match(/^([A-Za-z][A-Za-z .'-]{1,40})\b/)
    if (
      nameOnly &&
      !META_LABELS.test(nameOnly[1]) &&
      matchCharacterName(nameOnly[1])
    ) {
      const resolved = matchCharacterName(nameOnly[1])
      if (resolved) pushRow(resolved.name, '', '', true)
    }
  }

  return characters
}

const fixDateDigits = (raw: string) =>
  raw
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/[Ss]/g, '5')

const isPlausibleDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) =>
  year >= 2018 &&
  year <= 2100 &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= 31 &&
  hour <= 23 &&
  minute <= 59 &&
  second <= 59

const applyAmPm = (hour: number, meridiem: string | undefined): number => {
  if (!meridiem) return hour
  const upper = meridiem.toUpperCase()
  if (upper === 'AM') return hour === 12 ? 0 : hour
  if (upper === 'PM') return hour === 12 ? 12 : hour + 12
  return hour
}

/** Pull YYYY/MM/DD (optional time) from overlay OCR when present. */
export function parseCapturedAt(raw: string): string | null {
  const text = fixDateDigits(raw.replace(/\r/g, '\n'))
  const patterns = [
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/,
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/,
  ] as const

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue

    let year: number
    let month: number
    let day: number
    let hour = 0
    let minute = 0
    let second = 0

    if (match[1].length === 4) {
      year = Number(match[1])
      month = Number(match[2])
      day = Number(match[3])
      hour = Number(match[4] || 0)
      minute = Number(match[5] || 0)
      second = Number(match[6] || 0)
    } else {
      // Assume MDY when year is last (common on US overlays).
      month = Number(match[1])
      day = Number(match[2])
      year = Number(match[3])
      hour = Number(match[4] || 0)
      minute = Number(match[5] || 0)
      second = Number(match[6] || 0)
    }

    if (!isPlausibleDate(year, month, day, hour, minute, second)) continue

    const iso = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second),
    ).toISOString()
    return iso
  }

  return null
}

/**
 * Pull capture time from common screenshot filenames (macOS / Windows).
 * Times are interpreted as local wall-clock.
 *
 * Examples:
 *   Screenshot_2026-07-09_at_5.46.59_PM-….png
 *   Screenshot 2026-07-09 at 5.46.59 PM.png
 *   Screenshot_20260709_174659.png
 */
export function parseCapturedAtFromFilename(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')

  // macOS: Screenshot_2026-07-09_at_5.46.59_PM / Screenshot 2026-07-09 at 5.46.59 PM
  const mac = base.match(
    /(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?:[_\s]+at[_\s]+)?(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?(?:[_\s]*(AM|PM))?/i,
  )
  if (mac) {
    const year = Number(mac[1])
    const month = Number(mac[2])
    const day = Number(mac[3])
    const minute = Number(mac[5])
    const second = Number(mac[6] || 0)
    const hour = applyAmPm(Number(mac[4]), mac[7])
    if (isPlausibleDate(year, month, day, hour, minute, second)) {
      return new Date(year, month - 1, day, hour, minute, second).toISOString()
    }
  }

  // Compact: Screenshot_20260709_174659 or 20260709-174659
  const compact = base.match(/(\d{4})(\d{2})(\d{2})[_T\-]?(\d{2})(\d{2})(\d{2})/)
  if (compact) {
    const year = Number(compact[1])
    const month = Number(compact[2])
    const day = Number(compact[3])
    const hour = Number(compact[4])
    const minute = Number(compact[5])
    const second = Number(compact[6])
    if (isPlausibleDate(year, month, day, hour, minute, second)) {
      return new Date(year, month - 1, day, hour, minute, second).toISOString()
    }
  }

  // Date-only fallback: 2026-07-09
  const dateOnly = base.match(/(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    if (isPlausibleDate(year, month, day, 0, 0, 0)) {
      return new Date(year, month - 1, day).toISOString()
    }
  }

  return null
}

/** Score how complete a parse looks — used to pick the best OCR pass. */
export function scoreParsedOverlay(parsed: ParsedOverlay): number {
  let score = 0
  if (parsed.dps != null) score += 4
  if (parsed.totalDamage != null) score += 4
  if (parsed.elapsedSeconds != null) score += 3
  if (parsed.strongestHit != null) score += 2
  if (parsed.capturedAt) score += 2
  for (const row of parsed.characters) {
    if (row.damage != null) score += 2
    if (row.teamPct != null) score += 1
    if (row.characterId) score += 2
    else if (row.name) score += 0.5
  }
  score -= parsed.warnings.length
  return score
}

/**
 * Parse OCR text from a Genshin combat-result overlay into structured fields.
 */
export function parseOverlayText(raw: string): ParsedOverlay {
  const text = raw.replace(/\r/g, '\n')
  const warnings: string[] = []

  // Hardcoded HUD rows: DPS → Damage → (chars) → Time Elapsed → Strongest Hit.
  // "Complete stage & exit" / U is stripped inside parseHardcodedMetaRows.
  const meta = parseHardcodedMetaRows(text)
  let dps = meta.dps
  let totalDamage = meta.totalDamage
  let elapsedSeconds = meta.elapsedSeconds
  let strongestHit = meta.strongestHit
  const capturedAt = parseCapturedAt(text)

  // OCR sometimes turns Strongest Hit digits into letters (95262 → "oseez" → 55).
  if (
    strongestHit != null &&
    totalDamage != null &&
    totalDamage > 10000 &&
    strongestHit < 100
  ) {
    strongestHit = null
  }

  // Recover DPS when OCR missed the label but damage + time are present.
  if (
    dps == null &&
    totalDamage != null &&
    elapsedSeconds != null &&
    elapsedSeconds > 0
  ) {
    const computed = Math.round(totalDamage / elapsedSeconds)
    // Prefer a nearby top-of-overlay integer that matches computed ±1 (avoids
    // off-by-one from elapsed rounding, e.g. 7674387/120.03 → 63937 vs 63938).
    const topNums = [...text.slice(0, 400).matchAll(/\b(\d{4,6})\b/g)].map(
      (m) => Number(m[1]),
    )
    const nearby = topNums.find((n) => Math.abs(n - computed) <= 1)
    dps = nearby ?? computed
  }

  let characters = parseCharacterRows(text)

  // Drop impossible / inconsistent per-character damages.
  if (totalDamage != null && totalDamage > 0) {
    for (const row of characters) {
      if (row.damage != null && row.damage > totalDamage) {
        row.damage = null
      }
      // Glued digits with a tiny team % (24398→2439808 (0%)).
      if (
        row.damage != null &&
        row.teamPct != null &&
        row.teamPct <= 1 &&
        row.damage > totalDamage * 0.02
      ) {
        const stripped = Math.floor(row.damage / 100)
        row.damage =
          stripped > 0 && stripped / totalDamage < 0.05
            ? stripped
            : Math.round((totalDamage * row.teamPct) / 100)
      }
    }
  }
  characters = fillResidualDamages(characters, totalDamage, text)

  // If character damages sum cleanly and OCR total lost a digit, prefer the sum.
  let dmgSum = characters.reduce((sum, row) => sum + (row.damage ?? 0), 0)
  let resolvedTotal = totalDamage
  if (
    dmgSum > 0 &&
    characters.filter((row) => row.damage != null).length >= 4
  ) {
    if (
      resolvedTotal == null ||
      Math.abs(dmgSum - resolvedTotal) / dmgSum > 0.02
    ) {
      if (
        resolvedTotal != null &&
        String(dmgSum).startsWith(String(resolvedTotal))
      ) {
        resolvedTotal = dmgSum
      } else if (resolvedTotal == null) {
        resolvedTotal = dmgSum
      }
    }
  }

  if (characters.length === 0) {
    warnings.push('No character damage rows detected — fill them in manually.')
  } else if (characters.length < 4) {
    warnings.push(`Only found ${characters.length} of 4 character rows.`)
  }

  const pctSum = characters.reduce(
    (sum, row) => sum + (row.teamPct ?? 0),
    0,
  )
  if (characters.length > 0 && Math.abs(pctSum - 100) > 2) {
    warnings.push(`Team % sums to ${pctSum.toFixed(1)} (expected ~100).`)
  }

  dmgSum = characters.reduce((sum, row) => sum + (row.damage ?? 0), 0)
  if (
    resolvedTotal != null &&
    dmgSum > 0 &&
    Math.abs(dmgSum - resolvedTotal) / resolvedTotal > 0.02
  ) {
    warnings.push('Character damages do not match total Damage.')
  }

  let mainDpsId = ''
  let bestDamage = -1
  for (const row of characters) {
    const dmg = row.damage ?? -1
    if (dmg > bestDamage && row.characterId) {
      bestDamage = dmg
      mainDpsId = row.characterId
    }
  }

  while (characters.length < 4) {
    characters.push({
      slot: characters.length,
      characterId: '',
      name: '',
      damage: null,
      teamPct: null,
    })
  }

  return {
    dps,
    totalDamage: resolvedTotal,
    elapsedSeconds,
    strongestHit,
    capturedAt,
    characters,
    mainDpsId,
    warnings,
  }
}
