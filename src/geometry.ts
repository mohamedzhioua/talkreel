import type { TalkConfig } from "./schema.js";

export type Resolution = TalkConfig["resolution"];

/** Screenshot viewport, excluding the frame's fixed chrome. No browser measurements. */
export function deviceViewport(g: Geometry, frame: string): { width: number; height: number } {
  const phone = frame === "phone";
  const ratio = phone ? 9 / 16 : 16 / 10;
  const height = Math.min(g.height - g.padding.top - g.padding.bottom - (phone ? 24 : 48),
    (g.width - g.padding.left - g.padding.right - (phone ? 24 : 16)) / ratio);
  return { width: height * ratio, height };
}

/** Focus an authored percentage coordinate in the centre of the screenshot viewport. */
export function deviceZoom(width: number, height: number, x: number, y: number, scale: number) {
  return { x: width * (0.5 - x / 100 * scale), y: height * (0.5 - y / 100 * scale), scale };
}

/** A gently curved quadratic path, expressed entirely in screenshot pixels. */
export function cursorPath(from: [number, number], to: [number, number]): [number, number][] {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  return [from, [(from[0] + to[0]) / 2 - dy * 0.12, (from[1] + to[1]) / 2 + dx * 0.12], to];
}

/** Full-width portrait content has only 7.2 px between the stage and the side UI zone. */
export function portraitCamera(camera: string) {
  const g = GEOMETRY.portrait;
  const margin = Math.min(g.padding.left, g.padding.right) - g.width * g.safeZones.sides;
  return camera === "push-in"
    ? { prop: "scale", from: 1, to: Math.min(1.04, 1 + 2 * margin / (g.width - g.padding.left - g.padding.right)) }
    : { prop: "x", from: Math.min(24, margin), to: -Math.min(24, margin) };
}

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
