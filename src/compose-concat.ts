// Joining chapter MP4s: the FFmpeg concat-demuxer list, YouTube chapter markers and the transcript.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildPaths } from "./compose.js";
import { requireTool } from "./ffmpeg.js";
import { run } from "./proc.js";
import type { Talk } from "./talk.js";

/** One line of an FFmpeg concat list; single quotes are escaped as '\'' per the demuxer syntax. */
export function concatListLine(file: string): string {
  return `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

export function concatList(files: string[]): string {
  return "ffconcat version 1.0\n" + files.map(concatListLine).join("\n") + "\n";
}

/** YouTube timestamp: m:ss padded to mm:ss below an hour, h:mm:ss from an hour. */
export function youtubeTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export interface ChapterEntry {
  title: string;
  /** Rendered duration in seconds. */
  duration: number;
}

/** Start offsets of each chapter in the joined video. */
export function chapterOffsets(chapters: ChapterEntry[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const c of chapters) {
    out.push(t);
    t += c.duration;
  }
  return out;
}

/** `00:00 Title` per chapter, the YouTube description format. */
export function chaptersTxt(chapters: ChapterEntry[]): string {
  const offs = chapterOffsets(chapters);
  return chapters.map((c, i) => `${youtubeTime(offs[i]!)} ${c.title}`).join("\n") + "\n";
}

export function transcriptMd(title: string, chapters: (ChapterEntry & { text: string })[]): string {
  const offs = chapterOffsets(chapters);
  const parts = [`# ${title}`, ""];
  chapters.forEach((c, i) => {
    parts.push(`## ${c.title} (${youtubeTime(offs[i]!)})`, "", c.text.trim(), "");
  });
  return parts.join("\n");
}

export function outPaths(talk: Talk, lang: string) {
  const out = join(talk.dir, "out");
  // The first language keeps the plain names; others get a -<lang> suffix so nothing collides.
  const suffix = lang === talk.config.languages[0] ? "" : `-${lang}`;
  return {
    video: join(out, `${talk.config.slug}-${lang}.mp4`),
    chapters: join(out, `chapters${suffix}.txt`),
    transcript: join(out, `transcript${suffix}.md`),
    /** Shared by every language; written by the mix stage only. */
    credits: join(out, "credits.txt"),
  };
}

/**
 * Where concat writes the joined video: out/<slug>-<lang>.mp4 as in M2, or build/<lang>/concat.mp4
 * when talk.json has `music` and the mix stage writes the out/ video.
 */
export function concatOutput(talk: Talk, lang: string): string {
  return talk.config.music ? buildPaths.concatMp4(talk, lang) : outPaths(talk, lang).video;
}

/** Files the concat stage must have produced to be fresh. */
export function concatOutputs(talk: Talk, lang: string): string[] {
  const out = outPaths(talk, lang);
  return [concatOutput(talk, lang), out.chapters, out.transcript];
}

/** Container duration in seconds, from ffprobe. */
export async function probeDuration(file: string): Promise<number> {
  const r = await run(requireTool("ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const d = Number(r.stdout.trim());
  if (r.code !== 0 || !Number.isFinite(d)) throw new Error(`ffprobe could not read ${file}:\n${r.stderr.trim()}`);
  return d;
}

export async function concatMp4(listFile: string, files: string[], output: string): Promise<void> {
  mkdirSync(dirname(listFile), { recursive: true });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(listFile, concatList(files), "utf8");
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", output];
  const r = await run(requireTool("ffmpeg"), args);
  if (r.code !== 0) throw new Error(`ffmpeg concat failed:\n${r.stderr.trim()}`);
}
