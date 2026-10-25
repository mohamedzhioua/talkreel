// File formats for a talk folder, with hand-written type guards (no validator dependency).
// Every guard returns a list of problems; an empty list means the value is valid.

export type Lang = string;

export interface VoiceConfig {
  mode: "ai" | "own";
  /** TTS pace, 0.8..1.3 (default 1). Not a language key. */
  speed?: number;
  /** Voice id per language, e.g. { en: "af_heart", fr: "ff_siwis" }. */
  [lang: string]: string | number | undefined;
}

export const VOICE_SPEED_MIN = 0.8;
export const VOICE_SPEED_MAX = 1.3;

export interface TalkConfig {
  slug: string;
  title: string;
  languages: Lang[];
  voice: VoiceConfig;
  theme: string;
  fps: number;
  resolution: "landscape" | "portrait" | "square";
  /** Composer-owned background drift and chapter tag; off unless true. */
  ambient?: boolean;
  /** Music bed mixed under the narration by the mix stage; absent means no mix (M2 output). */
  music?: MusicConfig;
}

export interface MusicConfig {
  /** Talk-relative path under assets/, e.g. "assets/music/bed.mp3". */
  file: string;
  credit: string;
  license: string;
  /** Bed level before ducking, in dB (default MUSIC_GAIN_DB_DEFAULT). */
  gainDb?: number;
}

export const MUSIC_GAIN_DB_DEFAULT = -18;
export const MUSIC_GAIN_DB_MIN = -60;
export const MUSIC_GAIN_DB_MAX = 0;

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  quote: string;
  date: string;
}

export interface SourcesFile {
  sources: Source[];
}

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
  matched: boolean;
}

export interface CaptionsFile {
  lang: Lang;
  words: CaptionWord[];
}

/** One word as returned by the Python helper's `align` command. */
export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  prob?: number;
}

export interface WhisperResult {
  lang: Lang;
  model: string;
  duration: number;
  words: WhisperWord[];
}

export interface StageRecord {
  hash: string;
  updated: string;
}

export type StageName = "voice" | "align" | "render" | "concat" | "mix";

