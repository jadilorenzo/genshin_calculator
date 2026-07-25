import { describe, expect, it } from 'vitest'
import {
  parseCapturedAtFromFilename,
  parseOverlayText,
  scoreParsedOverlay,
} from './parseOverlayText'
import { matchCharacterName } from './matchCharacterName'

const SAMPLE = `
DPS : 109832
Damage : 13182987
Ineffa : 3452040 (26%)
Columbina : 3901589 (30%)
Sucrose : 113671 (1%)
Flins : 5715687 (43%)
Time Elapsed : 120.03 s
Strongest Hit : 250885
2025/07/24 22:15:03
`

/** Realistic OCR from the Nefer team screenshot after top-left crop. */
const NEFER_OCR = `
Dps: 63938
Damage : 7674387
Lauma: 338573 (4%)
Aino : 101108 (1%)
Sucrose : 24398 (0%)
Nefer ca x:52720 30
Time Elapsed : 120.03 s
Strongest Hit : 95262
`

/** Active DPS row dropped entirely (yellow highlight vanished). */
const NEFER_MISSING_ROW = `
ops: 63938
Damage 7674387
Lauma: 338573 (4%)
Aino: 101108 (1%)
Sucrose : 24398 (0%)
Time Elapsed : 120.03 s
Strongest Hit : 95262
Nefer
`

describe('parseOverlayText', () => {
  it('parses the sample combat overlay text', () => {
    const parsed = parseOverlayText(SAMPLE)
    expect(parsed.dps).toBe(109832)
    expect(parsed.totalDamage).toBe(13182987)
    expect(parsed.elapsedSeconds).toBeCloseTo(120.03)
    expect(parsed.strongestHit).toBe(250885)
    expect(parsed.capturedAt).toBe('2025-07-24T22:15:03.000Z')
    expect(parsed.characters.map((c) => c.name)).toEqual([
      'Ineffa',
      'Columbina',
      'Sucrose',
      'Flins',
    ])
    expect(parsed.characters.map((c) => c.teamPct)).toEqual([26, 30, 1, 43])
    expect(parsed.characters.map((c) => c.damage)).toEqual([
      3452040, 3901589, 113671, 5715687,
    ])
    expect(parsed.mainDpsId).toBeTruthy()
    expect(parsed.warnings.length).toBe(0)
  })

  it('warns when percentages miss 100', () => {
    const parsed = parseOverlayText(`
Damage : 100
Flins : 50 (40%)
Sucrose : 50 (40%)
`)
    expect(parsed.warnings.some((w) => /Team %/.test(w))).toBe(true)
  })

  it('tolerates noisy OCR labels and split lines', () => {
    const parsed = parseOverlayText(`
0PS
1O9832
Damaqe : 13,182,987
lneffa 3452O4O (26 %)
Columbina
3901589 (30%)
Sucrose : 113671 (1%)
Flins : 5715687 (43%)
Time Elapsed
120.03 s
Strongest Hit : 25O885
2O25/O7/24 22:15:O3
`)
    expect(parsed.dps).toBe(109832)
    expect(parsed.totalDamage).toBe(13182987)
    expect(parsed.elapsedSeconds).toBeCloseTo(120.03)
    expect(parsed.strongestHit).toBe(250885)
    expect(parsed.capturedAt).toBe('2025-07-24T22:15:03.000Z')
    expect(parsed.characters.filter((c) => c.damage != null).length).toBe(4)
    expect(parsed.characters.some((c) => c.name === 'Ineffa')).toBe(true)
  })

  it('recovers DPS from damage / elapsed when DPS label is missing', () => {
    const parsed = parseOverlayText(`
Damage : 120000
Time Elapsed : 120 s
Flins : 120000 (100%)
`)
    expect(parsed.dps).toBe(1000)
  })

  it('leaves capturedAt null when no date is on the image', () => {
    const parsed = parseOverlayText(`
DPS : 100
Damage : 100
Time Elapsed : 1 s
`)
    expect(parsed.capturedAt).toBeNull()
  })

  it('scores richer parses higher', () => {
    const good = parseOverlayText(SAMPLE)
    const weak = parseOverlayText('Time Elapsed : 120 s')
    expect(scoreParsedOverlay(good)).toBeGreaterThan(scoreParsedOverlay(weak))
  })

  it('recovers Nefer damage + strongest hit from noisy OCR', () => {
    const parsed = parseOverlayText(NEFER_OCR)
    expect(parsed.dps).toBe(63938)
    expect(parsed.totalDamage).toBe(7674387)
    expect(parsed.elapsedSeconds).toBeCloseTo(120.03)
    expect(parsed.strongestHit).toBe(95262)
    const nefer = parsed.characters.find((c) => c.name === 'Nefer')
    expect(nefer?.damage).toBe(7210308)
    expect(nefer?.teamPct).toBe(94)
    expect(parsed.mainDpsId).toBe('nefer')
  })

  it('fills residual damage when the yellow active-DPS row is missing', () => {
    const parsed = parseOverlayText(NEFER_MISSING_ROW)
    expect(parsed.strongestHit).toBe(95262)
    const nefer = parsed.characters.find((c) => c.name === 'Nefer')
    expect(nefer?.damage).toBe(7210308)
    expect(parsed.mainDpsId).toBe('nefer')
  })

  it('discards absurdly small strongest-hit OCR letter confusions', () => {
    const parsed = parseOverlayText(`
Damage : 7674387
Strongest Hit : oseez
Lauma : 338573 (4%)
`)
    expect(parsed.strongestHit).toBeNull()
  })

  it('matches merged full-crop + character-band OCR from the Nefer screenshot', () => {
    const merged = `
sors: 63938
Damage : 767438
Lauma: 338573 (4%)
Aino : 101108 (1%)
Sucrose : 24398(0%)
Time Elapsed : 120.03 s
Strongest Hit : 95262
cos: 63938
Damage : 7674387
Lauma: 338573(4%)
Aino: 101108 (1%)
Sucrose : 24398(0%)
Nefer owe gGon gas)
`
    const parsed = parseOverlayText(merged)
    expect(parsed.dps).toBe(63938)
    expect(parsed.totalDamage).toBe(7674387)
    expect(parsed.elapsedSeconds).toBeCloseTo(120.03, 1)
    expect(parsed.strongestHit).toBe(95262)
    expect(parsed.mainDpsId).toBe('nefer')
    expect(
      parsed.characters.map((c) => [c.name, c.damage, c.teamPct]),
    ).toEqual([
      ['Lauma', 338573, 4],
      ['Aino', 101108, 1],
      ['Sucrose', 24398, 0],
      ['Nefer', 7210308, 94],
    ])
  })

  it('repairs glued Sucrose damage and residual-fills Nefer', () => {
    const parsed = parseOverlayText(`
Damage : 7674387
Lauma: 338573 (4%)
Aino: 101108 (1%)
Sucrose : 2439808 (0%)
Nefer
`)
    const sucrose = parsed.characters.find((c) => c.name === 'Sucrose')
    expect(sucrose?.damage).toBe(24398)
    const nefer = parsed.characters.find((c) => c.name === 'Nefer')
    expect(nefer?.damage).toBe(7210308)
  })

  it('parses hardcoded DPS / Time Elapsed / Strongest Hit rows', () => {
    const parsed = parseOverlayText(`
Complete stage & exit
U
DPS : 63938
Damage : 7674387
Lauma : 338573 (4%)
Aino : 101108 (1%)
Sucrose : 24398 (0%)
Nefer : 7210308 (94%)
Time Elapsed : 120.03 s
Strongest Hit : 95262
`)
    expect(parsed.dps).toBe(63938)
    expect(parsed.totalDamage).toBe(7674387)
    expect(parsed.elapsedSeconds).toBeCloseTo(120.03)
    expect(parsed.strongestHit).toBe(95262)
    expect(parsed.mainDpsId).toBe('nefer')
  })
})

