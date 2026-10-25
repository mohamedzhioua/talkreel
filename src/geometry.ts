import type { TalkConfig } from "./schema.js";

export type Resolution = TalkConfig["resolution"];

export interface Geometry {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  caption: { width: number; height: number; bottom: number; fontSize: number; maxChars: number; absorbMaxChars: number };
  terminal: { maxChars: number; rowHeight: number; maxRows: number };
  /** Fractions of the canvas reserved for platform UI (review overlays only). */
  safeZones: { top: number; bottom: number; sides: number };
}

/** All composer layout limits, in canvas pixels. Landscape preserves the M2 geometry. */
export const GEOMETRY = {
  landscape: {
    width: 1920, height: 1080,
    padding: { top: 72, right: 120, bottom: 208, left: 120 },
    caption: { width: 1600, height: 160, bottom: 0, fontSize: 52, maxChars: 48, absorbMaxChars: 54 },
    terminal: { maxChars: 72, rowHeight: 40, maxRows: 13 },
    safeZones: { top: 0.14, bottom: 0.35, sides: 0.06 },
  },
  portrait: {
    width: 1080, height: 1920,
    padding: { top: 340, right: 72, bottom: 872, left: 72 },
    // 24 px above the bottom UI zone; 32 characters leave room for four Arabic words.
    caption: { width: 936, height: 160, bottom: 696, fontSize: 40, maxChars: 32, absorbMaxChars: 36 },
    terminal: { maxChars: 42, rowHeight: 40, maxRows: 12 },
    safeZones: { top: 0.14, bottom: 0.35, sides: 0.06 },
  },
  square: {
    width: 1080, height: 1080,
    padding: { top: 96, right: 72, bottom: 236, left: 72 },
    caption: { width: 936, height: 160, bottom: 24, fontSize: 40, maxChars: 32, absorbMaxChars: 36 },
    terminal: { maxChars: 42, rowHeight: 40, maxRows: 13 },
    safeZones: { top: 0.14, bottom: 0.35, sides: 0.06 },
  },
} as const satisfies Record<Resolution, Geometry>;
