// Chapter script parsing: one markdown file is one chapter.
//
// Format: the first non-blank line is "# Chapter title". The rest is narration paragraphs that
// may contain [s:id] citation markers (also [s:a, b]) and {#cue-name} cue markers. Headings,
// markdown emphasis, links, code fences, HTML comments and all markers are stripped before TTS
// and alignment, and the spoken-text hash covers only what is left.
import { readFileSync } from "node:fs";
import { normToken } from "./text.js";
import { sha256 } from "./hash.js";

export class ScriptError extends Error {}

export interface Marker {
  /** Cue name or source id. */
  id: string;
  /**
   * Index into `words` of the first spoken word after the marker. A marker after the last
   * word gets `words.length`; use `cueWordIndex` to clamp it for timing.
   */
  wordIndex: number;
  /** 1-based line number in the script file. */
  line: number;
}

export interface ParsedChapter {
  title: string;
  /** Spoken words in order, with the script's spelling and punctuation. */
  words: string[];
  /** Text sent to TTS: paragraphs joined by a blank line, words by one space. */
  spokenText: string;
  cues: Marker[];
  citations: Marker[];
}

const CITE_RE = /\[s:([^\]]+)\]/g;
const CUE_RE = /\{#([A-Za-z0-9][A-Za-z0-9_-]*)\}/g;
const MARKER_RE = /\[s:([^\]]+)\]|\{#([A-Za-z0-9][A-Za-z0-9_-]*)\}/g;

/** Strip inline markdown that is never spoken, keeping the words. */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[(?!s:)([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)[*_]+(?=\S)/g, "$1")
    .replace(/(\S)[*_]+(?=\s|$|[.,;:!?)])/g, "$1");
}

/** Strip block-level markers at the start of a line (lists, quotes). */
function stripLinePrefix(line: string): string {
  return line.replace(/^\s*(?:>\s*)+/, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
}

export function parseScript(source: string): ParsedChapter {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  const first = lines[i];
  const titleMatch = first === undefined ? null : /^#\s+(.+?)\s*#*\s*$/.exec(first);
  if (!titleMatch) throw new ScriptError('the first line must be a "# Chapter title" heading');
  const title = titleMatch[1]!.replace(CITE_RE, "").replace(CUE_RE, "").trim();

  // Collect paragraphs as lists of (text, line) segments.
  const paragraphs: { text: string; line: number }[][] = [];
  let current: { text: string; line: number }[] = [];
  let inFence = false;
  let inComment = false;
  const flush = () => {
    if (current.length) paragraphs.push(current);
    current = [];
  };
  for (let n = i + 1; n < lines.length; n++) {
    let line = lines[n]!;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      flush();
      continue;
    }
    if (inFence) continue;
    if (inComment) {
      const end = line.indexOf("-->");
      if (end < 0) continue;
      line = line.slice(end + 3);
      inComment = false;
    }
    const open = line.lastIndexOf("<!--");
    if (open >= 0 && line.indexOf("-->", open) < 0) {
      line = line.slice(0, open);
      inComment = true;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^\s*#{1,6}\s/.test(line)) {
      flush();
      continue;
    }
    current.push({ text: stripInlineMarkdown(stripLinePrefix(line)), line: n + 1 });
  }
  flush();

  const words: string[] = [];
  const cues: Marker[] = [];
  const citations: Marker[] = [];
  const paraTexts: string[] = [];

  for (const para of paragraphs) {
    const paraStart = words.length;
    for (const seg of para) {
      // Remove markers in place, remembering where each one was in the cleaned string.
      let cleaned = "";
      let last = 0;
      const markers: { offset: number; cue?: string; cite?: string }[] = [];
      for (const m of seg.text.matchAll(MARKER_RE)) {
        cleaned += seg.text.slice(last, m.index);
        if (m[1] !== undefined) markers.push({ offset: cleaned.length, cite: m[1] });
        else markers.push({ offset: cleaned.length, cue: m[2]! });
        last = m.index + m[0].length;
      }
      cleaned += seg.text.slice(last);

      // Tokenise; a token with nothing speakable (a lone dash, a stray dot) joins the previous word.
      const starts: number[] = [];
      for (const t of cleaned.matchAll(/\S+/g)) {
        const tok = t[0];
        if (normToken(tok) === "" && words.length > paraStart) {
          const prev = words.length - 1;
          // "claim [s:x]." -> "claim."; "design —" stays "design —".
          words[prev] = words[prev] + (/^[.,;:!?)"'»]+$/.test(tok) ? "" : " ") + tok;
          continue;
        }
        if (normToken(tok) === "") continue;
        starts.push(t.index);
        words.push(tok);
      }
      const segBase = words.length - starts.length;
      for (const mk of markers) {
        const before = starts.filter((s) => s < mk.offset).length;
        const marker: Omit<Marker, "id"> = { wordIndex: segBase + before, line: seg.line };
        if (mk.cue !== undefined) cues.push({ id: mk.cue, ...marker });
        else for (const id of mk.cite!.split(",").map((s) => s.trim()).filter(Boolean)) citations.push({ id, ...marker });
      }
    }
    if (words.length > paraStart) paraTexts.push(words.slice(paraStart).join(" "));
  }

  return { title, words, spokenText: paraTexts.join("\n\n"), cues, citations };
}

export function parseScriptFile(file: string): ParsedChapter {
  try {
    return parseScript(readFileSync(file, "utf8"));
  } catch (e) {
    if (e instanceof ScriptError) throw new ScriptError(`${file}: ${e.message}`);
    throw e;
  }
}

/** Hash of the spoken text only, so editing a citation or cue never re-voices a chapter. */
export function spokenHash(ch: ParsedChapter): string {
  return sha256(ch.spokenText);
}

/** Word index whose start time a cue resolves to, clamped to the last word. */
export function cueWordIndex(ch: ParsedChapter, cue: Marker): number {
  return Math.max(0, Math.min(cue.wordIndex, ch.words.length - 1));
}
