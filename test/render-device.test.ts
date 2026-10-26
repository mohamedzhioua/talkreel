import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmdRender } from "../src/commands/render.js";
import { run } from "../src/proc.js";
import { emptyState } from "../src/schema.js";
import { parseScriptFile } from "../src/script.js";
import { currentAlignHash, currentVoiceHash } from "../src/stages.js";
import { chapterKey, recordStage, WHISPER_MODEL, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

vi.mock("../src/proc.js", () => ({ run: vi.fn() }));
vi.mock("../src/ffmpeg.js", async (original) => ({ ...await original<object>(), findTool: (n: string) => n, requireTool: (n: string) => n }));
afterEach(() => vi.restoreAllMocks());

describe("chapter render raster mode", () => {
  it.each(["landscape", "portrait", "square"] as const)("derives software raster from each composed %s chapter's device plan", async (resolution) => {
    const talk = loadTalk(makeTalk({
      "sources.json": '{"sources":[]}',
      "script/en/01-device.md": "# Device\n\nHello.\n",
      "script/en/02-plain.md": "# Plain\n\nHello.\n",
      "scenes/01-device.html": '<section data-beat="demo"><div data-block="device" data-frame="browser"><img src="assets/screen.png" alt="Dashboard"></div></section>',
      "scenes/02-plain.html": '<section data-beat="demo"><p>Hello.</p></section>',
      "assets/screen.png": "image bytes",
      ...Object.fromEntries(["01", "02"].map((ch) => [`captions/en/${ch}.json`, JSON.stringify({ lang: "en", words: [{ text: "Hello.", start: 0, end: 1, matched: true }] })])),
    }, { resolution, voice: { mode: "own" } }));
    const state = emptyState();
    for (const ch of listChapters(talk, "en")) {
      for (const wav of [paths.sourceWav(talk, "en", ch.chapter), paths.narrationWav(talk, "en", ch.chapter)]) {
        mkdirSync(dirname(wav), { recursive: true });
        writeWav(wav, 2);
      }
      const parsed = parseScriptFile(ch.file), key = chapterKey("en", ch.chapter);
      recordStage(state, "voice", key, (await currentVoiceHash(talk, ch, parsed))!);
      recordStage(state, "align", key, (await currentAlignHash(talk, ch, parsed, WHISPER_MODEL))!);
    }
    writeState(paths.state(talk), state);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(run).mockReset().mockImplementation(async (_exe, args) => {
      if (args.includes("format=duration")) return { code: 0, stdout: "2\n", stderr: "" };
      const output = args.includes("render") ? args[args.indexOf("--output") + 1] : args.includes("concat") ? args.at(-1) : undefined;
      if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, "video bytes"); }
      return { code: 0, stdout: "", stderr: "" };
    });
    expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(0);
    const renders = vi.mocked(run).mock.calls.map(([, args]) => args).filter((args) => args.includes("render"));
    expect(renders).toHaveLength(2);
    expect(renders[0]).toContain("--no-browser-gpu");
    expect(renders[1]).not.toContain("--no-browser-gpu");
  });
});
