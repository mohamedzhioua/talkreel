import { chapterStatus, currentConcatHash, type ChapterStatus } from "../stages.js";
import { readState, stageStatus, type StageStatus } from "../state.js";
import { listChapters, paths, type Talk } from "../talk.js";

export interface StatusReport {
  talk: string;
  dir: string;
  chapters: ChapterStatus[];
  concat: Record<string, StageStatus>;
}

export async function statusReport(talk: Talk): Promise<StatusReport> {
  const state = readState(paths.state(talk));
  const chapters: ChapterStatus[] = [];
  const concat: Record<string, StageStatus> = {};
  for (const lang of talk.config.languages) {
    const chs = listChapters(talk, lang);
    for (const ch of chs) chapters.push(await chapterStatus(talk, state, ch));
    let c = stageStatus(state, "concat", lang, await currentConcatHash(talk, lang));
    if (c.status === "fresh" && chapters.some((s) => s.lang === lang && s.render.status === "stale")) c = { status: "stale", reason: "a chapter render is stale" };
    if (chs.length) concat[lang] = c;
  }
  return { talk: talk.config.slug, dir: talk.dir, chapters, concat };
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
  return 0;
}
