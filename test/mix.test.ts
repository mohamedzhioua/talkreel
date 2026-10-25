import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdRender } from "../src/commands/render.js";
import { statusReport } from "../src/commands/status.js";
import { buildPaths } from "../src/compose.js";
import { concatOutput, concatOutputs, outPaths } from "../src/compose-concat.js";
import { creditsTxt, loudnormFilter, MIX_PARAMS, mixApplyArgs, mixFilterGraph, mixMeasureArgs, mixOutputs, parseLoudnorm, talkBed, voiceCredit } from "../src/compose-mix.js";
import { hashJson, sha256File } from "../src/hash.js";
import { run } from "../src/proc.js";
import { emptyState, talkConfigProblems, type TalkConfig } from "../src/schema.js";
import { parseScriptFile } from "../src/script.js";
import { currentAlignHash, currentConcatHash, currentMixHash, currentRenderHash, currentVoiceHash } from "../src/stages.js";
import { chapterKey, concatInputHash, mixInputHash, readState, recordStage, WHISPER_MODEL, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths, type Talk } from "../src/talk.js";
import { defaultTalkConfig } from "../src/commands/new.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

vi.mock("../src/proc.js", () => ({ run: vi.fn() }));
vi.mock("../src/ffmpeg.js", async (original) => ({ ...await original<object>(), findTool: (n: string) => n, requireTool: (n: string) => n }));

const MUSIC = { file: "assets/music/bed.mp3", credit: "Bed by A. Composer", license: "CC-BY-4.0" };

function put(p: string, content: string | Buffer) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

const LOUDNORM_STDERR = `[Parsed_loudnorm_9 @ 0000020eae106440]
{
	"input_i" : "-22.89",
	"input_tp" : "-18.67",
	"input_lra" : "2.90",
	"input_thresh" : "-35.06",
	"output_i" : "-13.93",
	"output_tp" : "-9.13",
	"output_lra" : "3.30",
	"output_thresh" : "-25.78",
	"normalization_type" : "dynamic",
	"target_offset" : "-0.07"
}
size=N/A time=00:00:10.00 bitrate=N/A speed=6.48x
`;

beforeEach(() => {
  vi.mocked(run).mockReset().mockImplementation(async (_exe, args) => {
    if (args.includes("format=duration")) return { code: 0, stdout: "2.5\n", stderr: "" };
    if (args.includes("null")) return { code: 0, stdout: "", stderr: LOUDNORM_STDERR };
    // Deterministic bytes: an identical re-join must look identical to the mix hash.
    put(args[args.length - 1]!, `ffmpeg ${args.includes("concat") ? "concat" : "mix"}`);
    return { code: 0, stdout: "", stderr: "" };
  });
});

afterEach(() => vi.restoreAllMocks());

