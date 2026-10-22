// Map Whisper word timings onto the script's words.
//
// Captions keep the script's spelling; Whisper only supplies timing. The mapping is a global
// sequence alignment (Needleman-Wunsch style) over script words and Whisper words, compared on
// normalised tokens (lowercase, accents folded, punctuation and hyphens removed). Besides 1:1
// steps it allows one script word to cover up to MAX_GROUP Whisper words and the reverse, when
// their concatenations agree. That covers numbers ("2026" <-> "twenty twenty-six"), acronyms
// ("LLM" <-> "L L M") and identifiers ("talk.json" <-> "talk dot json"). Extra Whisper words are
// dropped; script words Whisper missed get times interpolated from their neighbours.
import { normToken } from "./text.js";
import type { CaptionWord, CaptionsFile, WhisperWord } from "./schema.js";

export const MIN_MATCHED = 0.8;
const MAX_GROUP = 4;
const MAX_FORMS = 64;

const SCORE_MATCH = 2;
const SCORE_NEAR = 1;
const SCORE_SUB = -1;
const SCORE_GAP = -1;

export class AlignError extends Error {
  constructor(message: string, readonly ratio: number) {
    super(message);
  }
}

// ---------- spoken forms of a token ----------

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under100(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t} ${ONES[n % 10]}` : t;
}

function under1000(n: number, and: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return under100(r);
  const head = `${ONES[h]} hundred`;
  return r ? `${head}${and ? " and" : ""} ${under100(r)}` : head;
}

/** English cardinal for 0 <= n < 1e12, with or without the British "and". */
export function cardinal(n: number, and = false): string {
  if (n === 0) return "zero";
  const scales: [number, string][] = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${under1000(Math.floor(rest / size), and)} ${name}`);
      rest %= size;
    }
  }
  if (rest) parts.push(parts.length && and && rest < 100 ? `and ${under100(rest)}` : under1000(rest, and));
  return parts.join(" ");
}

function yearForms(n: number): string[] {
  if (n < 1000 || n > 9999) return [];
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (lo === 0) return [`${under100(hi)} hundred`];
  if (lo < 10) return [`${under100(hi)} oh ${ONES[lo]}`, `${under100(hi)} o ${ONES[lo]}`];
  return [`${under100(hi)} ${under100(lo)}`];
}

