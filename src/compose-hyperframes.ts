// HyperFrames CLI (pinned 0.8.185), spawned as process.execPath + its JS entry: never npx, never
// a shell. Telemetry and skill installs are off unless the user passes --telemetry.
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { envWithFfmpeg, findTool } from "./ffmpeg.js";
import { run, type RunResult } from "./proc.js";
import { packageDir, packageVersion } from "./compose.js";

export const HYPERFRAMES_VERSION = "0.8.185";

export function hyperframesEntry(): string {
  return join(packageDir("hyperframes"), "bin", "hyperframes.mjs");
}

export function installedHyperframesVersion(): string {
  return packageVersion("hyperframes");
}

export function hyperframesEnv(telemetry: boolean, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...envWithFfmpeg(base), NO_COLOR: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1" };
  // Non-interactive `check` otherwise leaves a warm background checker running for 5 minutes.
  env.CI = "1";
  const ff = findTool("ffmpeg", base);
  const fp = findTool("ffprobe", base);
  if (ff) env.HYPERFRAMES_FFMPEG_PATH = ff;
  if (fp) env.HYPERFRAMES_FFPROBE_PATH = fp;
  if (!telemetry) {
    env.HYPERFRAMES_NO_TELEMETRY = "1";
    env.HYPERFRAMES_SKIP_SKILLS = "1";
  }
  return env;
}

export interface HfOptions {
  telemetry: boolean;
  echo?: boolean;
}

export function hyperframes(args: string[], cwd: string, opts: HfOptions): Promise<RunResult> {
  return run(process.execPath, [hyperframesEntry(), ...args], { cwd, env: hyperframesEnv(opts.telemetry), echoStderr: opts.echo });
}

/** HyperFrames quality names for talkreel's two qualities. */
export const QUALITIES = { draft: "draft", standard: "standard" } as const;
export type Quality = keyof typeof QUALITIES;

export function isQuality(q: string): q is Quality {
  return q in QUALITIES;
}

/**
 * `hyperframes check` arguments. `--range 0,<duration>` keeps the runtime, layout, overlap,
 * motion and contrast passes over the whole chapter but skips the craft pass, which samples
 * 8 frames per second of video and only ever reports warnings (it cost ~30-75 s on a 66 s
 * chapter, see .spike/perf). Craft warnings never failed a render; they are no longer reported.
 */
export function checkArgs(dir: string, duration: number): string[] {
  return ["check", dir, "--range", `0,${Math.floor(duration * 1000) / 1000}`];
}

export async function hfCheck(dir: string, duration: number, opts: HfOptions): Promise<RunResult> {
  return hyperframes(checkArgs(dir, duration), dir, opts);
}

/**
 * Explicit render worker count. Left to "auto", HyperFrames spends 20-45 s per chapter on a
 * calibration browser session; on an 8-thread laptop it settles on 3 workers, and 6 was slower
 * (capture and encode contend for the same cores). Half the logical CPUs minus one, 1..4.
 */
export function renderWorkers(logicalCpus: number): number {
  return Math.max(1, Math.min(4, Math.floor(logicalCpus / 2) - 1));
}

export function renderArgs(dir: string, output: string, fps: number, quality: Quality, workers: number): string[] {
  return ["render", dir, "--output", output, "--fps", String(fps), "--resolution", "landscape", "--quality", QUALITIES[quality], "--workers", String(workers)];
}

export async function hfRender(dir: string, output: string, fps: number, quality: Quality, opts: HfOptions): Promise<RunResult> {
  return hyperframes(renderArgs(dir, output, fps, quality, renderWorkers(availableParallelism())), dir, opts);
}
