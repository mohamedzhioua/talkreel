import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { buildPaths, composeChapter } from "../compose.js";
import { chaptersTxt, concatMp4, outPaths, probeDuration, transcriptMd } from "../compose-concat.js";
import { hfCheck, hfRender, HYPERFRAMES_VERSION, installedHyperframesVersion, isQuality, type Quality } from "../compose-hyperframes.js";
import { SceneError } from "../compose-scene.js";
import { parseScriptFile } from "../script.js";
import { chapterStatus, currentConcatHash, currentRenderHash, lastRenderQuality } from "../stages.js";
import { chapterKey, readState, recordStage, stageStatus, writeState } from "../state.js";
import { listChapters, paths, selectChapters, type ChapterFile, type Talk } from "../talk.js";
import type { TalkState } from "../schema.js";

export interface RenderOptions {
  lang: string;
  chapter?: string;
  quality: string;
  telemetry: boolean;
}

export interface StaleRender {
  ch: ChapterFile;
  hash: string | null;
  reason: string;
}

function tail(s: string, n = 25): string {
  return s.trim().split(/\r?\n/).slice(-n).join("\n");
}

function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
}

/**
 * Chapters whose render is stale, with the reason, in chapter order. `quality` is the quality
 * about to be rendered; omit it to judge each chapter by the quality it was last rendered at.
 */
export async function staleRenders(talk: Talk, state: TalkState, chapters: ChapterFile[], quality?: string): Promise<StaleRender[]> {
  const out: StaleRender[] = [];
  for (const ch of chapters) {
    const hash = await currentRenderHash(talk, ch, quality);
    const s = stageStatus(state, "render", chapterKey(ch.lang, ch.chapter), hash, [buildPaths.mp4(talk, ch.lang, ch.chapter)]);
    if (s.status === "stale") out.push({ ch, hash, reason: s.reason ?? "stale" });
  }
  return out;
}

async function renderChapter(talk: Talk, ch: ChapterFile, hash: string, quality: Quality, telemetry: boolean, state: TalkState): Promise<boolean> {
  const key = chapterKey(ch.lang, ch.chapter);
  let composed;
  try {
    composed = composeChapter(talk, ch);
  } catch (e) {
    console.error(e instanceof SceneError ? e.message : `${key}: ${(e as Error).message}`);
    return false;
  }
  for (const w of composed.warnings) console.error(`${key}: warning: ${w.line ? `line ${w.line}: ` : ""}${w.message}`);
  const dir = composed.dir;
  console.log(`${key}: composed ${relative(talk.dir, dir)} (${composed.duration.toFixed(2)} s, ${composed.timeline.beats.length} beats); hyperframes check`);
  const chk = await hfCheck(dir, { telemetry });
  if (chk.code !== 0) {
    console.error(`${key}: hyperframes check failed (exit ${chk.code}):\n${tail(chk.stdout + "\n" + chk.stderr, 60)}`);
    return false;
  }
  const summary = tail(chk.stdout, 3);
  if (summary) console.log(summary.replace(/^/gm, "  "));
  const mp4 = buildPaths.mp4(talk, ch.lang, ch.chapter);
  rmSync(mp4, { force: true });
  console.log(`${key}: rendering (${quality})`);
  const r = await hfRender(dir, mp4, talk.config.fps, quality, { telemetry });
  if (r.code !== 0 || !existsSync(mp4)) {
    console.error(`${key}: hyperframes render failed (exit ${r.code}):\n${tail(r.stdout + "\n" + r.stderr, 60)}`);
    return false;
  }
  const duration = await probeDuration(mp4);
  writeText(buildPaths.renderInfo(talk, ch.lang, ch.chapter), JSON.stringify({ quality, hyperframes: HYPERFRAMES_VERSION, duration }, null, 2) + "\n");
  recordStage(state, "render", key, hash);
  writeState(paths.state(talk), state);
  console.log(`${key}: wrote ${relative(talk.dir, mp4)} (${duration.toFixed(2)} s)`);
  return true;
}