describe("talk.json music", () => {
  const base = defaultTalkConfig("x", "X");
  it("accepts {file, credit, license, gainDb?} under assets/", () => {
    expect(talkConfigProblems({ ...base, music: MUSIC })).toEqual([]);
    expect(talkConfigProblems({ ...base, music: { ...MUSIC, gainDb: -24 } })).toEqual([]);
  });

  it("rejects absolute paths, .. escapes, paths outside assets/ and bad fields", () => {
    const path = "talk.json: music.file must be a relative path under assets/ (no absolute path, backslash, or . or .. segments)";
    for (const file of ["/abs/bed.mp3", "C:/music/bed.mp3", "C:\\music\\bed.mp3", "assets/../bed.mp3", "assets/music/../../x.mp3", "music/bed.mp3", "assets\\music\\bed.mp3", "assets//bed.mp3", "assets/./bed.mp3", "assets/", ""]) {
      expect(talkConfigProblems({ ...base, music: { ...MUSIC, file } })).toEqual([path]);
    }
    expect(talkConfigProblems({ ...base, music: "assets/bed.mp3" })).toEqual(["talk.json: music must be an object {file, credit, license, gainDb?}"]);
    expect(talkConfigProblems({ ...base, music: { file: MUSIC.file, credit: " ", license: 1 } })).toEqual([
      "talk.json: music.credit must be a non-empty string",
      "talk.json: music.license must be a non-empty string",
    ]);
    for (const gainDb of [3, -61, "-18"]) {
      expect(talkConfigProblems({ ...base, music: { ...MUSIC, gainDb } })).toEqual(["talk.json: music.gainDb must be a number from -60 to 0 (dB)"]);
    }
  });

  it("loadTalk requires the file to exist inside the talk's assets/ folder", () => {
    expect(() => loadTalk(makeTalk({}, { music: MUSIC }))).toThrow("talk.json: music.file is missing: assets/music/bed.mp3");
    expect(() => loadTalk(makeTalk({ "assets/music/bed.mp3/x": "dir" }, { music: MUSIC }))).toThrow(/must be a file inside the talk's assets\/ folder/);
    const talk = loadTalk(makeTalk({ "assets/music/bed.mp3": "id3" }, { music: MUSIC }));
    expect(talkBed(talk)).toEqual({ file: join(talk.dir, "assets", "music", "bed.mp3"), gainDb: -18 });
  });

  it("loadTalk rejects a symlink in assets/ that points outside it", (ctx) => {
    const outside = mkdtempSync(join(tmpdir(), "talkreel-outside-"));
    writeFileSync(join(outside, "bed.mp3"), "id3");
    const dir = makeTalk({ "assets/.keep": "" }, { music: MUSIC });
    try {
      // A directory junction needs no privilege on Windows; elsewhere it is a plain symlink.
      symlinkSync(outside, join(dir, "assets", "music"), "junction");
    } catch {
      ctx.skip();
    }
    expect(() => loadTalk(dir)).toThrow(/must be a file inside the talk's assets\/ folder \(including symlink targets\)/);
  });
});

describe("concat without and with music", () => {
  it("keeps the M2 concat hash bytes without music; music adds music: true", () => {
    // Pinned from M2 (HEAD 53356c0): hashJson({ stage: "concat", chapters: ["a", "b"] }).
    expect(concatInputHash(["a", "b"])).toBe("c5098a0d8beec479d0dc6caaa9da3399926a40cc74a466213d8d17fa3ed7229f");
    expect(concatInputHash(["a", "b"], false)).toBe("c5098a0d8beec479d0dc6caaa9da3399926a40cc74a466213d8d17fa3ed7229f");
    expect(concatInputHash(["a", "b"], true)).toBe(hashJson({ stage: "concat", chapters: ["a", "b"], music: true }));
    expect(concatInputHash(["a", "b"], true)).not.toBe(concatInputHash(["a", "b"]));
  });

  it("writes out/<slug>-<lang>.mp4 without music and build/<lang>/concat.mp4 with it", () => {
    const plain = loadTalk(makeTalk({}));
    const out = outPaths(plain, "en");
    expect(concatOutput(plain, "en")).toBe(out.video);
    expect(concatOutputs(plain, "en")).toEqual([out.video, out.chapters, out.transcript]);
    const music = loadTalk(makeTalk({ "assets/music/bed.mp3": "id3" }, { music: MUSIC }));
    expect(concatOutput(music, "en").replace(/\\/g, "/")).toMatch(/\/build\/en\/concat\.mp4$/);
    expect(concatOutputs(music, "en").slice(1)).toEqual([outPaths(music, "en").chapters, outPaths(music, "en").transcript]);
    expect(mixOutputs(music, "en")).toEqual([outPaths(music, "en").video, outPaths(music, "en").credits]);
  });

  it("an empty mix stage is not written, so M2 state files keep their bytes", () => {
    const dir = makeTalk({});
    const file = join(dir, "talk.state.json");
    const s = emptyState();
    recordStage(s, "concat", "en", "abc", new Date("2026-10-21T00:00:00Z"));
    writeState(file, s);
    const m2 = { version: 1, stages: { voice: {}, align: {}, render: {}, concat: { en: { hash: "abc", updated: "2026-10-21T00:00:00.000Z" } } } };
    expect(readFileSync(file, "utf8")).toBe(JSON.stringify(m2, null, 2) + "\n");
    expect(readState(file).stages.mix).toEqual({});
    recordStage(s, "mix", "en", "def");
    writeState(file, s);
    expect(readState(file).stages.mix.en!.hash).toBe("def");
  });
});

describe("mix ffmpeg arguments", () => {
  const bed = { file: "/t/assets/music/bed.mp3", gainDb: -18 };
  const fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
  const graph = (loudnorm: string) =>
    `[1:a]atrim=duration=20,asetpts=PTS-STARTPTS,${fmt},volume=-18dB,afade=t=out:st=18.5:d=1.5[bed];` +
    `[0:a]${fmt},asplit=2[voice][key];` +
    "[bed][key]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=400[ducked];" +
    `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,${loudnorm},aresample=48000,atrim=duration=20[out]`;
  const measured = parseLoudnorm(LOUDNORM_STDERR);
  const applied = "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-22.89:measured_TP=-18.67:measured_LRA=2.90:measured_thresh=-35.06:offset=-0.07:linear=true";

  it("pass 1 loops the bed, trims it, fades it out over 1.5 s, ducks it under the narration and measures loudness", () => {
    expect(mixMeasureArgs("/t/build/en/concat.mp4", 20, bed)).toEqual([
      "-hide_banner", "-nostats", "-loglevel", "info",
      "-i", "/t/build/en/concat.mp4", "-stream_loop", "-1", "-i", "/t/assets/music/bed.mp3",
      "-filter_complex", graph("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json"),
      "-map", "[out]", "-f", "null", "-",
    ]);
  });

  it("pass 2 applies the measured values, copies the video, keeps the joined length and encodes AAC 192k at 48 kHz", () => {
    expect(mixApplyArgs("/t/build/en/concat.mp4", "/t/out/demo-en.mp4", 20, measured, bed)).toEqual([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", "/t/build/en/concat.mp4", "-stream_loop", "-1", "-i", "/t/assets/music/bed.mp3",
      "-filter_complex", graph(applied),
      "-map", "0:v:0", "-map", "[out]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart",
      "/t/out/demo-en.mp4",
    ]);
  });

  it("uses the configured gain, shortens the fade for a clip under 1.5 s, and works without a bed", () => {
    expect(mixFilterGraph(1, { ...bed, gainDb: -24.5 }, "loudnorm")).toContain("[1:a]atrim=duration=1,asetpts=PTS-STARTPTS," + fmt + ",volume=-24.5dB,afade=t=out:st=0:d=1[bed]");
    expect(mixFilterGraph(20, undefined, loudnormFilter())).toBe(`[0:a]${fmt},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json,aresample=48000,atrim=duration=20[out]`);
    expect(mixMeasureArgs("/in.mp4", 20)).not.toContain("-stream_loop");
    expect(mixApplyArgs("/in.mp4", "/out.mp4", 20, measured)).toContain("copy");
  });

  it("parses the last loudnorm block and refuses silence", () => {
    expect(measured).toEqual({ input_i: "-22.89", input_tp: "-18.67", input_lra: "2.90", input_thresh: "-35.06", target_offset: "-0.07" });
    expect(() => parseLoudnorm("no json here")).toThrow(/printed no measurement/);
    expect(() => parseLoudnorm(LOUDNORM_STDERR.replace('"-22.89"', '"-inf"'))).toThrow(/input_i = "-inf"; the mix is silent/);
  });

  it("pins the loudness target and fade in the hashed params", () => {
    expect(MIX_PARAMS.loudness).toEqual({ I: -14, TP: -1.5, LRA: 11 });
    expect(MIX_PARAMS.fadeOut).toBe(1.5);
    expect(MIX_PARAMS.audio).toEqual({ codec: "aac", bitrate: "192k", sampleRate: 48000, channels: 2 });
  });
});

describe("mix hash", () => {
  it("is the concat MP4 hash, the music sha256 and gain, and the params", () => {
    const base = { concatHash: "c", music: { sha256: "m", gainDb: -18 }, params: MIX_PARAMS };
    const h = mixInputHash(base);
    expect(mixInputHash({ ...base })).toBe(h);
    expect(mixInputHash({ ...base, concatHash: "c2" })).not.toBe(h);
    expect(mixInputHash({ ...base, music: { sha256: "m2", gainDb: -18 } })).not.toBe(h);
    expect(mixInputHash({ ...base, music: { sha256: "m", gainDb: -20 } })).not.toBe(h);
    expect(mixInputHash({ ...base, params: { ...MIX_PARAMS, version: 2 } })).not.toBe(h);
    expect(mixInputHash({ concatHash: "c", params: MIX_PARAMS })).not.toBe(h);
  });
});

describe("credits.txt", () => {
  it("lists the music, the voice engine per language with its watermark note, and the fonts", () => {
    const talk = loadTalk(makeTalk({ "assets/music/bed.mp3": "id3" }, { languages: ["en", "fr"], music: MUSIC }));
    const txt = creditsTxt(talk);
    expect(txt).toContain("Music\n  File: assets/music/bed.mp3\n  Credit: Bed by A. Composer\n  Licence: CC-BY-4.0\n");
    expect(txt).toContain("  en: Kokoro-82M (Apache-2.0) via kokoro-onnx, kokoro-onnx/kokoro-v1.0, voice af_heart\n      Watermark: none\n");
    expect(txt).toContain("  fr: Kokoro-82M (Apache-2.0) via kokoro-onnx, kokoro-onnx/kokoro-v1.0, voice ff_siwis\n      Watermark: none\n");
    expect(txt).toMatch(/Fonts\n {2}Inter \S+ \(@fontsource\/inter, OFL-1\.1\)\n {2}JetBrains Mono \S+ \(@fontsource\/jetbrains-mono, OFL-1\.1\)\n {2}IBM Plex Sans Arabic \S+ \(@fontsource\/ibm-plex-sans-arabic, OFL-1\.1\)\n$/);
    expect(voiceCredit({ ...talk, config: { ...talk.config, voice: { mode: "own" } } }, "en")).toEqual({ engine: "own voice (the author's recording)", watermark: "none" });
  });
});

/** A one-chapter talk whose voice, align and render stages are fresh, so render goes straight to concat. */
async function renderedTalk(config: Partial<TalkConfig> = {}): Promise<Talk> {
  const caps = JSON.stringify({ lang: "en", words: ["Hello", "there."].map((text, k) => ({ text, start: k * 0.4, end: k * 0.4 + 0.3, matched: true })) });
  const dir = makeTalk({
    "sources.json": JSON.stringify({ sources: [] }),
    "script/en/01-a.md": "# A\n\nHello {#b}there.\n",
    "scenes/01-a.html": `<section data-beat="x"><p>Hi</p></section><section data-beat="y" data-cue="b"><p>There</p></section>`,
    "captions/en/01.json": caps,
    ...(config.music ? { [config.music.file]: "music v1" } : {}),
  }, { voice: { mode: "own" }, ...config });
  const talk = loadTalk(dir);
  const state = emptyState();
  for (const ch of listChapters(talk, "en")) {
    const key = chapterKey("en", ch.chapter);
    for (const wav of [paths.sourceWav(talk, "en", ch.chapter), paths.narrationWav(talk, "en", ch.chapter)]) {
      mkdirSync(dirname(wav), { recursive: true });
      writeWav(wav, 1);
    }
    const parsed = parseScriptFile(ch.file);
    recordStage(state, "voice", key, (await currentVoiceHash(talk, ch, parsed))!);
    recordStage(state, "align", key, (await currentAlignHash(talk, ch, parsed, WHISPER_MODEL))!);
    put(buildPaths.mp4(talk, "en", ch.chapter), `mp4 ${ch.chapter}`);
    put(buildPaths.renderInfo(talk, "en", ch.chapter), JSON.stringify({ quality: "draft" }));
    recordStage(state, "render", key, (await currentRenderHash(talk, ch, "draft"))!);
  }
  writeState(paths.state(talk), state);
  return talk;
}

/** ffmpeg calls made through proc.run, by kind. */
function ffmpegCalls(): { kind: "concat" | "measure" | "apply" | "probe"; args: string[] }[] {
  return vi.mocked(run).mock.calls.map(([, args]) => ({
    kind: args.includes("format=duration") ? "probe" : args.includes("concat") ? "concat" : args.includes("null") ? "measure" : "apply",
    args,
  }));
}

const quiet = () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("render without music (M2 path)", () => {
  it("joins straight into out/<slug>-<lang>.mp4 with the M2 concat hash; no mix, no credits", async () => {
    quiet();
    const talk = await renderedTalk();
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const calls = ffmpegCalls().filter((c) => c.kind !== "probe");
    expect(calls.map((c) => c.kind)).toEqual(["concat"]);
    expect(calls[0]!.args.at(-1)).toBe(outPaths(talk, "en").video);
    expect(existsSync(outPaths(talk, "en").credits)).toBe(false);
    expect(existsSync(buildPaths.concatMp4(talk, "en"))).toBe(false);
    const state = readFileSync(paths.state(talk), "utf8");
    expect(JSON.parse(state).stages.mix).toBeUndefined();
    const m2 = hashJson({ stage: "concat", chapters: [await sha256File(buildPaths.mp4(talk, "en", "01"))] });
    expect(readState(paths.state(talk)).stages.concat.en!.hash).toBe(m2);
    expect(await currentConcatHash(talk, "en")).toBe(m2);
    expect((await statusReport(talk)).mix).toBeUndefined();
  });
});

describe("render with music", () => {
  const music = { ...MUSIC, file: "assets/music/bed.wav" };

  it("joins into build/<lang>/concat.mp4, then mixes into out/ and writes credits; a fresh mix is skipped", async () => {
    quiet();
    const talk = await renderedTalk({ music });
    expect((await statusReport(talk)).mix).toEqual({ en: { status: "stale", reason: "never run" } });
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const calls = ffmpegCalls().filter((c) => c.kind !== "probe");
    expect(calls.map((c) => c.kind)).toEqual(["concat", "measure", "apply"]);
    expect(calls[0]!.args.at(-1)).toBe(buildPaths.concatMp4(talk, "en"));
    expect(calls[2]!.args).toEqual(mixApplyArgs(buildPaths.concatMp4(talk, "en"), outPaths(talk, "en").video, 2.5, parseLoudnorm(LOUDNORM_STDERR), talkBed(talk)));
    expect(readFileSync(outPaths(talk, "en").credits, "utf8")).toBe(creditsTxt(talk));
    expect(creditsTxt(talk)).toContain("  en: own voice (the author's recording)\n      Watermark: none\n");
    const state = readState(paths.state(talk));
    expect(state.stages.concat.en!.hash).toBe(await currentConcatHash(talk, "en"));
    expect(state.stages.mix.en!.hash).toBe(await currentMixHash(talk, "en"));
    expect((await statusReport(talk)).mix).toEqual({ en: { status: "fresh" } });

    vi.mocked(run).mockClear();
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    expect(ffmpegCalls().filter((c) => c.kind !== "probe")).toEqual([]);
  });

  it("a music change re-runs only the mix: chapter render and concat hashes stay", async () => {
    quiet();
    const talk = await renderedTalk({ music });
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const ch = listChapters(talk, "en")[0]!;
    const before = { render: await currentRenderHash(talk, ch), concat: await currentConcatHash(talk, "en"), mix: await currentMixHash(talk, "en") };
    writeFileSync(paths.music(talk)!, "music v2");
    expect(await currentRenderHash(talk, ch)).toBe(before.render);
    expect(await currentConcatHash(talk, "en")).toBe(before.concat);
    expect(await currentMixHash(talk, "en")).not.toBe(before.mix);
    expect((await statusReport(talk)).mix).toEqual({ en: { status: "stale", reason: "inputs changed" } });

    vi.mocked(run).mockClear();
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    expect(ffmpegCalls().filter((c) => c.kind !== "probe").map((c) => c.kind)).toEqual(["measure", "apply"]);
  });

  it("a failed mix returns 1, records nothing and leaves no out/ video behind", async () => {
    quiet();
    const talk = await renderedTalk({ music });
    put(outPaths(talk, "en").video, "an older mix");
    const ok = vi.mocked(run).getMockImplementation()!;
    vi.mocked(run).mockImplementation(async (exe, args, opts) => (args.includes("copy") && args.includes("[out]") ? { code: 1, stdout: "", stderr: "encoder exploded" } : ok(exe, args, opts)));
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(1);
    expect(existsSync(outPaths(talk, "en").video)).toBe(false);
    expect(readState(paths.state(talk)).stages.mix.en).toBeUndefined();
    expect(vi.mocked(console.error).mock.calls.map(([m]) => String(m))).toEqual(["en: ffmpeg mix failed:\nencoder exploded"]);
  });

  it("toggling music off and on again re-runs the mix over the unmixed join", async () => {
    quiet();
    const talk = await renderedTalk({ music });
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const off: Talk = { ...talk, config: { ...talk.config, music: undefined } };
    vi.mocked(run).mockClear();
    expect(await cmdRender(off, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const plain = ffmpegCalls().filter((c) => c.kind !== "probe");
    expect(plain.map((c) => [c.kind, c.args.at(-1)])).toEqual([["concat", outPaths(talk, "en").video]]);
    expect(readState(paths.state(talk)).stages.mix.en).toBeUndefined();
    vi.mocked(run).mockClear();
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    expect(ffmpegCalls().filter((c) => c.kind !== "probe").map((c) => c.kind)).toEqual(["concat", "measure", "apply"]);
  });

  it("toggling music on makes concat stale (the hash gains music: true)", async () => {
    quiet();
    const talk = await renderedTalk();
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const plain = await currentConcatHash(talk, "en");
    put(join(talk.dir, music.file), "music v1");
    const withMusic: Talk = { ...talk, config: { ...talk.config, music } };
    expect(await currentConcatHash(withMusic, "en")).not.toBe(plain);
    expect((await statusReport(withMusic)).concat.en).toEqual({ status: "stale", reason: "inputs changed" });
  });
});
