// Bridge to the Python audio helper (py/talkreel_audio), run as a separate process through uv.
// The helper prints one JSON object on stdout; errors go to stderr with a non-zero exit.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./proc.js";
import { isWhisperResult, type WhisperResult } from "./schema.js";
import { CTC_MODEL, WHISPER_MODEL } from "./state.js";

/** Absolute path to py/, next to dist/ (or src/ under tests). */
export const PY_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "py");

export class HelperError extends Error {}

function helperEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PYTHONPATH: PY_DIR, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" };
}

/** Run `python -m talkreel_audio <args>` in the py/ uv project and parse its JSON output. */
export async function runHelper(args: string[], opts: { echoStderr?: boolean } = {}): Promise<unknown> {
  const ctc = args[0] === "ctc-align";
  if (ctc && !(await models()).ctc.available) throw new HelperError("install the arabic group for script-level Arabic alignment");
  // Probing must preserve an installed optional group and must never sync it.
  // CTC is also no-sync: selecting it cannot install GBs of optional packages.
  const uvArgs = ["run", "--quiet", "--project", PY_DIR,
    ...(ctc ? ["--no-sync", "--group", "arabic"] : args[0] === "models" ? ["--no-sync"] : []),
    "python", "-m", "talkreel_audio", ...args];
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

export async function ctcAlign(wav: string, textFile: string): Promise<WhisperResult> {
  const v = await runHelper(["ctc-align", "--wav", wav, "--text-file", textFile, "--lang", "ar"]);
  if (!isWhisperResult(v) || v.model !== CTC_MODEL || v.lang !== "ar") throw new HelperError("ctc-align: unexpected JSON " + JSON.stringify(v).slice(0, 300));
  return v;
}

/** The same selection drives execution and status/freshness hashes. */
export async function alignmentModel(lang: string): Promise<string> {
  if (lang !== "ar") return WHISPER_MODEL;
  return (await models()).ctc.available ? CTC_MODEL : WHISPER_MODEL;
}

export interface ModelsReport {
  cache_dir: string;
  kokoro: { present: boolean; files: { name: string; present: boolean; path: string }[] };
  whisper: { present: boolean; model: string };
  ctc: { available: boolean; present: boolean; model: string; revision: string };
}

export async function models(): Promise<ModelsReport> {
  return (await runHelper(["models", "--whisper-model", "small"], { echoStderr: false })) as ModelsReport;
}
