import { useEffect, useState } from 'react'
import { ClearPageButton } from '../../components/ClearPageButton.tsx'
import { PAGE_TITLES } from '../../documentTitles.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { useLocalStorage } from '../../hooks/useLocalStorage.ts'
import { CharacterPalette } from './CharacterPalette'
import { PlacementRoster } from './PlacementRoster'
import { RotationSettingsMenu } from './RotationSettingsMenu'
import {
  DEFAULT_HUMAN_LAG,
  DEFAULT_TIMING_MODE,
  defaultOnFieldDuration,
  kitHoldChannelSeconds,
  parseTimingMode,
  sanitizePlacementCasts,
  type TimingMode,
} from './fieldTimings'
import { RotationTimeline } from './RotationTimeline'
import {
  DEFAULT_SWITCH_BUFFER,
  clampSwitchBuffer,
  normalizeOnField,
  removeAndCloseGaps,
  snapTime,
} from './timelineContinuous'
import type { TimelinePlacement } from './types'
import { getCharacter } from './characters'

function sanitizePlacements(
  list: TimelinePlacement[],
  timingMode: TimingMode,
  humanLag: number,
): TimelinePlacement[] {
  return list.map((p) => {
    const kitHold = kitHoldChannelSeconds(
      getCharacter(p.characterId)?.kit.elementalSkill ?? null,
    )
    const { migratedVariant, ...casts } = sanitizePlacementCasts(p, kitHold)
    const next: TimelinePlacement = { ...p, ...casts }
    const fullDuration = snapTime(
      defaultOnFieldDuration(next.characterId, {
        skill: next.castSkill,
        burst: next.castBurst,
        mode: timingMode,
        humanLag,
        skillVariant: next.skillVariant,
        kitHoldSeconds: kitHold,
      }),
    )
    // Backfill old flat 2.5s drops / pre-variant saves to Full defaults
    if (migratedVariant || (Math.abs(p.duration - 2.5) < 0.05 && fullDuration > 3.5)) {
      next.duration = fullDuration
    }
    return next
  })
}

export default function RotationsPage() {
  useDocumentTitle(PAGE_TITLES.rotations)
  const [placements, setPlacements] = useLocalStorage<TimelinePlacement[]>(
    'gc:rotations:placements',
    [],
  )
  const [switchBuffer, setSwitchBuffer] = useLocalStorage(
    'gc:rotations:switchBuffer',
    DEFAULT_SWITCH_BUFFER,
  )
  const [timingModeRaw, setTimingModeRaw] = useLocalStorage<TimingMode>(
    'gc:rotations:timingMode',
    DEFAULT_TIMING_MODE,
  )
  const timingMode = parseTimingMode(timingModeRaw)
  const [humanLag, setHumanLag] = useLocalStorage(
    'gc:rotations:humanLag',
    DEFAULT_HUMAN_LAG,
  )
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  )
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  )

  // Re-lay out with switch buffers; backfill cast toggles on older saves
  useEffect(() => {
    setPlacements((prev) =>
      normalizeOnField(
        sanitizePlacements(prev, timingMode, humanLag),
        switchBuffer,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / buffer-driven only via handler
  }, [])

  function updateSwitchBuffer(raw: number) {
    const next = clampSwitchBuffer(raw)
    setSwitchBuffer(next)
    setPlacements((prev) => normalizeOnField(prev, next))
  }

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <h1>Rotations</h1>
          <div className="hero-actions">
            <RotationSettingsMenu
              switchBuffer={switchBuffer}
              onSwitchBufferChange={updateSwitchBuffer}
              timingMode={timingMode}
              onTimingModeChange={setTimingModeRaw}
              humanLag={humanLag}
              onHumanLagChange={setHumanLag}
            />
            <ClearPageButton prefix="gc:rotations:" />
          </div>
        </div>
      </header>

      <div className="rotation-workspace">
        <RotationTimeline
          placements={placements}
          onChange={setPlacements}
          selectedId={selectedPlacementId}
          switchBuffer={switchBuffer}
          timingMode={timingMode}
          humanLag={humanLag}
          onSelectPlacement={(id) => {
            setSelectedPlacementId(id)
            if (id) {
              const p = placements.find((x) => x.id === id)
              if (p) setSelectedCharacterId(p.characterId)
            }
          }}
        />

        <div className="rotation-below">
          <CharacterPalette
            selectedId={selectedCharacterId}
            onSelect={(c) => {
              setSelectedCharacterId(c.id)
              setSelectedPlacementId(null)
            }}
          />

          <PlacementRoster
            placements={placements}
            selectedId={selectedPlacementId}
            switchBuffer={switchBuffer}
            timingMode={timingMode}
            humanLag={humanLag}
            onSelect={(id) => {
              setSelectedPlacementId(id)
              const p = placements.find((x) => x.id === id)
              if (p) setSelectedCharacterId(p.characterId)
            }}
            onChange={setPlacements}
            onRemove={(id) => {
              setPlacements((prev) =>
                removeAndCloseGaps(prev, id, switchBuffer),
              )
              if (selectedPlacementId === id) {
                setSelectedPlacementId(null)
              }
            }}
          />
        </div>
      </div>
    </>
  )
}