export interface TalkState {
  version: 1;
  /** Keyed by stage, then by "<lang>/<NN>" for chapter stages or "<lang>" for concat and mix. */
  stages: Record<StageName, Record<string, StageRecord>>;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
export const RESOLUTIONS = ["landscape", "portrait", "square"] as const;

type Problems = string[];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * A talk-relative music path must stay lexically inside assets/: no absolute path, drive letter,
 * backslash, control character or empty, "." or ".." segment. loadTalk checks the file itself.
 */
export function musicPathProblem(file: unknown): string | null {
  const ok = typeof file === "string" && file.startsWith("assets/") && !/[\\\u0000-\u001f\u007f]/.test(file) &&
    file.split("/").every((part) => part !== "" && part !== "." && part !== "..");
  return ok ? null : "talk.json: music.file must be a relative path under assets/ (no absolute path, backslash, or . or .. segments)";
}

function musicProblems(m: unknown): Problems {
  if (!isObject(m)) return ["talk.json: music must be an object {file, credit, license, gainDb?}"];
  const p: Problems = [];
  const path = musicPathProblem(m.file);
  if (path) p.push(path);
  if (!isNonEmptyString(m.credit)) p.push("talk.json: music.credit must be a non-empty string");
  if (!isNonEmptyString(m.license)) p.push("talk.json: music.license must be a non-empty string");
  if (m.gainDb !== undefined && (!isFiniteNumber(m.gainDb) || m.gainDb < MUSIC_GAIN_DB_MIN || m.gainDb > MUSIC_GAIN_DB_MAX)) {
    p.push(`talk.json: music.gainDb must be a number from ${MUSIC_GAIN_DB_MIN} to ${MUSIC_GAIN_DB_MAX} (dB)`);
  }
  return p;
}

export function talkConfigProblems(v: unknown): Problems {
  const p: Problems = [];
  if (!isObject(v)) return ["talk.json: expected an object"];
  if (!isNonEmptyString(v.slug) || !SLUG_RE.test(v.slug)) p.push("talk.json: slug must match " + SLUG_RE.source);
  if (!isNonEmptyString(v.title)) p.push("talk.json: title must be a non-empty string");
  if (!Array.isArray(v.languages) || v.languages.length === 0 || !v.languages.every(isNonEmptyString)) {
    p.push("talk.json: languages must be a non-empty array of strings");
  }
  if (!isObject(v.voice)) {
    p.push("talk.json: voice must be an object");
  } else {
    if (v.voice.mode !== "ai" && v.voice.mode !== "own") p.push('talk.json: voice.mode must be "ai" or "own"');
    for (const [k, val] of Object.entries(v.voice)) {
      if (k === "speed") {
        if (!isFiniteNumber(val) || val < VOICE_SPEED_MIN || val > VOICE_SPEED_MAX) p.push(`talk.json: voice.speed must be a number from ${VOICE_SPEED_MIN} to ${VOICE_SPEED_MAX}`);
      } else if (k !== "mode" && !isNonEmptyString(val)) p.push(`talk.json: voice.${k} must be a voice id string`);
    }
    if (v.voice.mode === "ai" && Array.isArray(v.languages)) {
      for (const lang of v.languages) {
        if (typeof lang === "string" && !isNonEmptyString(v.voice[lang])) p.push(`talk.json: voice.${lang} is required in ai mode`);
      }
    }
  }
  if (!isNonEmptyString(v.theme)) p.push("talk.json: theme must be a non-empty string");
  if (v.ambient !== undefined && typeof v.ambient !== "boolean") p.push("talk.json: ambient must be true or false");
  if (v.music !== undefined) p.push(...musicProblems(v.music));
  if (!isFiniteNumber(v.fps) || v.fps <= 0 || !Number.isInteger(v.fps)) p.push("talk.json: fps must be a positive integer");
  if (typeof v.resolution !== "string" || !(RESOLUTIONS as readonly string[]).includes(v.resolution)) {
    p.push("talk.json: resolution must be one of " + RESOLUTIONS.join(", "));
  }
  return p;
}

export function isTalkConfig(v: unknown): v is TalkConfig {
  return talkConfigProblems(v).length === 0;
}

const SOURCE_FIELDS = ["id", "title", "publisher", "url", "quote", "date"] as const;

export function sourcesProblems(v: unknown): Problems {
  if (!isObject(v) || !Array.isArray(v.sources)) return ["sources.json: expected { sources: [...] }"];
  const p: Problems = [];
  const seen = new Set<string>();
  v.sources.forEach((s, i) => {
    if (!isObject(s)) {
      p.push(`sources.json: sources[${i}] must be an object`);
      return;
    }
    for (const f of SOURCE_FIELDS) {
      if (!isNonEmptyString(s[f])) p.push(`sources.json: sources[${i}].${f} must be a non-empty string`);
    }
    if (typeof s.id === "string") {
      if (seen.has(s.id)) p.push(`sources.json: duplicate id "${s.id}"`);
      seen.add(s.id);
    }
  });
  return p;
}

export function isSourcesFile(v: unknown): v is SourcesFile {
  return sourcesProblems(v).length === 0;
}

export function captionsProblems(v: unknown): Problems {
  if (!isObject(v)) return ["captions: expected an object"];
  const p: Problems = [];
  if (!isNonEmptyString(v.lang)) p.push("captions: lang must be a non-empty string");
  if (!Array.isArray(v.words)) return [...p, "captions: words must be an array"];
  v.words.forEach((w, i) => {
    if (!isObject(w) || typeof w.text !== "string" || !isFiniteNumber(w.start) || !isFiniteNumber(w.end) || typeof w.matched !== "boolean") {
      p.push(`captions: words[${i}] must be {text, start, end, matched}`);
    } else if (w.end < w.start) {
      p.push(`captions: words[${i}] ends before it starts`);
    }
  });
  return p;
}

export function isCaptionsFile(v: unknown): v is CaptionsFile {
  return captionsProblems(v).length === 0;
}

export function isWhisperResult(v: unknown): v is WhisperResult {
  if (!isObject(v) || !isNonEmptyString(v.lang) || !isNonEmptyString(v.model) || !isFiniteNumber(v.duration)) return false;
  if (!Array.isArray(v.words)) return false;
  return v.words.every((w) => isObject(w) && typeof w.word === "string" && isFiniteNumber(w.start) && isFiniteNumber(w.end));
}

const STAGES: StageName[] = ["voice", "align", "render", "concat", "mix"];

export function isTalkState(v: unknown): v is TalkState {
  if (!isObject(v) || v.version !== 1 || !isObject(v.stages)) return false;
  const stages = v.stages;
  return STAGES.every((s) => {
    const recs = stages[s];
    if (recs === undefined) return true;
    if (!isObject(recs)) return false;
    return Object.values(recs).every((r) => isObject(r) && isNonEmptyString(r.hash) && typeof r.updated === "string");
  });
}

export function emptyState(): TalkState {
  return { version: 1, stages: { voice: {}, align: {}, render: {}, concat: {}, mix: {} } };
}
