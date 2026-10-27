import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as helper from "../src/audio-helper.js";
import { cmdAlign } from "../src/commands/align.js";
import { sha256File } from "../src/hash.js";
import { run } from "../src/proc.js";
import { emptyState } from "../src/schema.js";
import { parseScriptFile, spokenHash } from "../src/script.js";
import { chapterStatus, currentVoiceHash } from "../src/stages.js";
import { alignInputHash, readState, recordStage, WHISPER_MODEL, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { makeTalk } from "./helpers.js";

vi.mock("../src/proc.js", () => ({ run: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("Whisper alignment", () => {
  it.each(["ar", "en", "fr"])("aligns %s without a model probe and records the Whisper hash", async (lang) => {
    const words = lang === "ar" ? ["هذا", "كلام", "جيد"] : ["hello", "world"];
    const talk = loadTalk(makeTalk({ [`script/${lang}/01-intro.md`]: `# Intro\n\n${words.join(" ")}\n` }, { languages: [lang], voice: { mode: "own" } }));
    const ch = listChapters(talk, lang)[0]!;
    const key = `${lang}/${ch.chapter}`;
    for (const path of [paths.sourceWav(talk, lang, ch.chapter), paths.narrationWav(talk, lang, ch.chapter)]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(new URL("../py/tests/fixtures/hello.wav", import.meta.url)));
    }
    const parsed = parseScriptFile(ch.file);
    const state = emptyState();
    recordStage(state, "voice", key, (await currentVoiceHash(talk, ch, parsed))!);
    writeState(paths.state(talk), state);
    vi.mocked(run).mockReset().mockResolvedValue({
      code: 0, stderr: "", stdout: JSON.stringify({
        lang, model: WHISPER_MODEL, duration: 1,
        words: words.map((word, i) => ({ word, start: i * 0.3, end: i * 0.3 + 0.2 })),
      }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await cmdAlign(talk, lang)).toBe(0);
    expect(errors).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(run).mock.calls[0]!.slice(0, 2)).toEqual(["uv", [
      "run", "--quiet", "--project", helper.PY_DIR, "python", "-m", "talkreel_audio",
      "align", "--wav", paths.narrationWav(talk, lang, ch.chapter), "--lang", lang, "--model", WHISPER_MODEL,
    ]]);
    const recorded = readState(paths.state(talk));
    expect(recorded.stages.align[key]!.hash).toBe(alignInputHash({
      wavHash: await sha256File(paths.narrationWav(talk, lang, ch.chapter)),
      spokenHash: spokenHash(parsed), model: WHISPER_MODEL,
    }));
    expect(JSON.parse(readFileSync(paths.whisperRaw(talk, lang, ch.chapter), "utf8")).model).toBe(WHISPER_MODEL);
    expect(JSON.parse(readFileSync(paths.captions(talk, lang, ch.chapter), "utf8")).words.map((w: { text: string }) => w.text)).toEqual(words);
    expect((await chapterStatus(talk, recorded, ch)).align).toEqual({ status: "fresh" });
    expect(await cmdAlign(talk, lang)).toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