describe('matchCharacterName', () => {
  it('fuzzy-matches common OCR typos', () => {
    expect(matchCharacterName('lneffa')?.name).toBe('Ineffa')
    expect(matchCharacterName('Columb1na')?.name).toBe('Columbina')
    expect(matchCharacterName('Flins')?.name).toBe('Flins')
    expect(matchCharacterName('Nefer')?.name).toBe('Nefer')
  })
})

describe('parseCapturedAtFromFilename', () => {
  it('parses macOS Screenshot_YYYY-MM-DD_at_h.mm.ss_PM names', () => {
    const iso = parseCapturedAtFromFilename(
      'Screenshot_2026-07-09_at_5.46.59_PM-76a6321b-42d7-45f4-bd30-83c7d97c3352.png',
    )
    expect(iso).toBe(new Date(2026, 6, 9, 17, 46, 59).toISOString())
  })

  it('parses spaced macOS screenshot names', () => {
    const iso = parseCapturedAtFromFilename(
      'Screenshot 2026-07-09 at 5.46.59 PM.png',
    )
    expect(iso).toBe(new Date(2026, 6, 9, 17, 46, 59).toISOString())
  })

  it('parses compact YYYYMMDD_HHMMSS names', () => {
    const iso = parseCapturedAtFromFilename('Screenshot_20260709_174659.png')
    expect(iso).toBe(new Date(2026, 6, 9, 17, 46, 59).toISOString())
  })

  it('returns null when no date is in the name', () => {
    expect(parseCapturedAtFromFilename('overlay.png')).toBeNull()
  })
})
