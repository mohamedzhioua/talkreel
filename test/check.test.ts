import { describe, expect, it } from "vitest";
import { check, sceneChecks } from "../src/check.js";
import { GEOMETRY } from "../src/geometry.js";
import { loadTalk } from "../src/talk.js";
import { makeTalk, SOURCES } from "./helpers.js";

describe("talkreel check", () => {
  it.each(["portrait", "square", "landscape"] as const)("uses %s terminal limits", async (resolution) => {
    const length = GEOMETRY.portrait.terminal.maxChars + 1;
    const dir = makeTalk({
      "sources.json": SOURCES,
      "script/en/01-intro.md": "# Intro\n\nHello.\n",
      "scenes/01-intro.html": `<section data-beat="intro"><div data-block="terminal"><p data-out>${"x".repeat(length)}</p></div></section>`,
    }, { resolution });
    expect(await check(loadTalk(dir))).toEqual(resolution === "landscape" ? [] : [{
      file: "scenes/01-intro.html",
      line: 1,
      message: `E_TERM_LINE <p>: ${length} characters; a terminal line holds at most ${GEOMETRY[resolution].terminal.maxChars}`,
    }]);
  });

  it("passes when every [s:id] is in sources.json", async () => {
    const dir = makeTalk({ "sources.json": SOURCES, "script/en/01-intro.md": "# Intro\n\nTeams ship faster [s:dora].\n" });
    expect(await check(loadTalk(dir))).toEqual([]);
  });

  it("fails on an unknown [s:id] with file and line", async () => {
    const dir = makeTalk({ "sources.json": SOURCES, "script/en/01-intro.md": "# Intro\n\nTeams ship faster [s:dora].\n\nAnd cheaper [s:made-up].\n" });
    const issues = await check(loadTalk(dir));
    expect(issues).toEqual([{ file: "script/en/01-intro.md", line: 5, message: "unknown source [s:made-up] (not in sources.json)" }]);
  });

  it("fails on a missing title, duplicate cues and a bad sources.json", async () => {
    const dir = makeTalk({
      "sources.json": JSON.stringify({ sources: [{ id: "x" }] }),
      "script/en/01-a.md": "no heading\n",
      "script/en/02-b.md": "# B\n\n{#c}One {#c}two\n",
    });
    const msgs = (await check(loadTalk(dir))).map((i) => i.message);
    expect(msgs.some((m) => m.includes("sources[0].title"))).toBe(true);
    expect(msgs.some((m) => m.includes("# Chapter title"))).toBe(true);
    expect(msgs).toContain("duplicate cue {#c}");
  });

  it("runs the registered scene checks", async () => {
    const dir = makeTalk({ "sources.json": SOURCES });
    sceneChecks.push(() => [{ file: "scenes/01-intro.html", message: "stat block without a source" }]);
    try {
      expect(await check(loadTalk(dir))).toEqual([{ file: "scenes/01-intro.html", message: "stat block without a source" }]);
    } finally {
      sceneChecks.pop();
    }
  });
});