function numberForms(raw: string): string[] {
  const t = raw.replace(/[“”"'()\[\];:!?]/g, "").replace(/[.,]+$/, "");
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(%)?$/.exec(t);
  if (!m) return [];
  const intStr = m[1]!.replace(/,/g, "");
  if (intStr.length > 12) return [];
  const n = Number(intStr);
  let heads = [cardinal(n), cardinal(n, true)];
  if (!m[2] && !m[3] && !m[1]!.includes(",") && intStr.length === 4) heads = heads.concat(yearForms(n));
  if (m[2]) {
    const digits = [...m[2]].map((d) => ONES[Number(d)]!).join(" ");
    heads = heads.map((h) => `${h} point ${digits}`);
  }
  if (m[3]) heads = heads.map((h) => `${h} percent`);
  return heads;
}

/** All normalised spoken forms one token may take. */
export function tokenForms(raw: string): string[] {
  const forms = new Set<string>();
  const base = normToken(raw);
  if (base) forms.add(base);
  for (const f of numberForms(raw)) forms.add(normToken(f));
  if (/[\p{L}\p{N}][./][\p{L}\p{N}]/u.test(raw)) {
    forms.add(normToken(raw.replace(/\./g, " dot ").replace(/\//g, " slash ")));
  }
  return [...forms];
}

function concatForms(groups: string[][]): Set<string> {
  let acc: string[] = [""];
  for (const g of groups) {
    const next: string[] = [];
    for (const a of acc) for (const f of g) if (next.length < MAX_FORMS) next.push(a + f);
    acc = next;
  }
  return new Set(acc);
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (x && b.has(x)) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Near match: a spelling variant (plural, accent, one-letter slip) of a word of 4+ letters. */
function isNear(a: string, b: string): boolean {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  if (Math.min(a.length, b.length) < 4) return false;
  return 1 - levenshtein(a, b) / len >= 0.8;
}

// ---------- alignment ----------

type Step =
  | { kind: "del" } // script word with no Whisper word
  | { kind: "ins" } // Whisper word with no script word
  | { kind: "pair"; s: number; w: number; score: number }; // s script words <-> w Whisper words

export interface AlignResult {
  /** One entry per script word, in script order, with the script's spelling. */
  words: CaptionWord[];
  matched: number;
  total: number;
  ratio: number;
}

export interface AlignOptions {
  /** Audio duration, used to bound interpolation after the last heard word. */
  duration?: number;
}

const round = (t: number) => Math.round(t * 1000) / 1000;

export function alignWords(scriptWords: string[], heard: WhisperWord[], opts: AlignOptions = {}): AlignResult {
  const n = scriptWords.length;
  const m = heard.length;
  if (n === 0) return { words: [], matched: 0, total: 0, ratio: 0 };

  const sForms = scriptWords.map(tokenForms);
  const wForms = heard.map((w) => tokenForms(w.word));
  const sNorm = scriptWords.map(normToken);
  const wNorm = heard.map((w) => normToken(w.word));

  // groupForms[i][k-1] = forms of the k tokens ending at index i (inclusive), 1-based i.
  const groups = (forms: string[][]) =>
    forms.map((_, i) => {
      const out: Set<string>[] = [];
      for (let k = 1; k <= MAX_GROUP && i - k + 1 >= 0; k++) out.push(concatForms(forms.slice(i - k + 1, i + 1)));
      return out;
    });
  const sGroups = groups(sForms);
  const wGroups = groups(wForms);

  const W = m + 1;
  const score = new Float64Array((n + 1) * W);
  const back: Step[] = new Array((n + 1) * W);
  for (let i = 1; i <= n; i++) {
    score[i * W] = i * SCORE_GAP;
    back[i * W] = { kind: "del" };
  }
  for (let j = 1; j <= m; j++) {
    score[j] = j * SCORE_GAP;
    back[j] = { kind: "ins" };
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = score[(i - 1) * W + j]! + SCORE_GAP;
      let step: Step = { kind: "del" };
      const ins = score[i * W + j - 1]! + SCORE_GAP;
      if (ins > best) {
        best = ins;
        step = { kind: "ins" };
      }
      // 1:1
      const one = sGroups[i - 1]![0]!;
      const oneW = wGroups[j - 1]![0]!;
      const pairScore = intersects(one, oneW) ? SCORE_MATCH : isNear(sNorm[i - 1]!, wNorm[j - 1]!) ? SCORE_NEAR : SCORE_SUB;
      const diag = score[(i - 1) * W + j - 1]! + pairScore;
      if (diag > best) {
        best = diag;
        step = { kind: "pair", s: 1, w: 1, score: pairScore };
      }
      // 1:k and k:1 groups, only when the concatenations agree.
      for (let k = 2; k <= MAX_GROUP; k++) {
        if (j - k >= 0) {
          const g = wGroups[j - 1]![k - 1];
          if (g && intersects(one, g)) {
            const v = score[(i - 1) * W + j - k]! + SCORE_MATCH;
            if (v > best) {
              best = v;
              step = { kind: "pair", s: 1, w: k, score: SCORE_MATCH };
            }
          }
        }
        if (i - k >= 0) {
          const g = sGroups[i - 1]![k - 1];
          if (g && intersects(g, oneW)) {
            const v = score[(i - k) * W + j - 1]! + SCORE_MATCH * k;
            if (v > best) {
              best = v;
              step = { kind: "pair", s: k, w: 1, score: SCORE_MATCH };
            }
          }
        }
      }
      score[i * W + j] = best;
      back[i * W + j] = step;
    }
  }

  // Backtrace into per-script-word timing.
  const out: (CaptionWord | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i * W + j]!;
    if (step.kind === "del") {
      i -= 1;
    } else if (step.kind === "ins") {
      j -= 1;
    } else {
      const matched = step.score > 0;
      const first = heard[j - step.w]!;
      const last = heard[j - 1]!;
      if (step.s === 1) {
        out[i - 1] = { text: scriptWords[i - 1]!, start: first.start, end: last.end, matched };
      } else {
        // k script words share one Whisper word: split its span by spoken length.
        const idx = Array.from({ length: step.s }, (_, q) => i - step.s + q);
        const weights = idx.map((q) => Math.max(1, sNorm[q]!.length));
        const total = weights.reduce((a, b) => a + b, 0);
        let t = first.start;
        idx.forEach((q, r) => {
          const d = ((last.end - first.start) * weights[r]!) / total;
          out[q] = { text: scriptWords[q]!, start: t, end: t + d, matched };
          t += d;
        });
      }
      i -= step.s;
      j -= step.w;
    }
  }

  // Interpolate the script words Whisper missed.
  const tail = Math.max(opts.duration ?? 0, heard.length ? heard[heard.length - 1]!.end : 0);
  let q = 0;
  while (q < n) {
    if (out[q]) {
      q++;
      continue;
    }
    let r = q;
    while (r < n && !out[r]) r++;
    const lo = q > 0 ? out[q - 1]!.end : 0;
    const hiRaw = r < n ? out[r]!.start : tail;
    const hi = Math.max(lo, hiRaw);
    const weights = scriptWords.slice(q, r).map((w) => Math.max(1, normToken(w).length));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = lo;
    for (let x = q; x < r; x++) {
      const d = ((hi - lo) * weights[x - q]!) / total;
      out[x] = { text: scriptWords[x]!, start: t, end: t + d, matched: false };
      t += d;
    }
    q = r;
  }

  // Keep times monotonic and rounded.
  let floor = 0;
  const words = out.map((w) => {
    const start = round(Math.max(floor, w!.start));
    const end = round(Math.max(start, w!.end));
    floor = start;
    return { ...w!, start, end };
  });
  const matched = words.filter((w) => w.matched).length;
  return { words, matched, total: n, ratio: matched / n };
}

/** Build the captions file for one chapter, failing below MIN_MATCHED. */
export function buildCaptions(lang: string, scriptWords: string[], heard: WhisperWord[], opts: AlignOptions = {}): CaptionsFile {
  if (scriptWords.length === 0) throw new AlignError("the chapter has no spoken words", 0);
  const res = alignWords(scriptWords, heard, opts);
  if (res.ratio < MIN_MATCHED) {
    const pct = (res.ratio * 100).toFixed(1);
    throw new AlignError(
      `only ${res.matched} of ${res.total} script words (${pct}%) matched the audio; need ${MIN_MATCHED * 100}%. ` +
        "Does the recording follow the script?",
      res.ratio,
    );
  }
  return { lang, words: res.words };
}
