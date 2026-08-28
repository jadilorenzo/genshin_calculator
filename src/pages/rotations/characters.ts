import kitData from "../../data/characterKits.json";
import type { CharacterData, CharacterKitsFile } from "./types";

const data = kitData as unknown as CharacterKitsFile;

const DEFAULT_TRAVELER_ID = "traveler-cryo";

export const CHARACTER_KITS: CharacterData[] = [...data.characters].sort(
  (a, b) => {
    const aTraveler = a.id.startsWith("traveler-");
    const bTraveler = b.id.startsWith("traveler-");
    if (aTraveler && bTraveler) {
      if (a.id === DEFAULT_TRAVELER_ID) return -1;
      if (b.id === DEFAULT_TRAVELER_ID) return 1;
    }
    return a.name.localeCompare(b.name);
  },
);

export const CHARACTER_BY_ID: Record<string, CharacterData> =
  Object.fromEntries(CHARACTER_KITS.map((c) => [c.id, c]));

export const CHARACTER_BY_NAME: Record<string, CharacterData> =
  Object.fromEntries(CHARACTER_KITS.map((c) => [c.name.toLowerCase(), c]));

export const ELEMENTS = [
  "Anemo",
  "Cryo",
  "Dendro",
  "Electro",
  "Geo",
  "Hydro",
  "Pyro",
] as const;

export const getCharacter = (id: string): CharacterData | undefined => {
  return CHARACTER_BY_ID[id];
};

export const getCharacterByName = (name: string): CharacterData | undefined => {
  return CHARACTER_BY_NAME[name.toLowerCase()];
};
