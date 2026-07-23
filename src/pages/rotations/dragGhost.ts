import type { DragEvent } from "react";
import type { CharacterData } from "./types";

const FALLBACK_CDN = "https://gi.yatta.moe/assets/UI";

/** Mini portrait used as the HTML5 drag image when rearranging. */
export const setCharacterDragImage = (
  e: DragEvent,
  character: Pick<CharacterData, "name" | "icon" | "iconFile" | "element">,
  offset = 18,
) => {
  const ghost = document.createElement("div");
  ghost.className = "rotation-drag-ghost";
  ghost.dataset.element = character.element || "";
  ghost.setAttribute("aria-hidden", "true");

  const src =
    character.icon ||
    (character.iconFile ? `${FALLBACK_CDN}/${character.iconFile}.png` : null);

  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    ghost.appendChild(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "rotation-drag-ghost-fallback";
    fallback.textContent = character.name.slice(0, 1);
    ghost.appendChild(fallback);
  }

  const label = document.createElement("span");
  label.className = "rotation-drag-ghost-name";
  label.textContent = character.name;
  ghost.appendChild(label);

  ghost.style.position = "fixed";
  ghost.style.top = "-1000px";
  ghost.style.left = "-1000px";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, offset, offset);
  window.setTimeout(() => {
    ghost.remove();
  }, 0);
};
