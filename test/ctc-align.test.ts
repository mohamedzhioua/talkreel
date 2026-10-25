import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as helper from "../src/audio-helper.js";
import { cmdAlign } from "../src/commands/align.js";
import { cmdDoctor, doctorChecks } from "../src/commands/doctor.js";
import { sha256, sha256File } from "../src/hash.js";
import { run } from "../src/proc.js";
import { emptyState } from "../src/schema.js";
import { parseScriptFile, spokenHash } from "../src/script.js";
import { chapterStatus, currentAlignHash, currentVoiceHash } from "../src/stages.js";
import { alignInputHash, CTC_MODEL, readState, recordStage, WHISPER_MODEL, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { alignWords } from "../src/align-map.js";
import { makeTalk } from "./helpers.js";

vi.mock("../src/proc.js", () => ({ run: vi.fn() }));
vi.mock("../src/ffmpeg.js", async (original) => ({ ...await original<object>(), findTool: () => "ffmpeg" }));

const revision = CTC_MODEL.slice(4);
let installed: boolean;
let cached: boolean;

function report(): helper.ModelsReport {
  return {
    cache_dir: "cache",
    kokoro: { present: true, files: [] },
    whisper: { present: true, model: "small" },
    ctc: { available: installed, present: cached, model: "jonatasgrosman/wav2vec2-large-xlsr-53-arabic", revision },
  };
}

beforeEach(() => {
  installed = false;
  cached = false;
  vi.mocked(run).mockReset().mockImplementation(async (_exe, args) => {
    let value: unknown;
    if (args.includes("models")) value = report();
    else if (args.includes("tts")) value = { duration: 1, sample_rate: 24000 };
    else if (args.includes("ctc-align") || args.includes("align")) {
      value = {
        lang: args[args.indexOf("--lang") + 1], model: args.includes("ctc-align") ? CTC_MODEL : WHISPER_MODEL,
        duration: 1, words: [{ word: "هذا", start: 0.1, end: 0.3 }, { word: "كلام", start: 0.4, end: 0.6 }, { word: "جيد", start: 0.7, end: 0.9 }],
      };
    }
    return { code: 0, stdout: value ? JSON.stringify(value) : "tool present", stderr: "" };
  });
});

afterEach(() => vi.restoreAllMocks());

async function preparedTalk(lang = "ar") {
  const talk = loadTalk(makeTalk({ [`script/${lang}/01-intro.md`]: "# Intro\n\nهذا كلام جيد\n" }, { languages: [lang], voice: { mode: "own" } }));
  const ch = listChapters(talk, lang)[0]!;
  for (const path of [paths.sourceWav(talk, lang, "01"), paths.narrationWav(talk, lang, "01")]) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, readFileSync(new URL("../py/tests/fixtures/hello.wav", import.meta.url)));
  }
  const state = emptyState();
  recordStage(state, "voice", `${lang}/01`, (await currentVoiceHash(talk, ch, parseScriptFile(ch.file)))!);
  writeState(paths.state(talk), state);
  return { talk, ch };
}

describe("Arabic alignment engine and process boundary", () => {
  it.each([false, true])("selects Arabic CTC only with the group installed (%s)", async (available) => {
    installed = available;
    expect(await helper.alignmentModel("ar")).toBe(available ? CTC_MODEL : WHISPER_MODEL);
    const probes = vi.mocked(run).mock.calls;
    expect(probes).toHaveLength(1);
    expect(probes[0]![1]).toContain("--no-sync");
    expect(probes[0]![1]).not.toContain("--group");
    for (const lang of ["en", "fr"]) expect(await helper.alignmentModel(lang)).toBe(WHISPER_MODEL);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("uses --group arabic only for an installed CTC call and passes script text via a file", async () => {
    installed = true;
    expect((await helper.ctcAlign("audio.wav", "script.txt")).model).toBe(CTC_MODEL);
    await helper.align("audio.wav", "fr", WHISPER_MODEL);
    await helper.tts("script.txt", "af_heart", "en", "out.wav");
    const calls = vi.mocked(run).mock.calls;
    expect(calls.map(([, args]) => args.includes("--group"))).toEqual([false, true, false, false]);
    const args = calls[1]![1];
    expect(args.slice(0, 8)).toEqual(["run", "--quiet", "--project", helper.PY_DIR, "--no-sync", "--group", "arabic", "python"]);
    expect(args.slice(8)).toEqual(["-m", "talkreel_audio", "ctc-align", "--wav", "audio.wav", "--text-file", "script.txt", "--lang", "ar"]);
    expect(calls.every(([exe]) => exe === "uv")).toBe(true);
  });

  it("refuses CTC without an installed group before invoking uv with --group", async () => {
    await expect(helper.ctcAlign("a.wav", "t.txt")).rejects.toThrow("install the arabic group for script-level Arabic alignment");
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(run).mock.calls[0]![1]).not.toContain("--group");
  });

  it.each([false, true])("runs cmdAlign with the selected engine, hint and recorded model hash (%s)", async (available) => {
    installed = available;
    const { talk, ch } = await preparedTalk();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAlign(talk, "ar")).toBe(0);
    const commands = vi.mocked(run).mock.calls.map(([, args]) => args);
    expect(commands.some((args) => args.includes("ctc-align"))).toBe(available);
    expect(commands.some((args) => args.includes("align"))).toBe(!available);
    expect(errors.mock.calls).toEqual(available ? [] : [["install the arabic group for script-level Arabic alignment"]]);
    if (available) expect(readFileSync(paths.spokenText(talk, "ar", "01"), "utf8")).toBe("هذا كلام جيد\n");
    const raw = JSON.parse(readFileSync(paths.whisperRaw(talk, "ar", "01"), "utf8"));
    expect(raw.model).toBe(available ? CTC_MODEL : WHISPER_MODEL);
    const expected = alignInputHash({ wavHash: await sha256File(paths.narrationWav(talk, "ar", "01")), spokenHash: spokenHash(parseScriptFile(ch.file)), model: raw.model });
    expect(readState(paths.state(talk)).stages.align["ar/01"]!.hash).toBe(expected);
    const captions = JSON.parse(readFileSync(paths.captions(talk, "ar", "01"), "utf8"));
    expect(captions.words.map((w: { text: string }) => w.text)).toEqual(["هذا", "كلام", "جيد"]);
  });
});

