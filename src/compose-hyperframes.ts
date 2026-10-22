// HyperFrames CLI (pinned 0.8.185), spawned as process.execPath + its JS entry: never npx, never
// a shell. Telemetry and skill installs are off unless the user passes --telemetry.
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

export async function hfCheck(dir: string, opts: HfOptions): Promise<RunResult> {
  return hyperframes(["check", dir], dir, opts);
}

export async function hfRender(dir: string, output: string, fps: number, quality: Quality, opts: HfOptions): Promise<RunResult> {
  return hyperframes(["render", dir, "--output", output, "--fps", String(fps), "--resolution", "landscape", "--quality", QUALITIES[quality]], dir, opts);
}
