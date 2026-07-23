import { useId, useMemo, useState } from 'react'
import {
  formatReactionLabel,
  simulateAura,
  type AuraSnapshot,
} from './auraSim'
import {
  partyConvertsBloom,
  partyConvertsElectroCharged,
} from './combatMechanicsData'
import { getCharacter } from './characters'
import { expandRotationHits } from './rotationHits'
import type { TimelinePlacement } from './types'

interface AuraSimPanelProps {
  placements: TimelinePlacement[]
}

const ELEMENT_COLORS: Record<string, string> = {
  Pyro: 'rgba(230, 120, 90, 0.85)',
  Hydro: 'rgba(90, 150, 230, 0.85)',
  Electro: 'rgba(170, 130, 230, 0.85)',
  Cryo: 'rgba(140, 200, 230, 0.85)',
  Dendro: 'rgba(120, 190, 90, 0.85)',
  Anemo: 'rgba(110, 200, 180, 0.85)',
  Geo: 'rgba(210, 170, 80, 0.85)',
  Quicken: 'rgba(100, 180, 120, 0.85)',
  Frozen: 'rgba(160, 210, 240, 0.85)',
  Burning: 'rgba(220, 100, 60, 0.85)',
}

function maxGauge(timeline: AuraSnapshot[]) {
  let m = 0.8
  for (const snap of timeline) {
    for (const a of snap.auras) m = Math.max(m, a.gauge)
  }
  return m
}

export function AuraSimPanel({ placements }: AuraSimPanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const characterIds = useMemo(() => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const p of [...placements].sort((a, b) => a.start - b.start)) {
      if (seen.has(p.characterId)) continue
      seen.add(p.characterId)
      ids.push(p.characterId)
    }
    return ids
  }, [placements])

  const convertEc = partyConvertsElectroCharged(characterIds)
  const convertBloom = partyConvertsBloom(characterIds)

  const hits = useMemo(
    () => (open ? expandRotationHits(placements) : []),
    [placements, open],
  )

  const result = useMemo(
    () =>
      open
        ? simulateAura(hits, {
            convertElectroCharged: convertEc,
            convertBloom,
            sampleInterval: 0.2,
          })
        : null,
    [hits, convertEc, convertBloom, open],
  )

  if (!placements.length) return null

  const reactionEntries = result
    ? Object.entries(result.reactionCounts).sort((a, b) => b[1] - a[1])
    : []
  const appEntries = result
    ? Object.entries(result.applicationCounts).sort((a, b) => b[1] - a[1])
    : []

  const endTime = result
    ? Math.max(
        hits[hits.length - 1]?.time ?? 0,
        result.auraTimeline[result.auraTimeline.length - 1]?.time ?? 0,
        1,
      )
    : 1
  const gaugeMax = result ? maxGauge(result.auraTimeline) : 0.8
  // Oldest → newest (last window of the log, chronological)
  const reactionEvents = result ? result.events.slice(-40) : []

  return (
    <section className="aura-sim" aria-label="Enemy aura simulator">
      <div className="aura-sim-menu">
        <button
          type="button"
          className={open ? 'chip compact aura-sim-toggle open' : 'chip compact aura-sim-toggle'}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          Enemy aura
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {open && result ? (
        <div className="aura-sim-panel" id={panelId}>
          <header className="aura-sim-head">
            <div className="aura-sim-titles">
              <p className="field-note">
                On-field hit marks plus off-field aura appliers (e.g. Columbina
                Ripple, Oz, Guoba, Birgitta) with internal cooldown. Coexistence
                ticks
                {convertEc ? ' (Lunar-Charged via Ineffa/Flins/Columbina)' : ''}
                {convertBloom ? ' (Lunar-Bloom via Lauma/Nefer)' : ''}.
              </p>
            </div>
            <div className="aura-sim-meta">
              <span className="aura-sim-stat">
                {hits.length} hits
                {hits.filter((h) => h.offField).length
                  ? ` · ${hits.filter((h) => h.offField).length} off-field`
                  : ''}{' '}
                · {result.skippedByIcd} blocked by internal cooldown
              </span>
            </div>
          </header>

          <div className="aura-sim-body">
            <div className="aura-sim-counts">
              <div>
                <h3>Reactions</h3>
                {reactionEntries.length === 0 ? (
                  <p className="field-note">
                    No reactions yet — need opposing auras.
                  </p>
                ) : (
                  <ul className="aura-sim-count-list">
                    {reactionEntries.map(([id, n]) => (
                      <li key={id}>
                        <span>{formatReactionLabel(id)}</span>
                        <strong>{n}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3>Elemental applications</h3>
                {appEntries.length === 0 ? (
                  <p className="field-note">No elemental applications.</p>
                ) : (
                  <ul className="aura-sim-count-list">
                    {appEntries.map(([el, n]) => (
                      <li key={el}>
                        <span
                          className="aura-sim-swatch"
                          style={{ background: ELEMENT_COLORS[el] ?? '#888' }}
                        />
                        {el}
                        <strong>{n}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="aura-sim-timeline" aria-label="Aura over time">
              <div className="aura-sim-timeline-label">
                Aura gauge over {endTime.toFixed(1)}s
              </div>
              <div className="aura-sim-lanes">
                {result.auraTimeline.length <= 1 ? (
                  <p className="field-note">Aura empty for this rotation.</p>
                ) : (
                  result.auraTimeline.map((snap, i) => {
                    const prev = result.auraTimeline[i - 1]
                    const left = (snap.time / endTime) * 100
                    const width = prev
                      ? Math.max(
                          0.4,
                          ((snap.time - prev.time) / endTime) * 100,
                        )
                      : 0.4
                    if (!snap.auras.length && !prev?.auras.length) return null
                    return (
                      <div
                        key={`${snap.time}-${i}`}
                        className="aura-sim-sample"
                        style={{ left: `${left}%` }}
                        title={`${snap.time.toFixed(2)}s: ${
                          snap.auras
                            .map((a) => `${a.element} ${a.gauge.toFixed(2)}U`)
                            .join(', ') || 'empty'
                        }`}
                      >
                        {snap.auras.map((a) => (
                          <span
                            key={a.element}
                            className="aura-sim-bar"
                            style={{
                              background: ELEMENT_COLORS[a.element] ?? '#888',
                              height: `${Math.max(8, (a.gauge / gaugeMax) * 100)}%`,
                              width: `${Math.max(width * 0.35, 0.35)}%`,
                            }}
                          />
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
              <div className="aura-sim-axis">
                <span>0s</span>
                <span>{(endTime / 2).toFixed(1)}s</span>
                <span>{endTime.toFixed(1)}s</span>
              </div>
            </div>

            <div className="aura-sim-events">
              <h3>Reactions (oldest → newest)</h3>
              {reactionEvents.length === 0 ? (
                <p className="field-note">None yet.</p>
              ) : (
                <ul className="aura-sim-event-list">
                  {reactionEvents.map((ev, i) => {
                    const character = ev.characterId
                      ? getCharacter(ev.characterId)
                      : null
                    return (
                      <li key={`${ev.time}-${ev.reaction}-${i}`}>
                        <span className="aura-sim-event-time">
                          {ev.time.toFixed(2)}s
                        </span>
                        <span className="aura-sim-event-name">
                          {formatReactionLabel(ev.reaction)}
                        </span>
                        <span className="aura-sim-event-detail">
                          {ev.triggerElement}
                          {ev.auraElement ? ` → ${ev.auraElement}` : ''}
                          {character ? ` · ${character.name}` : ''}
                          {ev.note ? ` · ${ev.note}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
