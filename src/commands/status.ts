import { concatOutputs } from "../compose-concat.js";
import { mixOutputs } from "../compose-mix.js";
import { chapterStatus, currentConcatHash, currentMixHash, type ChapterStatus } from "../stages.js";
import { readState, stageStatus, type StageStatus } from "../state.js";
import { listChapters, paths, type Talk } from "../talk.js";

export interface StatusReport {
  talk: string;
  dir: string;
  chapters: ChapterStatus[];
  concat: Record<string, StageStatus>;
  /** Present only when talk.json has `music`. */
  mix?: Record<string, StageStatus>;
}

export async function statusReport(talk: Talk): Promise<StatusReport> {
  const state = readState(paths.state(talk));
  const chapters: ChapterStatus[] = [];
  const concat: Record<string, StageStatus> = {};
  const mix: Record<string, StageStatus> = {};
  for (const lang of talk.config.languages) {
    const chs = listChapters(talk, lang);
    for (const ch of chs) chapters.push(await chapterStatus(talk, state, ch));
    let c = stageStatus(state, "concat", lang, await currentConcatHash(talk, lang), concatOutputs(talk, lang));
    if (c.status === "fresh" && chapters.some((s) => s.lang === lang && s.render.status === "stale")) c = { status: "stale", reason: "a chapter render is stale" };
    if (chs.length) concat[lang] = c;
    if (!talk.config.music || !chs.length) continue;
    let m = stageStatus(state, "mix", lang, await currentMixHash(talk, lang), mixOutputs(talk, lang));
    if (m.status === "fresh" && c.status === "stale") m = { status: "stale", reason: "concat is stale" };
    mix[lang] = m;
  }
  return { talk: talk.config.slug, dir: talk.dir, chapters, concat, ...(talk.config.music ? { mix } : {}) };
}

function cell(s: StageStatus): string {
  return s.status === "fresh" ? "fresh" : `stale (${s.reason ?? "?"})`;
}

export async function cmdStatus(talk: Talk, json: boolean): Promise<number> {
  const r = await statusReport(talk);
  if (json) {
    console.log(JSON.stringify(r, null, 2));
    return 0;
  }
  console.log(`${r.talk}  (${r.dir})`);
  if (!r.chapters.length) console.log("  no chapters in script/<lang>/ yet");
  for (const c of r.chapters) {
    console.log(`  ${c.lang}/${c.chapter} ${c.title}`);
    console.log(`    voice:  ${cell(c.voice)}`);
    console.log(`    align:  ${cell(c.align)}`);
    console.log(`    render: ${cell(c.render)}`);
  }
  for (const [lang, s] of Object.entries(r.concat)) console.log(`  ${lang} concat: ${cell(s)}`);
  for (const [lang, s] of Object.entries(r.mix ?? {})) console.log(`  ${lang} mix:    ${cell(s)}`);
  return 0;
}
