// talk.state.json: per-stage input hashes. A stage is stale when the hash of its current
// inputs differs from the one recorded when it last ran (or its output is missing).
//
// Stage inputs (design, "Stale inputs"):
//   voice  - spoken text, voice id, engine version (own mode: the supplied WAV is the root input)
//   align  - WAV hash, spoken text, model
//   render - scene, captions, WAV, theme, HyperFrames version, compose version, quality
//   concat - ordered chapter MP4 hashes
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { hashJson } from "./hash.js";
import { emptyState, isTalkState, type StageName, type TalkState } from "./schema.js";

export type Freshness = "fresh" | "stale";

export interface StageStatus {
  status: Freshness;
  reason?: string;
}

/** Engine id recorded in the voice hash; bump when the TTS engine or its model files change. */
export const TTS_ENGINE = "kokoro-onnx/kokoro-v1.0";
export const WHISPER_MODEL = "small";

export function chapterKey(lang: string, chapter: string): string {
  return `${lang}/${chapter}`;
}

export function readState(file: string): TalkState {
  if (!existsSync(file)) return emptyState();
  let v: unknown;
  try {
    v = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return emptyState();
  }
  if (!isTalkState(v)) return emptyState();
  const s = emptyState();
  for (const k of Object.keys(s.stages) as StageName[]) Object.assign(s.stages[k], v.stages[k] ?? {});
  return s;
}

export function writeState(file: string, state: TalkState): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, file);
}

export function recordStage(state: TalkState, stage: StageName, key: string, hash: string, now = new Date()): void {
  state.stages[stage][key] = { hash, updated: now.toISOString() };
}

/**
 * Compare a stage's current input hash with the recorded one.
 * `outputs` are files the stage must have produced; a missing one makes it stale.
 */
export function stageStatus(state: TalkState, stage: StageName, key: string, currentHash: string | null, outputs: string[] = []): StageStatus {
  const rec = state.stages[stage][key];
  if (!rec) return { status: "stale", reason: "never run" };
  if (currentHash === null) return { status: "stale", reason: "inputs missing" };
  if (rec.hash !== currentHash) return { status: "stale", reason: "inputs changed" };
  const missing = outputs.find((f) => !existsSync(f));
  if (missing) return { status: "stale", reason: `output missing: ${missing}` };
  return { status: "fresh" };
}

// ---------- input hashes, one function per stage ----------

export type VoiceInputs =
  | { mode: "ai"; spokenHash: string; voice: string; engine: string }
  | { mode: "own"; sourceWavHash: string; format: string };

export function voiceInputHash(i: VoiceInputs): string {
  return hashJson({ stage: "voice", ...i });
}

export interface AlignInputs {
  wavHash: string;
  spokenHash: string;
  model: string;
}

export function alignInputHash(i: AlignInputs): string {
  return hashJson({ stage: "align", ...i });
}

export interface RenderInputs {
  sceneHash: string;
  captionsHash: string;
  wavHash: string;
  themeHash: string;
  hyperframesVersion: string;
  composeVersion: string;
  quality: string;
}

export function renderInputHash(i: RenderInputs): string {
  return hashJson({ stage: "render", ...i });
}

/** Concat input: chapter MP4 hashes in chapter order. */
export function concatInputHash(orderedChapterMp4Hashes: string[]): string {
  return hashJson({ stage: "concat", chapters: orderedChapterMp4Hashes });
}
