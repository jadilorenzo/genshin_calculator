import { useMemo } from 'react'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { useArtifactTarget } from '../../hooks/useArtifactTarget.tsx'
import {
  SLOT_LABELS,
  STAT_LABELS,
  artifactProbability,
  type ArtifactTarget,
  type Slot,
  type Stat,
} from '../../model'

interface Benchmark {
  id: string
  label: string
  slot: Slot
  mainStat: Stat
  requiredSubstats?: Stat[]
  substatMode?: 'all' | 'any'
}

/** Everyday farm baselines for relative rarity. */
const BENCHMARKS: Benchmark[] = [
  {
    id: 'crit-circlet-cd',
    label: 'CRIT Rate Circlet · Crit DMG',
    slot: 'circlet',
    mainStat: 'critRate',
    requiredSubstats: ['critDamage'],
    substatMode: 'all',
  },
  {
    id: 'flower-double-crit',
    label: 'HP Flower · Double Crit',
    slot: 'flower',
    mainStat: 'hp',
    requiredSubstats: ['critRate', 'critDamage'],
    substatMode: 'all',
  },
  { id: 'er-sands', label: 'ER Sands', slot: 'sands', mainStat: 'energyRecharge' },
]

function formatPercent(value: number): string {
  if (value >= 0.01) return `${(value * 100).toFixed(2)}%`
  if (value >= 0.0001) return `${(value * 100).toFixed(4)}%`
  return `${(value * 100).toExponential(2)}%`
}

function selectedLabel(
  slot: Slot,
  mainStat: Stat,
  requiredSubstats: Stat[],
  substatMode: 'all' | 'any',
): string {
  const base = `${STAT_LABELS[mainStat]} ${SLOT_LABELS[slot]}`
  if (requiredSubstats.length === 0) return base
  const join = substatMode === 'all' ? ' + ' : ' / '
  const subs = requiredSubstats.map((s) => STAT_LABELS[s]).join(join)
  return `${base} · ${subs}`
}

function sameSubstats(a: Stat[] = [], b: Stat[] = []): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((stat, i) => stat === sortedB[i])
}

function matchesBenchmark(target: ArtifactTarget, benchmark: Benchmark): boolean {
  const benchSubs = benchmark.requiredSubstats ?? []
  const targetSubs = target.requiredSubstats ?? []
  const benchMode = benchmark.substatMode ?? 'all'
  const targetMode = target.substatMode ?? 'all'
  return (
    target.slot === benchmark.slot &&
    target.mainStat === benchmark.mainStat &&
    sameSubstats(targetSubs, benchSubs) &&
    (benchSubs.length === 0 || targetMode === benchMode)
  )
}

export default function ArtifactComparePage() {
  useDocumentTitle(PAGE_TITLES.artifactCompare)
  const { target, onSetOnly, slot, mainStat, requiredSubstats, substatMode } =
    useArtifactTarget()

  const rows = useMemo(() => {
    const setChance = target.setChance ?? 0.5
    const benchmarkRows = BENCHMARKS.map((benchmark) => {
      const p = artifactProbability({
        setChance,
        slot: benchmark.slot,
        mainStat: benchmark.mainStat,
        requiredSubstats: benchmark.requiredSubstats,
        substatMode: benchmark.substatMode,
      }).total
      return {
        id: benchmark.id,
        label: benchmark.label,
        probability: p,
        isSelected: matchesBenchmark(target, benchmark),
        isYours: false,
      }
    })

    const selectedMatchesBenchmark = BENCHMARKS.some((b) => matchesBenchmark(target, b))
    const yoursProbability = artifactProbability(target).total

    const yoursRow = selectedMatchesBenchmark
      ? null
      : {
          id: 'yours',
          label: `Yours · ${selectedLabel(slot, mainStat, requiredSubstats, substatMode)}`,
          probability: yoursProbability,
          isSelected: true,
          isYours: true,
        }

    const all = yoursRow ? [...benchmarkRows, yoursRow] : benchmarkRows
    const maxP = Math.max(...all.map((row) => row.probability), Number.EPSILON)
    /** Easiest piece fills 80% of the track; others scale against it. */
    const maxFill = 0.8

    return all.map((row) => ({
      ...row,
      fill: Math.max(0, Math.min(maxFill, (row.probability / maxP) * maxFill)),
    }))
  }, [target, slot, mainStat, requiredSubstats, substatMode])

  return (
    <section className="rarity-compare" aria-label="Rarity comparison">
      <ul className="rarity-bars">
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              row.isSelected
                ? row.isYours
                  ? 'rarity-row yours'
                  : 'rarity-row selected'
                : 'rarity-row'
            }
          >
            <div className="rarity-row-meta">
              <span className="rarity-label">{row.label}</span>
              <span className="rarity-pct">{formatPercent(row.probability)} / 5★</span>
            </div>
            <div
              className="rarity-track"
              role="img"
              aria-label={`${row.label}: ${formatPercent(row.probability)} per 5★ drop, bar ${Math.round(row.fill * 100)}% of track`}
            >
              <div className="rarity-fill" style={{ width: `${row.fill * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <p className="field-note rarity-compare-intro">
        Percentages are match chance per 5★ drop
        {onSetOnly ? ' (on-set)' : ' (any set)'}. The easiest piece fills 80% of the bar; others
        scale from that. CRIT Rate Circlet · Crit DMG needs Crit DMG; HP Flower · Double Crit
        needs both crit subs. ER Sands is main-stat only.
      </p>
    </section>
  )
}
