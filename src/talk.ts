// Talk folder layout and loading. Every path a stage reads or writes is built here.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { talkConfigProblems, sourcesProblems, type TalkConfig, type SourcesFile } from "./schema.js";

export class TalkError extends Error {}

export interface Talk {
  dir: string;
  config: TalkConfig;
}

export interface ChapterFile {
  lang: string;
  /** Two-digit chapter number, e.g. "01". */
  chapter: string;
  /** Absolute path to script/<lang>/NN-<name>.md. */
  file: string;
  name: string;
}

const CHAPTER_RE = /^(\d{2})-([A-Za-z0-9._-]+)\.md$/;

export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new TalkError(`cannot read ${path}: ${(e as Error).message}`);
  }
}

export function loadTalk(dir: string): Talk {
  const abs = resolve(dir);
  const file = join(abs, "talk.json");
  if (!existsSync(file)) throw new TalkError(`no talk.json in ${abs} (use --talk <path>)`);
  const config = readJson(file);
  const problems = talkConfigProblems(config);
  if (problems.length) throw new TalkError(problems.join("\n"));
  const music = (config as TalkConfig).music;
  const musicProblem = music ? musicFileProblem(abs, music.file) : null;
  if (musicProblem) throw new TalkError(musicProblem);
  return { dir: abs, config: config as TalkConfig };
}

/** The music file must exist as a file inside <talk>/assets/, after resolving symlinks. */
export function musicFileProblem(talkDir: string, file: string): string | null {
  let assets: string;
  let real: string;
  try {
    assets = realpathSync(join(talkDir, "assets"));
    real = realpathSync(resolve(talkDir, file));
  } catch {
    return `talk.json: music.file is missing: ${file}`;
  }
  const rel = relative(assets, real);
  const inside = rel !== "" && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\") && !isAbsolute(rel);
  if (!inside || !statSync(real).isFile()) return `talk.json: music.file must be a file inside the talk's assets/ folder (including symlink targets): ${file}`;
  return null;
}

export function loadSources(talk: Talk): SourcesFile {
  const file = join(talk.dir, "sources.json");
  if (!existsSync(file)) return { sources: [] };
  const v = readJson(file);
  const problems = sourcesProblems(v);
  if (problems.length) throw new TalkError(problems.join("\n"));
  return v as SourcesFile;
}

/** Normalise a --chapter value ("1", "01") to two digits. */
export function normaliseChapter(value: string): string {
  if (!/^\d{1,2}$/.test(value)) throw new TalkError(`--chapter must be a number, got "${value}"`);
  return value.padStart(2, "0");
}

export function listChapters(talk: Talk, lang: string): ChapterFile[] {
  const dir = join(talk.dir, "script", lang);
  if (!existsSync(dir)) return [];
  const out: ChapterFile[] = [];
  const seen = new Set<string>();
  for (const f of readdirSync(dir).sort()) {
    const m = CHAPTER_RE.exec(f);
    if (!m) continue;
    const chapter = m[1]!;
    if (seen.has(chapter)) throw new TalkError(`two script files for chapter ${chapter} in script/${lang}`);
    seen.add(chapter);
    out.push({ lang, chapter, file: join(dir, f), name: m[2]! });
  }
  return out;
}

export function selectChapters(talk: Talk, lang: string, chapter?: string): ChapterFile[] {
  const all = listChapters(talk, lang);
  if (chapter === undefined) return all;
  const nn = normaliseChapter(chapter);
  const hit = all.filter((c) => c.chapter === nn);
  if (hit.length === 0) throw new TalkError(`no script/${lang}/${nn}-*.md`);
  return hit;
}

export const paths = {
  /** Supplied (own mode) or synthesized (ai mode) narration. */
  sourceWav: (talk: Talk, lang: string, nn: string) => join(talk.dir, "audio", lang, `${nn}.wav`),
  /** Canonical narration the aligner and composer use (see CANONICAL_AUDIO). */
  narrationWav: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", "audio", lang, `${nn}.wav`),
  captions: (talk: Talk, lang: string, nn: string) => join(talk.dir, "captions", lang, `${nn}.json`),
  /** Raw helper output, kept for debugging and fixture capture. */
  whisperRaw: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", "whisper", lang, `${nn}.json`),
  spokenText: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", "text", lang, `${nn}.txt`),
  state: (talk: Talk) => join(talk.dir, "talk.state.json"),
  /** talk.json `music.file`, or null when the talk has no music bed. */
  music: (talk: Talk) => (talk.config.music ? resolve(talk.dir, talk.config.music.file) : null),
};
