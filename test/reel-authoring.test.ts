import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { check } from "../src/check.js";
import { cmdNew, defaultTalkConfig } from "../src/commands/new.js";
import { cmdStatus, statusReport } from "../src/commands/status.js";
import { parseScene, resolveTimeline } from "../src/compose-scene.js";
import { parseScriptFile } from "../src/script.js";
import { emptyState } from "../src/schema.js";
import { currentVoiceHash } from "../src/stages.js";
import { chapterKey, recordStage, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

afterEach(() => vi.restoreAllMocks());

describe("reel scaffolding", () => {
  it("preserves the original scaffold without --reel", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const root = mkdtempSync(join(tmpdir(), "talkreel-new-"));
    expect(cmdNew(root, "plain", " Plain talk ")).toBe(0);
    const dir = join(root, "talks", "plain");
    expect(readdirSync(dir).sort()).toEqual(["scenes", "script", "sources.json", "talk.json"]);
    expect(readFileSync(join(dir, "talk.json"), "utf8")).toBe(JSON.stringify(defaultTalkConfig("plain", "Plain talk"), null, 2) + "\n");
    expect(readdirSync(join(dir, "script", "en"))).toEqual([]);
    expect(readdirSync(join(dir, "scenes"))).toEqual([]);
    expect(readFileSync(join(dir, "sources.json"), "utf8")).toBe('{\n  "sources": []\n}\n');
  });

  it("creates one portrait chapter that checks after adding its two assets", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const root = mkdtempSync(join(tmpdir(), "talkreel-new-"));
    expect(cmdNew(root, "reel", "Reel", true)).toBe(0);
    const dir = join(root, "talks", "reel");
    const talk = loadTalk(dir);
    expect(talk.config.resolution).toBe("portrait");
    expect(talk.config.voice).toEqual(defaultTalkConfig("reel", "Reel").voice);
    expect(existsSync(join(dir, "assets"))).toBe(true);
    expect(listChapters(talk, "en")).toHaveLength(1);
    const script = parseScriptFile(listChapters(talk, "en")[0]!.file);
    const source = readFileSync(join(dir, "scenes", "01-reel.html"), "utf8");
    for (const block of ["title", "figure", "list", "cta"]) expect(source).toContain(`data-block="${block}"`);
    expect(source).toContain('data-variant="hook"');
    expect(script.cues.map((c) => c.id)).toEqual(["proof", "benefits", "first", "second", "third", "cta"]);
    expect((await check(talk)).every((i) => i.message.startsWith("E_ASSET"))).toBe(true);
    writeFileSync(join(dir, "assets", "proof.jpg"), "author photo");
    writeFileSync(join(dir, "assets", "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>');
    expect(await check(talk)).toEqual([]);
    const cues = Object.fromEntries(script.cues.map((c) => [c.id, c.wordIndex * 0.4]));
    expect(() => resolveTimeline(parseScene(source), cues, script.words.length * 0.4, "portrait")).not.toThrow();
    expect(cmdNew(root, "reel", "Overwrite", true)).toBe(1);
    expect(readFileSync(join(dir, "scenes", "01-reel.html"), "utf8")).toBe(source);
  });
});

describe("status length lint", () => {
  it.each([
    [225, 90, ""],
    [226, 90.4, "long for a reel"],
    [450, 180, "long for a reel"],
    [451, 180.4, "long for a reel; over the Shorts limit"],
  ])("estimates %i spoken words without failing status", async (count, seconds, warning) => {
    const talk = loadTalk(makeTalk({ "script/en/01-a.md": `# A\n\n${"word ".repeat(count)}\n` }, { resolution: "portrait" }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await statusReport(talk)).length).toEqual([{ lang: "en", words: count, seconds, source: "estimate", warning }]);
    expect(await cmdStatus(talk, false)).toBe(0);
    expect(log.mock.calls.flat().filter((s) => String(s).includes("language | words | seconds | source | warning"))).toHaveLength(1);
    expect(log.mock.calls.flat()).toContain(`en | ${count} | ${seconds.toFixed(1)} | estimate | ${warning || "-"}`);
    log.mockClear();
    expect(await cmdStatus(talk, true)).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0]![0]).length).toEqual([{ lang: "en", words: count, seconds, source: "estimate", warning }]);
  });

  it("totals chapters separately for each language and counts spoken display forms", async () => {
    const talk = loadTalk(makeTalk({
      "script/en/01-a.md": `# Heading\n\n<!-- ignored -->\n${"word ".repeat(200)}{#next}[[3|one two three]] [s:ref]`,
      "script/en/02-b.md": `# B\n\n${"word ".repeat(23)}`,
      "script/fr/01-a.md": "# Bonjour\n\nUn mot.",
    }, { languages: ["en", "fr"], resolution: "portrait" }));
    expect((await statusReport(talk)).length).toEqual([
      { lang: "en", words: 226, seconds: 90.4, source: "estimate", warning: "long for a reel" },
      { lang: "fr", words: 2, seconds: 0.8, source: "estimate", warning: "" },
    ]);
  });

  it("keeps invalid and missing scripts non-fatal without reporting partial totals", async () => {
    const talk = loadTalk(makeTalk({ "script/en/01-a.md": "Missing heading" }, { resolution: "portrait" }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await statusReport(talk)).length).toEqual([{ lang: "en", words: null, seconds: null, source: null, warning: "cannot estimate: invalid script" }]);
    expect(await cmdStatus(talk, false)).toBe(0);
    const empty = loadTalk(makeTalk({}, { resolution: "portrait" }));
    expect((await statusReport(empty)).length).toEqual([]);
    expect(await cmdStatus(empty, false)).toBe(0);
  });

  it.each(["landscape", "square"] as const)("omits reel length warnings for %s talks", async (resolution) => {
    const talk = loadTalk(makeTalk({ "script/en/01-a.md": `# A\n\n${"word ".repeat(1500)}` }, { resolution }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await statusReport(talk)).length).toEqual([]);
    expect(await cmdStatus(talk, false)).toBe(0);
    expect(log.mock.calls.flat().join("\n")).not.toMatch(/long for a reel|Shorts limit|language \| words/);
  });

  it.each([
    ["own", 451, 40, ""],
    ["own", 1, 90, ""],
    ["own", 1, 90.4, "long for a reel"],
    ["own", 1, 180, "long for a reel"],
    ["own", 1, 180.4, "long for a reel; over the Shorts limit"],
    ["ai", 451, 40, ""],
    ["ai", 1, 180.4, "long for a reel; over the Shorts limit"],
  ] as const)("uses fresh %s narration instead of %i words for a %s second reel", async (mode, count, seconds, warning) => {
    const talk = loadTalk(makeTalk({
      "script/en/01-a.md": `# A\n\n${"word ".repeat(count)}`,
      "script/en/02-b.md": "# B\n\nWord.",
    }, { resolution: "portrait", voice: { mode, en: "af_heart" } }));
    const state = emptyState();
    for (const ch of listChapters(talk, "en")) {
      for (const file of [paths.sourceWav(talk, "en", ch.chapter), paths.narrationWav(talk, "en", ch.chapter)]) {
        mkdirSync(dirname(file), { recursive: true });
        writeWav(file, seconds / 2);
      }
      recordStage(state, "voice", chapterKey("en", ch.chapter), (await currentVoiceHash(talk, ch, parseScriptFile(ch.file)))!);
    }
    writeState(paths.state(talk), state);
    const expected = [{ lang: "en", words: count + 1, seconds, source: "voiced", warning }];
    expect((await statusReport(talk)).length).toEqual(expected);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdStatus(talk, false)).toBe(0);
    expect(log.mock.calls.flat()).toContain(`en | ${count + 1} | ${seconds.toFixed(1)} | voiced | ${warning || "-"}`);
    log.mockClear();
    expect(await cmdStatus(talk, true)).toBe(0);
    expect(JSON.parse(log.mock.calls[0]![0]).length).toEqual(expected);
  });

  it.each(["missing", "stale", "invalid"])("estimates the whole language when one chapter's narration is %s", async (problem) => {
    const talk = loadTalk(makeTalk({
      "script/en/01-a.md": "# A\n\nWord.",
      "script/en/02-b.md": "# B\n\nWord.",
    }, { resolution: "portrait", voice: { mode: "own" } }));
    const state = emptyState();
    for (const ch of listChapters(talk, "en")) {
      for (const file of [paths.sourceWav(talk, "en", ch.chapter), paths.narrationWav(talk, "en", ch.chapter)]) {
        mkdirSync(dirname(file), { recursive: true });
        writeWav(file, 100);
      }
      recordStage(state, "voice", chapterKey("en", ch.chapter), (await currentVoiceHash(talk, ch, parseScriptFile(ch.file)))!);
    }
    writeState(paths.state(talk), state);
    if (problem === "missing") unlinkSync(paths.narrationWav(talk, "en", "02"));
    if (problem === "stale") writeWav(paths.sourceWav(talk, "en", "02"), 101);
    if (problem === "invalid") writeFileSync(paths.narrationWav(talk, "en", "02"), "invalid WAV");
    expect((await statusReport(talk)).length).toEqual([{ lang: "en", words: 2, seconds: 0.8, source: "estimate", warning: "" }]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdStatus(talk, false)).toBe(0);
  });
});
