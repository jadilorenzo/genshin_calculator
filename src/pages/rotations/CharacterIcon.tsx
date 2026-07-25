import { useState } from "react";
import type { CharacterData } from "./types";

const FALLBACK_CDN = "https://gi.yatta.moe/assets/UI";

interface CharacterIconProps {
  character: Pick<CharacterData, "name" | "icon" | "iconFile">;
  className?: string;
  /** Set for canvas/screenshot capture of cross-origin portraits. */
  crossOrigin?: "anonymous" | "use-credentials";
}

/** Character portrait with Enka → Yatta fallbacks. */
export const CharacterIcon = ({
  character,
  className,
  crossOrigin,
}: CharacterIconProps) => {
  const [failed, setFailed] = useState(0);
  const enka = character.icon;
  const yatta = character.iconFile
    ? `${FALLBACK_CDN}/${character.iconFile}.png`
    : null;

  const src = failed === 0 ? enka : failed === 1 ? yatta : null;

  if (!src) {
    return (
      <span className={`${className ?? ""} fallback`.trim()} aria-hidden>
        {character.name.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      crossOrigin={crossOrigin}
      onError={() => setFailed((n) => n + 1)}
    />
  );
};
