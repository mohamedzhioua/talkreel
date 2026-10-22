// FFmpeg discovery and the canonical narration format.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { run } from "./proc.js";

/** The one audio format every narration WAV is converted to before alignment and composition. */
export const CANONICAL_AUDIO = { sampleRate: 24000, channels: 1, codec: "pcm_s16le" } as const;
export const CANONICAL_AUDIO_ID = `${CANONICAL_AUDIO.codec}/${CANONICAL_AUDIO.sampleRate}/${CANONICAL_AUDIO.channels}ch`;

export type Tool = "ffmpeg" | "ffprobe";

const isWin = process.platform === "win32";

function onPath(name: string, env: NodeJS.ProcessEnv): string | null {
  const exe = isWin ? `${name}.exe` : name;
  for (const dir of (env.PATH ?? env.Path ?? "").split(delimiter)) {
    if (!dir) continue;
    const p = join(dir, exe);
    if (existsSync(p)) return p;
  }
  return null;
}

/** winget installs Gyan.FFmpeg under %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*\bin. */
function wingetCandidates(name: string, env: NodeJS.ProcessEnv): string[] {
  const local = env.LOCALAPPDATA;
  if (!isWin || !local) return [];
  const out: string[] = [];
  const pkgs = join(local, "Microsoft", "WinGet", "Packages");
  if (existsSync(pkgs)) {
    for (const pkg of readdirSync(pkgs).filter((d) => d.startsWith("Gyan.FFmpeg")).sort().reverse()) {
      const pkgDir = join(pkgs, pkg);
      let builds: string[] = [];
      try {
        builds = readdirSync(pkgDir).filter((d) => d.startsWith("ffmpeg-")).sort().reverse();
      } catch {
        continue;
      }
      for (const b of builds) out.push(join(pkgDir, b, "bin", `${name}.exe`));
    }
  }
  out.push(join(local, "Microsoft", "WinGet", "Links", `${name}.exe`));
  return out;
}

/** Absolute path to ffmpeg/ffprobe: $TALKREEL_FFMPEG_DIR, then PATH, then the winget location. */
export function findTool(name: Tool, env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.TALKREEL_FFMPEG_DIR;
  if (override) {
    const p = join(override, isWin ? `${name}.exe` : name);
    if (existsSync(p)) return p;
  }
  return onPath(name, env) ?? wingetCandidates(name, env).find((p) => existsSync(p)) ?? null;
}

export function requireTool(name: Tool): string {
  const p = findTool(name);
  if (!p) throw new Error(`${name} not found on PATH or in the winget location; run "talkreel doctor"`);
  return p;
}

/** An env whose PATH starts with the FFmpeg bin dir, for children (HyperFrames) that look it up. */
export function envWithFfmpeg(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const ff = findTool("ffmpeg", env);
  if (!ff) return env;
  const key = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  return { ...env, [key]: dirname(ff) + delimiter + (env[key] ?? "") };
}

/** Convert any audio file to the canonical narration WAV. The input is only read. */
export async function toCanonicalWav(input: string, output: string): Promise<void> {
  const ffmpeg = requireTool("ffmpeg");
  mkdirSync(dirname(output), { recursive: true });
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    "-vn", "-map_metadata", "-1",
    "-ac", String(CANONICAL_AUDIO.channels),
    "-ar", String(CANONICAL_AUDIO.sampleRate),
    "-c:a", CANONICAL_AUDIO.codec,
    "-fflags", "+bitexact", "-flags:a", "+bitexact",
    output,
  ];
  const r = await run(ffmpeg, args);
  if (r.code !== 0) throw new Error(`ffmpeg failed converting ${input}:\n${r.stderr.trim()}`);
}