/** Refuse a join of chapters rendered at different qualities; returns the message, or null. */
export function qualityMixProblem(qualities: Map<string, string>): string | null {
  if (new Set(qualities.values()).size <= 1) return null;
  const list = [...qualities].map(([nn, q]) => `${nn} ${q}`).join(", ");
  return `refusing to join draft and standard renders (${list}); re-render with one --quality`;
}

async function concatLanguage(talk: Talk, lang: string, state: TalkState): Promise<number> {
  const all = listChapters(talk, lang);
  const stale = await staleRenders(talk, state, all);
  if (stale.length) {
    for (const s of stale) console.log(`${lang}: concat skipped, ${chapterKey(lang, s.ch.chapter)} render is stale (${s.reason})`);
    return 0;
  }
  const mix = qualityMixProblem(new Map(all.map((ch) => [ch.chapter, lastRenderQuality(talk, ch) ?? "standard"])));
  if (mix) {
    console.error(`${lang}: ${mix}`);
    return 1;
  }
  const out = outPaths(talk, lang);
  const hash = await currentConcatHash(talk, lang);
  if (stageStatus(state, "concat", lang, hash, [out.video, out.chapters, out.transcript]).status === "fresh") {
    console.log(`${lang}: concat fresh, skipped`);
    return 0;
  }
  const entries = [];
  for (const ch of all) {
    const parsed = parseScriptFile(ch.file);
    entries.push({ title: parsed.title, duration: await probeDuration(buildPaths.mp4(talk, lang, ch.chapter)), text: parsed.spokenText });
  }
  console.log(`${lang}: joining ${all.length} chapter(s)`);
  await concatMp4(buildPaths.concatList(talk, lang), all.map((ch) => buildPaths.mp4(talk, lang, ch.chapter)), out.video);
  writeText(out.chapters, chaptersTxt(entries));
  writeText(out.transcript, transcriptMd(talk.config.title, entries));
  recordStage(state, "concat", lang, hash!);
  writeState(paths.state(talk), state);
  const total = await probeDuration(out.video);
  console.log(`${lang}: wrote ${relative(talk.dir, out.video)} (${total.toFixed(2)} s), ${relative(talk.dir, out.chapters)}, ${relative(talk.dir, out.transcript)}`);
  return 0;
}

export async function cmdRender(talk: Talk, opts: RenderOptions): Promise<number> {
  const quality = opts.quality;
  if (!isQuality(quality)) {
    console.error(`--quality must be draft or standard, got "${quality}"`);
    return 1;
  }
  const installed = installedHyperframesVersion();
  if (installed !== HYPERFRAMES_VERSION) {
    console.error(`hyperframes ${installed} is installed but talkreel needs exactly ${HYPERFRAMES_VERSION} (run "npm install")`);
    return 1;
  }
  const chapters = selectChapters(talk, opts.lang, opts.chapter);
  if (!chapters.length) {
    console.error(`no chapters in script/${opts.lang}/`);
    return 1;
  }
  const state = readState(paths.state(talk));
  let failed = 0;
  const stale = new Map((await staleRenders(talk, state, chapters, quality)).map((s) => [s.ch.chapter, s]));
  for (const ch of chapters) {
    const key = chapterKey(ch.lang, ch.chapter);
    const st = await chapterStatus(talk, state, ch);
    if (st.voice.status !== "fresh" || st.align.status !== "fresh") {
      const why = st.voice.status !== "fresh" ? `voice is stale (${st.voice.reason})` : `align is stale (${st.align.reason})`;
      console.error(`${key}: ${why}; run "talkreel voice" and "talkreel align" first`);
      failed++;
      continue;
    }
    const s = stale.get(ch.chapter);
    if (!s) {
      console.log(`${key}: render fresh, skipped`);
      continue;
    }
    if (s.hash === null) {
      console.error(`${key}: render inputs missing; expected scenes/${ch.chapter}-${ch.name}.html, captions and narration`);
      failed++;
      continue;
    }
    if (!(await renderChapter(talk, ch, s.hash, quality, opts.telemetry, state))) failed++;
  }
  if (failed) {
    console.error(`render failed for ${failed} chapter(s); concat not run`);
    return 1;
  }
  return concatLanguage(talk, opts.lang, state);
}