describe("alignment freshness", () => {
  it("preserves the exact pre-CTC Whisper hash bytes", () => {
    const oldHash = sha256('{"model":"small","spokenHash":"s","stage":"align","wavHash":"w"}');
    expect(alignInputHash({ wavHash: "w", spokenHash: "s", model: WHISPER_MODEL })).toBe(oldHash);
    expect(alignInputHash({ wavHash: "w", spokenHash: "s", model: CTC_MODEL })).not.toBe(oldHash);
  });

  it("makes an existing Arabic alignment stale when the group becomes available", async () => {
    const { talk, ch } = await preparedTalk();
    const parsed = parseScriptFile(ch.file);
    const state = readState(paths.state(talk));
    const oldHash = (await currentAlignHash(talk, ch, parsed))!;
    recordStage(state, "align", "ar/01", oldHash);
    const captions = paths.captions(talk, "ar", "01");
    mkdirSync(dirname(captions), { recursive: true });
    writeFileSync(captions, "{}");
    expect((await chapterStatus(talk, state, ch)).align.status).toBe("fresh");
    installed = true;
    expect((await chapterStatus(talk, state, ch)).align).toEqual({ status: "stale", reason: "inputs changed" });
    const newHash = await currentAlignHash(talk, ch, parsed);
    expect(newHash).toBe(alignInputHash({ wavHash: await sha256File(paths.narrationWav(talk, "ar", "01")), spokenHash: spokenHash(parsed), model: CTC_MODEL }));
    cached = true;
    expect(await currentAlignHash(talk, ch, parsed)).toBe(newHash);
  });

  it.each(["en", "fr"])("keeps %s on Whisper when the group is installed", async (lang) => {
    const { talk, ch } = await preparedTalk(lang);
    const parsed = parseScriptFile(ch.file);
    const oldHash = await currentAlignHash(talk, ch, parsed);
    installed = true;
    expect(await currentAlignHash(talk, ch, parsed)).toBe(oldHash);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("digit interpolation", () => {
  it.each(["90", "٩٠", "٩٠٪"])("interpolates an omitted %s between Arabic script words", (digits) => {
    const result = alignWords(["هَذا", digits, "جيد"], [
      { word: "هذا", start: 0.1, end: 0.3 }, { word: "جيد", start: 0.7, end: 0.9 },
    ], { duration: 1 });
    expect(result.words).toEqual([
      { text: "هَذا", start: 0.1, end: 0.3, matched: true },
      { text: digits, start: 0.3, end: 0.7, matched: false },
      { text: "جيد", start: 0.7, end: 0.9, matched: true },
    ]);
  });
});

describe("optional Arabic doctor checks", () => {
  it.each([false, true])("reports both group and pinned model as optional (%s)", async (present) => {
    installed = cached = present;
    const checks = await doctorChecks();
    expect(checks.find((c) => c.name === "arabic group")).toMatchObject({ ok: present, optional: true });
    expect(checks.find((c) => c.name === "Arabic CTC model")).toMatchObject({ ok: present, optional: true, detail: expect.stringContaining(revision) });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdDoctor(true)).toBe(0);
    expect(JSON.parse(log.mock.calls[0]![0]).filter((c: { optional?: boolean }) => c.optional)).toHaveLength(2);
    log.mockClear();
    expect(await cmdDoctor(false)).toBe(0);
    expect(log.mock.calls.some(([line]) => String(line).includes(`${present ? "ok" : "OPTIONAL"}`) && String(line).includes("arabic group"))).toBe(true);
  });
});
