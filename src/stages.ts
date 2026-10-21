// Current input hashes and freshness per chapter and stage. Shared by voice, align and status.
import { existsSync } from "node:fs";
import { sha256File } from "./hash.js";
import { CANONICAL_AUDIO_ID } from "./ffmpeg.js";
import { parseScriptFile, spokenHash, type ParsedChapter } from "./script.js";
import { alignInputHash, chapterKey, stageStatus, TTS_ENGINE, voiceInputHash, WHISPER_MODEL, type StageStatus } from "./state.js";
import { paths, type ChapterFile, type Talk } from "./talk.js";
import type { TalkState } from "./schema.js";

export function voiceId(talk: Talk, lang: string): string {
  const v = talk.config.voice[lang];
  if (!v) throw new Error(`talk.json has no voice.${lang}`);
  return v;
}

/** Voice input hash, or null when an own-voice recording is missing. */
export async function currentVoiceHash(talk: Talk, ch: ChapterFile, parsed: ParsedChapter): Promise<string | null> {
  if (talk.config.voice.mode === "own") {
    const src = paths.sourceWav(talk, ch.lang, ch.chapter);
    if (!existsSync(src)) return null;
    return voiceInputHash({ mode: "own", sourceWavHash: await sha256File(src), format: CANONICAL_AUDIO_ID });
  }
  return voiceInputHash({ mode: "ai", spokenHash: spokenHash(parsed), voice: voiceId(talk, ch.lang), engine: TTS_ENGINE });
}

export function voiceOutputs(talk: Talk, ch: ChapterFile): string[] {
  const out = [paths.narrationWav(talk, ch.lang, ch.chapter)];
  if (talk.config.voice.mode === "ai") out.unshift(paths.sourceWav(talk, ch.lang, ch.chapter));
  return out;
}

/** Align input hash, or null when the canonical narration WAV does not exist yet. */
export async function currentAlignHash(talk: Talk, ch: ChapterFile, parsed: ParsedChapter): Promise<string | null> {
  const wav = paths.narrationWav(talk, ch.lang, ch.chapter);
  if (!existsSync(wav)) return null;
  return alignInputHash({ wavHash: await sha256File(wav), spokenHash: spokenHash(parsed), model: WHISPER_MODEL });
}

/**
 * HOOK for the compose/render builder: return the current render input hash for a chapter
 * (see renderInputHash in state.ts), or null when an input is missing. Until it is filled,
 * status reports render as stale.
 */
export async function currentRenderHash(_talk: Talk, _ch: ChapterFile): Promise<string | null> {
  return null;
}

/** HOOK for the compose/render builder: current concat input hash for a language, or null. */
export async function currentConcatHash(_talk: Talk, _lang: string): Promise<string | null> {
  return null;
}

export interface ChapterStatus {
  lang: string;
  chapter: string;
  title: string;
  script: string;
  voice: StageStatus;
  align: StageStatus;
  render: StageStatus;
}

export async function chapterStatus(talk: Talk, state: TalkState, ch: ChapterFile): Promise<ChapterStatus> {
  const key = chapterKey(ch.lang, ch.chapter);
  let parsed: ParsedChapter;
  try {
    parsed = parseScriptFile(ch.file);
  } catch (e) {
    const bad: StageStatus = { status: "stale", reason: (e as Error).message };
    return { lang: ch.lang, chapter: ch.chapter, title: "", script: ch.file, voice: bad, align: bad, render: bad };
  }
  const voice = stageStatus(state, "voice", key, await currentVoiceHash(talk, ch, parsed), voiceOutputs(talk, ch));
  let align = stageStatus(state, "align", key, await currentAlignHash(talk, ch, parsed), [paths.captions(talk, ch.lang, ch.chapter)]);
  if (voice.status === "stale" && align.status === "fresh") align = { status: "stale", reason: "voice is stale" };
  let render = stageStatus(state, "render", key, await currentRenderHash(talk, ch));
  if (align.status === "stale" && render.status === "fresh") render = { status: "stale", reason: "align is stale" };
  return { lang: ch.lang, chapter: ch.chapter, title: parsed.title, script: ch.file, voice, align, render };
}
