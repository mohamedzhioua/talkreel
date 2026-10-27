import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPaths, loadCaptions, prepareScene, sceneFile } from "../compose.js";
import { probeDuration } from "../compose-concat.js";
import { resolveCues } from "../cues.js";
import { requireTool } from "../ffmpeg.js";
import { GEOMETRY, type Resolution } from "../geometry.js";
import { run } from "../proc.js";
import { parseScriptFile } from "../script.js";
import { loadSources, paths, selectChapters, type Talk } from "../talk.js";
import { readWavInfo } from "../wav.js";

export interface FramesOptions {
  lang: string;
  chapter?: string;
  safeZones?: boolean;
}

export interface FramePoint {
  label: string;
  time: number;
}

export interface FrameInfo extends FramePoint {
  lang: string;
  chapter: string;
  /** Beat on screen at that time, when the scene resolves. */
  beat?: string;
  path: string;
}

/** Review-only overlay, relative to the encoded frame size (including draft renders). */
export function safeZoneFilter(resolution: Resolution): string | null {
  if (resolution !== "portrait") return null;
  const { top, bottom, sides } = GEOMETRY[resolution].safeZones;
  return [
    `drawbox=x=0:y=0:w=iw:h=ih*${top}:color=red@0.28:t=fill`,
    `drawbox=x=0:y=ih*(1-${bottom}):w=iw:h=ih*${bottom}:color=red@0.28:t=fill`,
    `drawbox=x=0:y=0:w=iw*${sides}:h=ih:color=yellow@0.28:t=fill`,
    `drawbox=x=iw*(1-${sides}):y=0:w=iw*${sides}:h=ih:color=yellow@0.28:t=fill`,
  ].join(",");
}

/**
 * Key frame times: chapter start + 0.5 s, 0.15 s into every beat change (`transition-<beat>`,
 * beats only, never element cues), each cue + 0.9 s (its content has entered by then),
 * and 0.5 s before the end. Sorted, de-duplicated, kept inside the video.
 */
export function framePoints(
  cueTimes: Record<string, number>,
  duration: number,
  beats: readonly { id: string; start: number }[] = [],
): FramePoint[] {
  const pts: FramePoint[] = [{ label: "start", time: 0.5 }];
  for (const b of beats) if (b.start > 0) pts.push({ label: `transition-${b.id}`, time: b.start + 0.15 });
  for (const [name, t] of Object.entries(cueTimes).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) pts.push({ label: name, time: t + 0.9 });
  pts.push({ label: "end", time: duration - 0.5 });
  const out: FramePoint[] = [];
  for (const p of pts) {
    const time = Math.round(Math.min(Math.max(p.time, 0), Math.max(0, duration - 0.05)) * 1000) / 1000;
    if (out.some((o) => Math.abs(o.time - time) < 0.05)) continue;
    out.push({ label: p.label, time });
  }
  return out.sort((a, b) => a.time - b.time);
}

export async function cmdFrames(talk: Talk, opts: FramesOptions): Promise<number> {
  const chapters = selectChapters(talk, opts.lang, opts.chapter);
  const ffmpeg = requireTool("ffmpeg");
  const overlay = opts.safeZones ? safeZoneFilter(talk.config.resolution) : null;
  if (opts.safeZones && !overlay) console.error(`--safe-zones is for portrait talks; extracting ${talk.config.resolution} frames without an overlay`);
  const frames: FrameInfo[] = [];
  let failed = 0;
  for (const ch of chapters) {
    const key = `${ch.lang}/${ch.chapter}`;
    const mp4 = buildPaths.mp4(talk, ch.lang, ch.chapter);
    if (!existsSync(mp4)) {
      console.error(`${key}: no ${mp4}; run "talkreel render" first`);
      failed++;
      continue;
    }
    try {
      const parsed = parseScriptFile(ch.file);
      const captions = loadCaptions(paths.captions(talk, ch.lang, ch.chapter));
      const cueTimes = resolveCues(parsed, captions);
      const duration = await probeDuration(mp4);
      let beats: { id: string; start: number }[] = [];
      try {
        const sources = new Set(loadSources(talk).sources.map((s) => s.id));
        const wav = paths.narrationWav(talk, ch.lang, ch.chapter);
        const { timeline } = prepareScene("scene", readFileSync(sceneFile(talk, ch), "utf8"), parsed, captions, readWavInfo(wav).duration, sources, talk.config.resolution);
        beats = timeline.beats.map((b) => ({ id: b.id, start: b.start }));
      } catch {
        beats = [];
      }
      const dir = buildPaths.framesDir(talk, ch.lang, ch.chapter);
      mkdirSync(dir, { recursive: true });
      for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));
      const pts = framePoints(cueTimes, duration, beats);
      for (const [i, p] of pts.entries()) {
        const file = join(dir, `${String(i).padStart(2, "0")}-${p.time.toFixed(2)}s-${p.label}.png`);
        const r = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", p.time.toFixed(3), "-i", mp4, ...(overlay ? ["-vf", overlay] : []), "-frames:v", "1", file]);
        if (r.code !== 0 || !existsSync(file)) throw new Error(`ffmpeg could not extract a frame at ${p.time} s:\n${r.stderr.trim()}`);
        const beat = [...beats].reverse().find((b) => b.start <= p.time)?.id;
        frames.push({ lang: ch.lang, chapter: ch.chapter, ...(beat ? { beat } : {}), label: p.label, time: p.time, path: file });
      }
      console.error(`${key}: ${pts.length} frames in ${dir}`);
    } catch (e) {
      console.error(`${key}: ${(e as Error).message}`);
      failed++;
    }
  }
  console.log(JSON.stringify({ frames }, null, 2));
  return failed ? 1 : 0;
}
