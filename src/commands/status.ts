import { concatOutputs } from "../compose-concat.js";
import { mixOutputs } from "../compose-mix.js";
import { parseScriptFile } from "../script.js";
import { chapterStatus, currentConcatHash, currentMixHash, type ChapterStatus } from "../stages.js";
import { readState, stageStatus, type StageStatus } from "../state.js";
import { listChapters, paths, type Talk } from "../talk.js";
import { readWavInfo } from "../wav.js";

export interface StatusReport {
  talk: string;
  dir: string;
  chapters: ChapterStatus[];
  concat: Record<string, StageStatus>;
  /** Portrait totals from fresh narration, falling back to 150 spoken words per minute. */
  length: { lang: string; words: number | null; seconds: number | null; source: "voiced" | "estimate" | null; warning: string }[];
  /** Present only when talk.json has `music`. */
  mix?: Record<string, StageStatus>;
}

export async function statusReport(talk: Talk): Promise<StatusReport> {
  const state = readState(paths.state(talk));
  const chapters: ChapterStatus[] = [];
  const concat: Record<string, StageStatus> = {};
  const mix: Record<string, StageStatus> = {};
  const length: StatusReport["length"] = [];
  for (const lang of talk.config.languages) {
    const chs = listChapters(talk, lang);
    const languageChapters: ChapterStatus[] = [];
    for (const ch of chs) languageChapters.push(await chapterStatus(talk, state, ch));
    chapters.push(...languageChapters);
    if (talk.config.resolution === "portrait" && chs.length) {
      try {
        const words = chs.reduce((sum, ch) => sum + parseScriptFile(ch.file).words.length, 0);
        let seconds = words * 60 / 150;
        let source: "voiced" | "estimate" = "estimate";
        if (languageChapters.every((ch) => ch.voice.status === "fresh")) {
          try {
            const voicedSeconds = chs.reduce((sum, ch) => sum + readWavInfo(paths.narrationWav(talk, lang, ch.chapter)).duration, 0);
            if (Number.isFinite(voicedSeconds) && voicedSeconds >= 0) {
              seconds = voicedSeconds;
              source = "voiced";
            }
          } catch {
            // Unreadable narration falls back to the whole language's script estimate.
          }
        }
        const warnings = [];
        if (seconds > 90) warnings.push("long for a reel");
        if (seconds > 180) warnings.push("over the Shorts limit");
        length.push({ lang, words, seconds, source, warning: warnings.join("; ") });
      } catch {
        length.push({ lang, words: null, seconds: null, source: null, warning: "cannot estimate: invalid script" });
      }
    }
    let c = stageStatus(state, "concat", lang, await currentConcatHash(talk, lang), concatOutputs(talk, lang));
    if (c.status === "fresh" && chapters.some((s) => s.lang === lang && s.render.status === "stale")) c = { status: "stale", reason: "a chapter render is stale" };
    if (chs.length) concat[lang] = c;
    if (!talk.config.music || !chs.length) continue;
    let m = stageStatus(state, "mix", lang, await currentMixHash(talk, lang), mixOutputs(talk, lang));
    if (m.status === "fresh" && c.status === "stale") m = { status: "stale", reason: "concat is stale" };
    mix[lang] = m;
  }
  return { talk: talk.config.slug, dir: talk.dir, chapters, concat, length, ...(talk.config.music ? { mix } : {}) };
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
  if (r.length.length) {
    console.log("\nReel length (voiced: fresh narration; estimate: 150 spoken words/minute; warnings only)");
    console.log("language | words | seconds | source | warning");
    for (const row of r.length) console.log(`${row.lang} | ${row.words ?? "?"} | ${row.seconds?.toFixed(1) ?? "?"} | ${row.source ?? "?"} | ${row.warning || "-"}`);
  }
  return 0;
}
