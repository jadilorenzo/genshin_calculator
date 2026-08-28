import { getCharacter } from '../rotations/characters'
import type { TestingRunEntry } from './testingApi'

export type SessionDamageSegment = {
  key: string
  characterId: string
  name: string
  /** Average personal damage per run. */
  personalDamage: number
  /** Average team share per run (0–100). */
  teamPct: number
}

export type SessionDamageSummary = {
  sessionId: string
  title: string
  runCount: number
  mainDpsId: string
  characters: SessionDamageSegment[]
  /** Average team total damage per run (for sorting). */
  teamDamage: number
  /** Highest team total from any run in the session. */
  peakTeamDamage: number
  /** DPS from the run with peak team damage. */
  peakTeamDps: number | null
}

function characterKey(characterId: string, name: string) {
  return characterId || name
}

function characterName(characterId: string, name: string) {
  return name || getCharacter(characterId)?.name || 'Unknown'
}

/** Group runs by session; average personal damage and team % per character. */
export function buildSessionDamageSummaries(
  runs: TestingRunEntry[],
): SessionDamageSummary[] {
  const bySession = new Map<
    string,
    { title: string; runs: TestingRunEntry[] }
  >()

  for (const run of runs) {
    const bucket = bySession.get(run.sessionId) || {
      title: run.sessionTitle,
      runs: [],
    }
    bucket.runs.push(run)
    bySession.set(run.sessionId, bucket)
  }

  const summaries: SessionDamageSummary[] = []

  for (const [sessionId, { title, runs: sessionRuns }] of bySession) {
    const byChar = new Map<
      string,
      {
        characterId: string
        name: string
        personalDamage: number
        teamPct: number
        n: number
      }
    >()
    let teamDamageSum = 0
    let teamDamageCount = 0
    let peakTeamDamage = 0
    let peakTeamDps: number | null = null
    const mainVotes = new Map<string, number>()

    for (const run of sessionRuns) {
      if (run.totalDamage != null && run.totalDamage > 0) {
        teamDamageSum += run.totalDamage
        teamDamageCount += 1
        if (run.totalDamage >= peakTeamDamage) {
          peakTeamDamage = run.totalDamage
          peakTeamDps = run.dps
        }
      }
      if (run.mainDpsId) {
        mainVotes.set(run.mainDpsId, (mainVotes.get(run.mainDpsId) || 0) + 1)
      }

      for (const row of run.characters) {
        if (!row.characterId && !row.name) continue
        const damage = row.damage ?? 0
        if (damage <= 0 && row.teamPct == null) continue
        const key = characterKey(row.characterId, row.name)
        const prev = byChar.get(key) || {
          characterId: row.characterId,
          name: characterName(row.characterId, row.name),
          personalDamage: 0,
          teamPct: 0,
          n: 0,
        }
        prev.personalDamage += damage
        prev.teamPct += row.teamPct ?? 0
        prev.n += 1
        byChar.set(key, prev)
      }
    }

    const mainDpsId =
      [...mainVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''

    const characters = [...byChar.values()]
      .map((entry) => {
        const key = characterKey(entry.characterId, entry.name)
        return {
          key,
          characterId: entry.characterId,
          name: entry.name,
          personalDamage: entry.n ? entry.personalDamage / entry.n : 0,
          teamPct: entry.n ? entry.teamPct / entry.n : 0,
        }
      })
      .filter((bar) => bar.personalDamage > 0 || bar.teamPct > 0)
      .sort((a, b) => {
        const aMain = a.characterId === mainDpsId
        const bMain = b.characterId === mainDpsId
        if (aMain !== bMain) return aMain ? -1 : 1
        return b.personalDamage - a.personalDamage
      })

    const teamDamage =
      teamDamageCount > 0 ? teamDamageSum / teamDamageCount : 0

    if (characters.length === 0 && teamDamage <= 0) continue

    summaries.push({
      sessionId,
      title,
      runCount: sessionRuns.length,
      mainDpsId,
      characters,
      teamDamage,
      peakTeamDamage,
      peakTeamDps,
    })
  }

  return summaries.sort((a, b) => b.teamDamage - a.teamDamage)
}

export function globalPersonalMax(summaries: SessionDamageSummary[]) {
  return Math.max(
    1,
    ...summaries.flatMap((summary) =>
      summary.characters.map((character) => character.personalDamage),
    ),
  )
}

export function globalChartMax(summaries: SessionDamageSummary[]) {
  const personal = globalPersonalMax(summaries)
  const peakTeam = Math.max(
    0,
    ...summaries.map((summary) => summary.peakTeamDamage),
  )
  return Math.max(1, personal, peakTeam)
}
