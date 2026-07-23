import { useMemo, useState, type DragEvent } from "react";
import { CHARACTER_KITS, ELEMENTS } from "./characters";
import { CharacterIcon } from "./CharacterIcon";
import { CharacterInfoButton, CharacterInfoPopup } from "./CharacterInfoPopup";
import { setCharacterDragImage } from "./dragGhost";
import type { CharacterData } from "./types";

const DRAG_TYPE = "application/x-fmr-character";
const CAST_DRAG_TYPE = "application/x-fmr-cast";
const CAST_DRAG_PREFIX = "fmr-cast:";

export type CastDragPayload = {
  characterId: string;
  kind: "skill" | "burst";
  skillVariant?: "press" | "hold";
  skillCasts?: number;
};

export const readCharacterDrag = (e: DragEvent): string | null => {
  const typed = e.dataTransfer.getData(DRAG_TYPE);
  if (typed) return typed;
  const plain = e.dataTransfer.getData("text/plain");
  if (!plain || plain.startsWith(CAST_DRAG_PREFIX)) return null;
  return plain;
};

export const setCharacterDrag = (e: DragEvent, characterId: string) => {
  e.dataTransfer.setData(DRAG_TYPE, characterId);
  e.dataTransfer.setData("text/plain", characterId);
  e.dataTransfer.effectAllowed = "copyMove";
};

export const setCastDrag = (e: DragEvent, payload: CastDragPayload) => {
  const json = JSON.stringify(payload);
  e.dataTransfer.setData(CAST_DRAG_TYPE, json);
  e.dataTransfer.setData("text/plain", `${CAST_DRAG_PREFIX}${json}`);
  e.dataTransfer.effectAllowed = "copy";
};

export const readCastDrag = (e: DragEvent): CastDragPayload | null => {
  const raw =
    e.dataTransfer.getData(CAST_DRAG_TYPE) ||
    (() => {
      const plain = e.dataTransfer.getData("text/plain");
      if (!plain.startsWith(CAST_DRAG_PREFIX)) return "";
      return plain.slice(CAST_DRAG_PREFIX.length);
    })();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CastDragPayload;
    if (
      !parsed?.characterId ||
      (parsed.kind !== "skill" && parsed.kind !== "burst")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

interface CharacterPaletteProps {
  selectedId: string | null;
  onSelect: (character: CharacterData) => void;
  onAdd?: (character: CharacterData) => void;
  insertHint?: string | null;
}

export const CharacterPalette = ({
  selectedId,
  onSelect,
  onAdd,
  insertHint,
}: CharacterPaletteProps) => {
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<string>("all");
  const [infoCharacter, setInfoCharacter] = useState<CharacterData | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHARACTER_KITS.filter((c) => {
      if (element !== "all" && c.element !== element) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.weapon.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q)
      );
    });
  }, [query, element]);

  return (
    <aside className="rotation-palette" aria-label="Characters">
      <div className="rotation-palette-head">
        <h2 className="rotation-section-title">Characters</h2>
        <p className="field-note">{CHARACTER_KITS.length} kits loaded</p>
      </div>

      {insertHint ? (
        <p className="rotation-insert-hint" role="status">
          {insertHint}
        </p>
      ) : (
        <p className="field-note rotation-drag-hint">
          Drag a row onto the timeline, or tap + to add.
        </p>
      )}

      <label className="rotation-search">
        <span className="visually-hidden">Search characters</span>
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="chip-row wrap" role="group" aria-label="Element filter">
        <button
          type="button"
          className={element === "all" ? "chip compact active" : "chip compact"}
          onClick={() => setElement("all")}
        >
          All
        </button>
        {ELEMENTS.map((el) => (
          <button
            key={el}
            type="button"
            className={element === el ? "chip compact active" : "chip compact"}
            onClick={() => setElement(el)}
          >
            {el}
          </button>
        ))}
      </div>

      <ul className="rotation-char-list">
        {filtered.map((c) => (
          <li key={c.id}>
            <div
              className={
                selectedId === c.id
                  ? "rotation-char-card selected"
                  : "rotation-char-card"
              }
            >
              <button
                type="button"
                className="rotation-char-card-main"
                onClick={() => onSelect(c)}
                title={c.name}
              >
                <span
                  className="drag-affordance is-draggable"
                  aria-hidden
                  draggable
                  title="Drag onto timeline"
                  onClick={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setCharacterDrag(e, c.id);
                    setCharacterDragImage(e, c);
                  }}
                >
                  ⠿
                </span>
                {c.icon || c.iconFile ? (
                  <CharacterIcon character={c} className="rotation-char-icon" />
                ) : (
                  <span className="rotation-char-icon fallback" aria-hidden>
                    {c.name.slice(0, 1)}
                  </span>
                )}
                <span className="rotation-char-meta">
                  <span className="rotation-char-name-row">
                    <span className="rotation-char-name">{c.name}</span>
                    <span
                      className={`rotation-rarity r${c.rarity}`}
                      aria-label={`${c.rarity} star`}
                    >
                      {c.rarity}★
                    </span>
                  </span>
                  <span className="rotation-char-sub">
                    {c.element} · {c.weapon}
                  </span>
                </span>
              </button>
              {onAdd ? (
                <button
                  type="button"
                  className="rotation-char-add-btn"
                  onClick={() => onAdd(c)}
                  title={`Add ${c.name} to rotation`}
                  aria-label={`Add ${c.name} to rotation`}
                >
                  +
                </button>
              ) : null}
              <CharacterInfoButton character={c} onOpen={setInfoCharacter} />
            </div>
          </li>
        ))}
      </ul>

      {infoCharacter ? (
        <CharacterInfoPopup
          character={infoCharacter}
          onClose={() => setInfoCharacter(null)}
        />
      ) : null}
    </aside>
  );
};
