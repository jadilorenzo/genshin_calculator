import type { TimingMode } from "./fieldTimings";
import {
  DEFAULT_HUMAN_LAG,
  DEFAULT_TIMING_MODE,
  clampHumanLag,
  parseTimingMode,
} from "./fieldTimings";
import { DEFAULT_SWITCH_BUFFER, clampSwitchBuffer } from "./timelineContinuous";
import type { TimelinePlacement } from "./types";

export const ROTATION_DOC_KEY = "gc:rotations:doc";

const LEGACY_PLACEMENTS_KEY = "gc:rotations:placements";
const LEGACY_SWITCH_BUFFER_KEY = "gc:rotations:switchBuffer";
const LEGACY_TIMING_MODE_KEY = "gc:rotations:timingMode";
const LEGACY_HUMAN_LAG_KEY = "gc:rotations:humanLag";

/** Full undoable / persisted state for the Rotations page. */
export interface RotationDoc {
  placements: TimelinePlacement[];
  switchBuffer: number;
  timingMode: TimingMode;
  humanLag: number;
}

export const defaultRotationDoc = (): RotationDoc => {
  return {
    placements: [],
    switchBuffer: DEFAULT_SWITCH_BUFFER,
    timingMode: DEFAULT_TIMING_MODE,
    humanLag: DEFAULT_HUMAN_LAG,
  };
};

const readLegacyJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeDoc = (
  raw: Partial<RotationDoc> | null | undefined,
): RotationDoc => {
  const base = defaultRotationDoc();
  if (!raw || typeof raw !== "object") return base;
  return {
    placements: Array.isArray(raw.placements)
      ? raw.placements
      : base.placements,
    switchBuffer: clampSwitchBuffer(
      typeof raw.switchBuffer === "number"
        ? raw.switchBuffer
        : base.switchBuffer,
    ),
    timingMode: parseTimingMode(raw.timingMode ?? base.timingMode),
    humanLag: clampHumanLag(
      typeof raw.humanLag === "number" ? raw.humanLag : base.humanLag,
    ),
  };
};

/** Load unified doc, migrating older per-field localStorage keys when needed. */
export const loadRotationDoc = (): RotationDoc => {
  try {
    const raw = localStorage.getItem(ROTATION_DOC_KEY);
    if (raw != null)
      return normalizeDoc(JSON.parse(raw) as Partial<RotationDoc>);
  } catch {
    // fall through to legacy
  }

  return normalizeDoc({
    placements: readLegacyJson(LEGACY_PLACEMENTS_KEY, []),
    switchBuffer: readLegacyJson(
      LEGACY_SWITCH_BUFFER_KEY,
      DEFAULT_SWITCH_BUFFER,
    ),
    timingMode: readLegacyJson(LEGACY_TIMING_MODE_KEY, DEFAULT_TIMING_MODE),
    humanLag: readLegacyJson(LEGACY_HUMAN_LAG_KEY, DEFAULT_HUMAN_LAG),
  });
};
