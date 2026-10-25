// Current input hashes and freshness per chapter and stage. Shared by voice, align and status.
import { existsSync, readFileSync } from "node:fs";
import { sha256File } from "./hash.js";
import { alignmentModel } from "./audio-helper.js";
import { CANONICAL_AUDIO_ID } from "./ffmpeg.js";
import { buildPaths, COMPOSE_VERSION, packageVersion, sceneFile, sceneInputHash, themeHash } from "./compose.js";
import { parseScriptFile, spokenHash, type ParsedChapter } from "./script.js";
import { alignInputHash, chapterKey, concatInputHash, CTC_MODEL, renderInputHash, stageStatus, TTS_ENGINE, voiceInputHash, WHISPER_MODEL, type StageStatus } from "./state.js";
import { listChapters, loadSources, paths, type ChapterFile, type Talk } from "./talk.js";
import type { Source, TalkState } from "./schema.js";

export function voiceId(talk: Talk, lang: string): string {
  const v = talk.config.voice[lang];
  if (typeof v !== "string" || !v) throw new Error(`talk.json has no voice.${lang}`);
  return v;
}

/** TTS pace from talk.json; 1 when unset. */
export function voiceSpeed(talk: Talk): number {
  return talk.config.voice.speed ?? 1;
}

/** Voice input hash, or null when an own-voice recording is missing. */
export async function currentVoiceHash(talk: Talk, ch: ChapterFile, parsed: ParsedChapter): Promise<string | null> {
  if (talk.config.voice.mode === "own") {
    const src = paths.sourceWav(talk, ch.lang, ch.chapter);
    if (!existsSync(src)) return null;
    return voiceInputHash({ mode: "own", sourceWavHash: await sha256File(src), format: CANONICAL_AUDIO_ID });
  }
  const speed = voiceSpeed(talk);
  // Speed joins the hash only when set, so talks voiced before it existed stay fresh.
  return voiceInputHash({ mode: "ai", spokenHash: spokenHash(parsed), voice: voiceId(talk, ch.lang), engine: TTS_ENGINE, ...(speed !== 1 ? { speed } : {}) });
}

export function voiceOutputs(talk: Talk, ch: ChapterFile): string[] {
  const out = [paths.narrationWav(talk, ch.lang, ch.chapter)];
  if (talk.config.voice.mode === "ai") out.unshift(paths.sourceWav(talk, ch.lang, ch.chapter));
  return out;
}

/** Align input hash, or null when the canonical narration WAV does not exist yet. */
export async function currentAlignHash(talk: Talk, ch: ChapterFile, parsed: ParsedChapter, model?: string): Promise<string | null> {
  const wav = paths.narrationWav(talk, ch.lang, ch.chapter);
  if (!existsSync(wav)) return null;
  return alignInputHash({ wavHash: await sha256File(wav), spokenHash: spokenHash(parsed), model: model ?? await alignmentModel(ch.lang) });
}

/**
 * Align freshness for status and render. A failed engine probe makes align stale instead of
 * throwing. A recorded hash that matches the other Arabic engine names the engine change.
 */
async function alignStatus(talk: Talk, state: TalkState, ch: ChapterFile, parsed: ParsedChapter): Promise<StageStatus> {
  const key = chapterKey(ch.lang, ch.chapter);
  const outputs = [paths.captions(talk, ch.lang, ch.chapter)];
  const recorded = state.stages.align[key];
  // "never run" and "inputs missing" need no engine probe.
  if (!recorded || !existsSync(paths.narrationWav(talk, ch.lang, ch.chapter))) return stageStatus(state, "align", key, null, outputs);
  let model: string;
  try {
    model = await alignmentModel(ch.lang);
  } catch (e) {
    return { status: "stale", reason: `cannot probe alignment engine: ${(e as Error).message.replace(/\s+/g, " ").trim()}` };
  }
  const status = stageStatus(state, "align", key, await currentAlignHash(talk, ch, parsed, model), outputs);
  if (ch.lang !== "ar" || status.reason !== "inputs changed") return status;
  const other = model === CTC_MODEL ? WHISPER_MODEL : CTC_MODEL;
  if (recorded.hash !== (await currentAlignHash(talk, ch, parsed, other))) return status;
  return { status: "stale", reason: "alignment engine changed (arabic group installed/removed)" };
}

/** Quality of the last successful render of a chapter, or null when it was never rendered. */
export function lastRenderQuality(talk: Talk, ch: ChapterFile): string | null {
  const f = buildPaths.renderInfo(talk, ch.lang, ch.chapter);
  if (!existsSync(f)) return null;
  try {
    const v = JSON.parse(readFileSync(f, "utf8")) as { quality?: unknown };
    return typeof v.quality === "string" ? v.quality : null;
  } catch {
    return null;
  }
}

/**
 * Current render input hash for a chapter (renderInputHash in state.ts), or null when an input
 * is missing. `quality` defaults to the one the chapter was last rendered at.
 */
export async function currentRenderHash(talk: Talk, ch: ChapterFile, quality?: string): Promise<string | null> {
  const scene = sceneFile(talk, ch);
  const caps = paths.captions(talk, ch.lang, ch.chapter);
  const wav = paths.narrationWav(talk, ch.lang, ch.chapter);
  if (!existsSync(scene) || !existsSync(caps) || !existsSync(wav)) return null;
  let parsed: ParsedChapter;
  let sources: Map<string, Source>;
  try {
    parsed = parseScriptFile(ch.file);
    sources = new Map(loadSources(talk).sources.map((s) => [s.id, s]));
  } catch {
    return null;
  }
  let sceneHash: string;
  try {
    sceneHash = sceneInputHash(readFileSync(scene, "utf8"), parsed, sources, talk.dir);
  } catch {
    return null; // invalid or missing assets cannot produce a fresh render
  }
  return renderInputHash({
    sceneHash,
    captionsHash: await sha256File(caps),
    wavHash: await sha256File(wav),
    themeHash: await themeHash(talk),
    hyperframesVersion: packageVersion("hyperframes"),
    // The ambient layer changes the page (composeChapter), so it is a render input too.
    composeVersion: COMPOSE_VERSION + (talk.config.ambient ? "+ambient" : "") + (talk.config.resolution === "landscape" ? "" : `+${talk.config.resolution}`),
    quality: quality ?? lastRenderQuality(talk, ch) ?? "standard",
  });
}

/** Current concat input hash for a language (chapter MP4 hashes in order), or null. */
export async function currentConcatHash(talk: Talk, lang: string): Promise<string | null> {
  const chs = listChapters(talk, lang);
  if (!chs.length) return null;
  const hashes: string[] = [];
  for (const ch of chs) {
    const mp4 = buildPaths.mp4(talk, lang, ch.chapter);
    if (!existsSync(mp4)) return null;
    hashes.push(await sha256File(mp4));
  }
  return concatInputHash(hashes);
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
  let align = await alignStatus(talk, state, ch, parsed);
  if (voice.status === "stale" && align.status === "fresh") align = { status: "stale", reason: "voice is stale" };
  let render = stageStatus(state, "render", key, await currentRenderHash(talk, ch), [buildPaths.mp4(talk, ch.lang, ch.chapter)]);
  if (align.status === "stale" && render.status === "fresh") render = { status: "stale", reason: "align is stale" };
  return { lang: ch.lang, chapter: ch.chapter, title: parsed.title, script: ch.file, voice, align, render };
}
