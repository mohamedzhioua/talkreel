// talk.state.json: per-stage input hashes. A stage is stale when the hash of its current
// inputs differs from the one recorded when it last ran (or its output is missing).
//
// Stage inputs (design, "Stale inputs"):
//   voice  - spoken text, voice id, engine version (own mode: the supplied WAV is the root input)
//   align  - WAV hash, spoken text, model
//   render - scene, captions, WAV, theme, HyperFrames version, compose version, quality
//   concat - ordered chapter MP4 hashes (+ music: true when the mix stage follows)
//   mix    - concat MP4 hash, music sha256 and gain, mix params
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
export const CTC_MODEL = "ctc:af46c2d8531b8dcbb5e23b952f739b372c2e5d2d";

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
  // A talk that never mixed keeps its M2 state bytes: an empty mix stage is not written.
  const { mix, ...m2 } = state.stages;
  const out = Object.keys(mix).length ? state : { ...state, stages: m2 };
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n", "utf8");
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
  | { mode: "ai"; spokenHash: string; voice: string; engine: string; speed?: number }
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

/**
 * Concat input: chapter MP4 hashes in chapter order. `music` (talk.json has a music bed) moves the
 * output to build/<lang>/concat.mp4; without it the hash bytes are exactly M2's.
 */
export function concatInputHash(orderedChapterMp4Hashes: string[], music = false): string {
  return hashJson({ stage: "concat", chapters: orderedChapterMp4Hashes, ...(music ? { music: true } : {}) });
}

export interface MixInputs {
  /** sha256 of build/<lang>/concat.mp4. */
  concatHash: string;
  /** The bed; absent for a loudness-only mix. */
  music?: { sha256: string; gainDb: number };
  /** Filter and encoder parameters (MIX_PARAMS). */
  params: Readonly<Record<string, unknown>>;
}

/** Mix input: no chapter input, so a music change never re-renders chapters. */
export function mixInputHash(i: MixInputs): string {
  return hashJson({ stage: "mix", ...i });
}
