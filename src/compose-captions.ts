// Caption lines for the composed page (scenes.md section 10, "Captions").
import type { CaptionWord } from "./schema.js";

export const CAPTION_MAX_CHARS = 48;
export const CAPTION_GAP_BREAK = 0.6;

export interface CaptionLine {
  /** Indices into the captions' words. */
  words: number[];
  text: string;
  /** Opacity 0 -> 1 over 0.1 s from this time. */
  show: number;
  /** Opacity -> 0 over 0.08 s from this time. */
  hide: number;
}

const SENTENCE_END = /[.?!:]["'”’»)\]]*$/;

/**
 * Greedy lines of at most 48 characters (spaces included). Always break after a word ending in
 * . ? ! or :, and before a word that starts more than 0.6 s after the previous word ended.
 */
export function captionLines(words: CaptionWord[], duration: number): CaptionLine[] {
  const groups: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  words.forEach((w, i) => {
    if (cur.length) {
      const prev = words[i - 1]!;
      if (w.start - prev.end > CAPTION_GAP_BREAK || len + 1 + w.text.length > CAPTION_MAX_CHARS) {
        groups.push(cur);
        cur = [];
        len = 0;
      }
    }
    len += (cur.length ? 1 : 0) + w.text.length;
    cur.push(i);
    if (SENTENCE_END.test(w.text)) {
      groups.push(cur);
      cur = [];
      len = 0;
    }
  });
  if (cur.length) groups.push(cur);

  const shows = groups.map((g) => Math.max(0, words[g[0]!]!.start - 0.05));
  return groups.map((g, j) => {
    const last = words[g[g.length - 1]!]!;
    const next = shows[j + 1];
    let hide = last.end + 0.3;
    if (next !== undefined && next < hide) hide = next;
    hide = Math.min(hide, duration);
    return { words: g, text: g.map((k) => words[k]!.text).join(" "), show: shows[j]!, hide };
  });
}
