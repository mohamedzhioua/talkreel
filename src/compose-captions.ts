// Caption lines for the composed page (scenes.md section 10, "Captions").
import type { CaptionWord } from "./schema.js";

export const CAPTION_MAX_CHARS = 48;
/** Hard cap for a line that absorbs a lone word it could not be balanced with (theme.css: 1600 px at 52 px). */
export const CAPTION_ABSORB_MAX_CHARS = 54;
export const CAPTION_GAP_BREAK = 0.6;
/** The runtime's line fade-out duration (src/compose-runtime.ts). */
export const CAPTION_HIDE_FADE = 0.08;

export interface CaptionLine {
  /** Indices into the captions' words. */
  words: number[];
  text: string;
  /** Opacity 0 -> 1 over 0.1 s from this time. */
  show: number;
  /** Opacity -> 0 over 0.08 s from this time; that fade ends by the next line's show. */
  hide: number;
}

const CLOSE = `["'”’»)\\]]*$`;
const SENTENCE_END = new RegExp(`[.?!]${CLOSE}`);
const CLAUSE_END = new RegExp(`[,;:]${CLOSE}`);
/** A line never ends on one of these (a bare word, no punctuation). */
export const CAPTION_FUNCTION_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "toward", "for", "with", "in", "on",
  "this", "that", "its", "it", "what", "while", "their", "our", "your", "my",
  "is", "are", "be", "by", "from", "as", "at", "into", "than",
]);
/** A line this short inside a multi-line segment is a fragment ("My rule:"). */
const FRAGMENT_CHARS = 14;

/** A word that ends a hyphenated compound split by the script ("human-" then "owned"). */
const COMPOUND_OPEN = /[A-Za-z0-9]-$/;
/** A word that continues one ("-owned"). */
const COMPOUND_CLOSE = /^-[A-Za-z0-9]/;

const COST = { line: 20, slack: 100, clause: 0.35, functionWord: 500, fragment: 300, orphan: 1000, overflow: 800, compound: 100000 };

/**
 * Lines of at most 48 characters (spaces included). Always break after a word ending in . ? or !
 * and before a word that starts more than 0.6 s after the previous word ended. Inside such a
 * segment the breaks minimise a fixed cost: fill lines, prefer breaking after , ; or :, never end
 * a line on a function word, never split a hyphenated compound ("human-owned" is one word and
 * never breaks; a compound written across words never breaks at its hyphen), avoid short
 * fragments and a lone last word. A line may reach 54 characters only when that is the cheapest
 * way to avoid a lone word.
 */
export function captionLines(words: CaptionWord[], duration: number): CaptionLine[] {
  const groups: number[][] = [];
  let seg = 0;
  words.forEach((w, i) => {
    const next = words[i + 1];
    if (!next || SENTENCE_END.test(w.text) || next.start - w.end > CAPTION_GAP_BREAK) {
      groups.push(...breakSegment(words, seg, i + 1));
      seg = i + 1;
    }
  });

  const shows = groups.map((g) => Math.max(0, words[g[0]!]!.start - 0.05));
  return groups.map((g, j) => {
    const last = words[g[g.length - 1]!]!;
    const next = shows[j + 1];
    let hide = last.end + 0.3;
    // Fade out fully before the next line fades in: never two lines on screen at once.
    if (next !== undefined) hide = Math.min(hide, Math.max(shows[j]!, next - CAPTION_HIDE_FADE));
    hide = Math.min(hide, duration);
    return { words: g, text: g.map((k) => words[k]!.text).join(" "), show: shows[j]!, hide };
  });
}

/** Cheapest breaks for words[from, to), by deterministic dynamic programming. */
function breakSegment(words: CaptionWord[], from: number, to: number): number[][] {
  const n = to - from;
  const best: number[] = new Array<number>(n + 1).fill(Infinity);
  const prev: number[] = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    let len = -1;
    for (let i = j - 1; i >= 0; i--) {
      len += 1 + words[from + i]!.text.length;
      // A single word longer than the cap still gets its own line.
      if (len > CAPTION_ABSORB_MAX_CHARS && i < j - 1) break;
      const c = best[i]! + lineCost(words, from + i, from + j, len, i === 0 && j === n, j === n);
      if (c < best[j]!) {
        best[j] = c;
        prev[j] = i;
      }
    }
  }
  const out: number[][] = [];
  for (let j = n; j > 0; j = prev[j]!) {
    const g: number[] = [];
    for (let k = from + prev[j]!; k < from + j; k++) g.push(k);
    out.unshift(g);
  }
  return out;
}

function lineCost(words: CaptionWord[], a: number, b: number, len: number, whole: boolean, lastLine: boolean): number {
  if (whole) return len > CAPTION_MAX_CHARS ? COST.overflow : 0;
  const end = words[b - 1]!.text;
  let c = COST.line;
  if (len > CAPTION_MAX_CHARS) c += COST.overflow;
  if (!lastLine) {
    const slack = Math.max(0, CAPTION_MAX_CHARS - len) / CAPTION_MAX_CHARS;
    c += COST.slack * slack * slack * (CLAUSE_END.test(end) ? COST.clause : 1);
    if (CAPTION_FUNCTION_WORDS.has(end.toLowerCase())) c += COST.functionWord;
    if (COMPOUND_OPEN.test(end) || COMPOUND_CLOSE.test(words[b]?.text ?? "")) c += COST.compound;
  }
  if (b - a === 1 && lastLine) c += COST.orphan;
  else if (len < FRAGMENT_CHARS) c += COST.fragment;
  return c;
}
