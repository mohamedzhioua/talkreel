// Bridge to the Python audio helper (py/talkreel_audio), run as a separate process through uv.
// The helper prints one JSON object on stdout; errors go to stderr with a non-zero exit.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./proc.js";
import { isWhisperResult, type WhisperResult } from "./schema.js";

/** Absolute path to py/, next to dist/ (or src/ under tests). */
export const PY_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "py");

export class HelperError extends Error {}

function helperEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PYTHONPATH: PY_DIR, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" };
}

/** Run `python -m talkreel_audio <args>` in the py/ uv project and parse its JSON output. */
export async function runHelper(args: string[], opts: { echoStderr?: boolean } = {}): Promise<unknown> {
  const uvArgs = ["run", "--quiet", "--project", PY_DIR, "python", "-m", "talkreel_audio", ...args];
  const r = await run("uv", uvArgs, { env: helperEnv(), echoStderr: opts.echoStderr ?? true });
  if (r.code === 127) throw new HelperError(`cannot start uv: ${r.stderr.trim()} (run "talkreel doctor")`);
  if (r.code !== 0) throw new HelperError(`audio helper "${args[0]}" failed (exit ${r.code})${opts.echoStderr === false ? `:\n${r.stderr.trim()}` : ""}`);
  const line = r.stdout.trim().split(/\r?\n/).pop() ?? "";
  try {
    return JSON.parse(line);
  } catch {
    throw new HelperError(`audio helper "${args[0]}" printed no JSON:\n${r.stdout}`);
  }
}

export interface TtsResult {
  duration: number;
  sample_rate: number;
}

export async function tts(textFile: string, voice: string, lang: string, out: string, speed = 1): Promise<TtsResult> {
  const v = await runHelper(["tts", "--text-file", textFile, "--voice", voice, "--lang", lang, "--out", out, "--speed", String(speed)]);
  const o = v as Partial<TtsResult>;
  if (typeof o?.duration !== "number" || typeof o?.sample_rate !== "number") throw new HelperError("tts: unexpected JSON " + JSON.stringify(v));
  return o as TtsResult;
}

export async function align(wav: string, lang: string, model: string): Promise<WhisperResult> {
  const v = await runHelper(["align", "--wav", wav, "--lang", lang, "--model", model]);
  if (!isWhisperResult(v)) throw new HelperError("align: unexpected JSON " + JSON.stringify(v).slice(0, 300));
  return v;
}

export interface ModelsReport {
  cache_dir: string;
  kokoro: { present: boolean; files: { name: string; present: boolean; path: string }[] };
  whisper: { present: boolean; model: string };
}

export function models(): Promise<ModelsReport> {
  return runHelper(["models", "--whisper-model", "small"], { echoStderr: false }) as Promise<ModelsReport>;
}
