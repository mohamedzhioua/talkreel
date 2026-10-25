// Mix stage: the joined video with a music bed ducked under the narration and loudness-normalised
// (two-pass loudnorm), plus out/credits.txt. Runs only when talk.json has `music`; the bed is
// optional here so a loudness-only mix (a later --normalize) needs no refactor.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FONT_FILES, packageDir } from "./compose.js";
import { outPaths, probeDuration } from "./compose-concat.js";
import { requireTool } from "./ffmpeg.js";
import { run } from "./proc.js";
import { MUSIC_GAIN_DB_DEFAULT } from "./schema.js";
import { TTS_ENGINE } from "./state.js";
import { paths, type Talk } from "./talk.js";

/** Every filter and encoder setting of the mix; part of the mix hash. Bump `version` on any change. */
export const MIX_PARAMS = {
  version: 1,
  fadeOut: 1.5,
  loudness: { I: -14, TP: -1.5, LRA: 11 },
  duck: { threshold: 0.05, ratio: 4, attack: 20, release: 400 },
  audio: { codec: "aac", bitrate: "192k", sampleRate: 48000, channels: 2 },
} as const;

export interface MixBed {
  /** Absolute path of the music file. */
  file: string;
  gainDb: number;
}

/** loudnorm's pass-1 JSON, the fields pass 2 needs (ffmpeg prints them as strings). */
export interface LoudnormMeasure {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

const MEASURE_KEYS = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"] as const;

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** The talk's bed (gain defaulted), or undefined without `music`. */
export function talkBed(talk: Talk): MixBed | undefined {
  const m = talk.config.music;
  return m ? { file: paths.music(talk)!, gainDb: m.gainDb ?? MUSIC_GAIN_DB_DEFAULT } : undefined;
}

export function loudnormFilter(measured?: LoudnormMeasure): string {
  const { I, TP, LRA } = MIX_PARAMS.loudness;
  const target = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  if (!measured) return `${target}:print_format=json`;
  return `${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
}

/**
 * Input 0 is the joined video (its audio is the narration), input 1 the looped bed. The bed is
 * trimmed to `duration`, set to its gain, faded out over the last MIX_PARAMS.fadeOut seconds, and
 * ducked by sidechaincompress keyed on the narration; then loudnorm, resampled back to 48 kHz and
 * trimmed again, because loudnorm flushes a padded last frame that would lengthen the video.
 */
export function mixFilterGraph(duration: number, bed: MixBed | undefined, loudnorm: string): string {
  const { sampleRate } = MIX_PARAMS.audio;
  const fmt = `aformat=sample_rates=${sampleRate}:channel_layouts=stereo`;
  const tail = `${loudnorm},aresample=${sampleRate},atrim=duration=${num(duration)}[out]`;
  if (!bed) return `[0:a]${fmt},${tail}`;
  const fade = Math.min(MIX_PARAMS.fadeOut, duration);
  const { threshold, ratio, attack, release } = MIX_PARAMS.duck;
  return [
    `[1:a]atrim=duration=${num(duration)},asetpts=PTS-STARTPTS,${fmt},volume=${num(bed.gainDb)}dB,afade=t=out:st=${num(duration - fade)}:d=${num(fade)}[bed]`,
    `[0:a]${fmt},asplit=2[voice][key]`,
    `[bed][key]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[ducked]`,
    `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,${tail}`,
  ].join(";");
}

function inputArgs(input: string, bed: MixBed | undefined): string[] {
  // -stream_loop -1 repeats the bed; atrim cuts it to the video's length.
  return ["-i", input, ...(bed ? ["-stream_loop", "-1", "-i", bed.file] : [])];
}

/** Pass 1: run the whole graph into the null muxer; loudnorm prints its measurement as JSON. */
export function mixMeasureArgs(input: string, duration: number, bed?: MixBed): string[] {
  return ["-hide_banner", "-nostats", "-loglevel", "info", ...inputArgs(input, bed), "-filter_complex", mixFilterGraph(duration, bed, loudnormFilter()), "-map", "[out]", "-f", "null", "-"];
}

/** Pass 2: the same graph with the measured values; the video stream is copied. */
export function mixApplyArgs(input: string, output: string, duration: number, measured: LoudnormMeasure, bed?: MixBed): string[] {
  const a = MIX_PARAMS.audio;
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    ...inputArgs(input, bed),
    "-filter_complex", mixFilterGraph(duration, bed, loudnormFilter(measured)),
    "-map", "0:v:0", "-map", "[out]",
    "-c:v", "copy",
    "-c:a", a.codec, "-b:a", a.bitrate, "-ar", String(a.sampleRate), "-ac", String(a.channels),
    "-movflags", "+faststart",
    output,
  ];
}

/** The last loudnorm JSON block in ffmpeg's stderr. Throws when absent or not finite (silence). */
export function parseLoudnorm(stderr: string): LoudnormMeasure {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks) throw new Error(`loudnorm printed no measurement:\n${stderr.trim().split(/\r?\n/).slice(-15).join("\n")}`);
  const v = JSON.parse(blocks[blocks.length - 1]!) as Record<string, unknown>;
  const out = {} as Record<(typeof MEASURE_KEYS)[number], string>;
  for (const k of MEASURE_KEYS) {
    const s = String(v[k] ?? "");
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`loudnorm measured ${k} = "${s}"; the mix is silent or unreadable`);
    out[k] = s;
  }
  return out;
}

/** Two-pass mix of `input` (joined video) into `output`. */
export async function mixAudio(input: string, output: string, bed?: MixBed): Promise<void> {
  const ffmpeg = requireTool("ffmpeg");
  const duration = await probeDuration(input);
  const pass1 = await run(ffmpeg, mixMeasureArgs(input, duration, bed));
  if (pass1.code !== 0) throw new Error(`ffmpeg mix (loudness measurement) failed:\n${pass1.stderr.trim().split(/\r?\n/).slice(-15).join("\n")}`);
  const measured = parseLoudnorm(pass1.stderr);
  mkdirSync(dirname(output), { recursive: true });
  const pass2 = await run(ffmpeg, mixApplyArgs(input, output, duration, measured, bed));
  if (pass2.code !== 0) throw new Error(`ffmpeg mix failed:\n${pass2.stderr.trim()}`);
}

/** Files the mix stage must have produced to be fresh. */
export function mixOutputs(talk: Talk, lang: string): string[] {
  const out = outPaths(talk, lang);
  return [out.video, out.credits];
}

// ---------- credits ----------

export interface VoiceCredit {
  engine: string;
  /** Audio watermark the engine embeds, or "none". */
  watermark: string;
}

/**
 * The voice engine of one language. Engine-prefixed ids (chatterbox:, lahgtna:) add their own
 * branch here with the watermark note (Chatterbox embeds a PerTh watermark; see the design doc).
 */
export function voiceCredit(talk: Talk, lang: string): VoiceCredit {
  if (talk.config.voice.mode === "own") return { engine: "own voice (the author's recording)", watermark: "none" };
  const id = talk.config.voice[lang];
  return { engine: `Kokoro-82M (Apache-2.0) via kokoro-onnx, ${TTS_ENGINE}, voice ${typeof id === "string" ? id : "?"}`, watermark: "none" };
}

/** `Family version (package, licence)` for every bundled font. */
export function fontCredits(): string[] {
  return FONT_FILES.map(([pkg]) => {
    try {
      const dir = packageDir(pkg);
      const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version?: string; license?: string };
      const family = existsSync(join(dir, "metadata.json")) ? (JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8")) as { family?: string }).family : undefined;
      return `${[family ?? pkg, meta.version].filter(Boolean).join(" ")} (${pkg}, ${meta.license ?? "licence unknown"})`;
    } catch {
      return pkg;
    }
  });
}

export function creditsTxt(talk: Talk): string {
  const lines = [`Credits: ${talk.config.title}`, ""];
  const m = talk.config.music;
  if (m) lines.push("Music", `  File: ${m.file}`, `  Credit: ${m.credit}`, `  Licence: ${m.license}`, "");
  lines.push("Voice");
  for (const lang of talk.config.languages) {
    const v = voiceCredit(talk, lang);
    lines.push(`  ${lang}: ${v.engine}`, `      Watermark: ${v.watermark}`);
  }
  lines.push("", "Fonts", ...fontCredits().map((f) => `  ${f}`));
  return lines.join("\n") + "\n";
}

/** Write out/credits.txt when its content changed; returns the path. */
export function writeCredits(talk: Talk): string {
  const file = outPaths(talk, talk.config.languages[0]!).credits;
  const text = creditsTxt(talk);
  if (existsSync(file) && readFileSync(file, "utf8") === text) return file;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
  return file;
}
