import { CharacterIcon } from '../rotations/CharacterIcon'
import type { CharacterData, KitAttribute, KitSkill } from '../rotations/types'

function formatAttr(attr: KitAttribute): string {
  const { name, raw, unit, format } = attr
  if (raw == null || raw === '') return name
  if (unit === 's') return `${name}: ${raw}s`
  if (unit === 'energy') return `${name}: ${raw}`
  if (typeof raw === 'number' && (format === 'P' || format === 'p')) {
    const pct = raw <= 1 ? raw * 100 : raw
    return `${name}: ${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
  }
  if (typeof raw === 'number') {
    return `${name}: ${Number.isInteger(raw) ? raw : Number(raw.toFixed(2))}`
  }
  return `${name}: ${raw}`
}

function SkillSection({
  title,
  skill,
  defaultOpen = true,
}: {
  title: string
  skill: KitSkill | null
  defaultOpen?: boolean
}) {
  if (!skill) return null
  const meta = [
    skill.cooldown != null ? `CD ${skill.cooldown}s` : null,
    skill.energyCost != null ? `${skill.energyCost} Energy` : null,
    skill.duration != null ? `Duration ${skill.duration}s` : null,
  ].filter(Boolean)

  return (
    <details className="rotation-kit-details" open={defaultOpen}>
      <summary>
        {title}
        {skill.name ? ` · ${skill.name}` : ''}
      </summary>
      {meta.length > 0 ? (
        <p className="rotation-char-info-meta">{meta.join(' · ')}</p>
      ) : null}
      {skill.description ? <p>{skill.description}</p> : null}
      {skill.attributes.length > 0 ? (
        <ul className="rotation-char-info-attrs">
          {skill.attributes.map((attr) => (
            <li key={`${attr.name}-${attr.paramKey ?? ''}`}>
              {formatAttr(attr)}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

export function characterSubtitle(character: CharacterData): string {
  return [
    character.element,
    character.weapon,
    `${character.rarity}★`,
    character.constellationName || null,
    character.version ? `v${character.version}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

interface CharacterKitViewProps {
  character: CharacterData
  /** Heading level for the character name */
  headingId?: string
  showHeader?: boolean
  /** Collapse kit sections by default (useful in dense lists) */
  compact?: boolean
  className?: string
}

/** Full kit readout: talents, passives, constellations. */
export function CharacterKitView({
  character,
  headingId,
  showHeader = true,
  compact = false,
  className,
}: CharacterKitViewProps) {
  const { kit } = character
  const open = !compact

  return (
    <div
      className={['character-kit-view', className].filter(Boolean).join(' ')}
      data-element={character.element}
    >
      {showHeader ? (
        <header className="rotation-char-info-head character-kit-view-head">
          <CharacterIcon
            character={character}
            className="rotation-char-info-icon"
          />
          <div className="rotation-char-info-titles">
            <h2 id={headingId} className="rotation-details-name">
              {character.name}
            </h2>
            <p className="rotation-char-info-sub">
              {characterSubtitle(character)}
            </p>
          </div>
        </header>
      ) : null}

      <div className="rotation-char-info-body character-kit-view-body">
        <SkillSection
          title="Normal Attack"
          skill={kit.normalAttack}
          defaultOpen={open}
        />
        <SkillSection
          title="Elemental Skill"
          skill={kit.elementalSkill}
          defaultOpen={open}
        />
        <SkillSection
          title="Elemental Burst"
          skill={kit.elementalBurst}
          defaultOpen={open}
        />

        {kit.passives.length > 0 ? (
          <details className="rotation-kit-details" open={open}>
            <summary>Passives</summary>
            <ul>
              {kit.passives.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>
                  {p.description ? <p>{p.description}</p> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {kit.constellations.length > 0 ? (
          <details className="rotation-kit-details" open={open}>
            <summary>Constellations</summary>
            <ul>
              {kit.constellations.map((c) => (
                <li key={c.level}>
                  <strong>
                    C{c.level} · {c.name}
                  </strong>
                  {c.description ? <p>{c.description}</p> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}
