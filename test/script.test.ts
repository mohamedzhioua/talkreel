import { describe, expect, it } from "vitest";
import { cueWordIndex, parseScript, ScriptError, spokenHash } from "../src/script.js";
import { sceneInputHash } from "../src/compose.js";
import { resolveCues } from "../src/cues.js";

const SAMPLE = `# Why agents need specs

{#intro}Teams ship faster with agents [s:dora-2025]. But **speed** without a spec
is just _guessing_ {#guess}.

## A sub-heading that is never spoken

- Write the [design doc](https://example.com) first.
- Then run \`npm test\` {#tests} every time [s:a, b].
<!-- a note to self -->
Done {#end}
`;

describe("parseScript", () => {
  const ch = parseScript(SAMPLE);

  it("reads the title from the first heading", () => {
    expect(ch.title).toBe("Why agents need specs");
  });

  it("strips markdown, headings, comments and markers from the spoken words", () => {
    expect(ch.words.join(" ")).toBe(
      "Teams ship faster with agents. But speed without a spec is just guessing. Write the design doc first. Then run npm test every time. Done",
    );
    expect(ch.spokenText).toBe(
      "Teams ship faster with agents. But speed without a spec is just guessing.\n\nWrite the design doc first. Then run npm test every time. Done",
    );
  });

  it("records cue positions as word indices of the following word", () => {
    const cues = Object.fromEntries(ch.cues.map((c) => [c.id, c.wordIndex]));
    expect(cues).toEqual({ intro: 0, guess: 13, tests: 22, end: 25 });
    expect(ch.words[cues.tests!]).toBe("every");
    // A cue after the last word clamps to the last word for timing.
    expect(cueWordIndex(ch, ch.cues.find((c) => c.id === "guess")!)).toBe(13);
    const tail = parseScript("# T\n\nhello world {#after}");
    expect(cueWordIndex(tail, tail.cues[0]!)).toBe(1);
  });

  it("records citations with ids, positions and lines", () => {
    expect(ch.citations.map((c) => [c.id, c.wordIndex, c.line])).toEqual([
      ["dora-2025", 5, 3],
      ["a", 24, 9],
      ["b", 24, 9],
    ]);
  });

  it("rejects a script without a title heading", () => {
    expect(() => parseScript("Just text")).toThrow(ScriptError);
  });
});

describe("spokenHash", () => {
  const base = parseScript("# T\n\nAgents write code [s:x]. {#a}Humans review it.");
  it("ignores citation and cue markers", () => {
    expect(spokenHash(parseScript("# T\n\nAgents write code [s:other]. Humans review it. {#b}"))).toBe(spokenHash(base));
    expect(spokenHash(parseScript("# Another title\n\nAgents write code. Humans review it."))).toBe(spokenHash(base));
  });
  it("changes when the spoken words change", () => {
    expect(spokenHash(parseScript("# T\n\nAgents write code. People review it."))).not.toBe(spokenHash(base));
  });
});

describe("resolveCues", () => {
  it("maps each cue to the start of its word", () => {
    const ch = parseScript("# T\n\nOne two {#b}three four");
    const captions = { lang: "en", words: ch.words.map((text, i) => ({ text, start: i, end: i + 0.5, matched: true })) };
    expect(resolveCues(ch, captions)).toEqual({ b: 2 });
  });
  it("refuses captions that do not match the script", () => {
    const ch = parseScript("# T\n\nOne two {#b}three four");
    expect(() => resolveCues(ch, { lang: "en", words: [] })).toThrow(/re-run/);
  });
});

describe("display forms", () => {
  it("speaks the second form, records the first for captions, keeps the punctuation around it", () => {
    const ch = parseScript("# T\n\nIt speaks [[MCP|M C P]], and ([[122|one hundred twenty-two]]) {#n}tests pass.\n");
    expect(ch.spokenText).toBe("It speaks M C P, and (one hundred twenty-two) tests pass.");
    expect(ch.displays).toEqual([
      { first: 2, count: 3, text: "MCP," },
      { first: 6, count: 3, text: "(122)" },
    ]);
    // Cues still count spoken words.
    expect(ch.cues[0]!.wordIndex).toBe(9);
    expect(ch.words[9]).toBe("tests");
  });

  it("changes the spoken hash only through the spoken form", () => {
    const a = parseScript("# T\n\nRun [[npm test|N P M test]] now.\n");
    const b = parseScript("# T\n\nRun [[npm run test|N P M test]] now.\n");
    expect(spokenHash(a)).toBe(spokenHash(b));
    expect(a.displays[0]!.text).not.toBe(b.displays[0]!.text);
  });
});

describe("chapter tag", () => {
  it("reads {tag: X} from the heading and falls back to the title", () => {
    const a = parseScript("# Idea to spec {tag: Spec}\n\nHello.\n");
    expect([a.title, a.tag]).toEqual(["Idea to spec", "Spec"]);
    const b = parseScript("# Idea to spec\n\nHello.\n");
    expect([b.title, b.tag]).toEqual(["Idea to spec", "Idea to spec"]);
    expect(spokenHash(a)).toBe(spokenHash(b));
  });
});

describe("scene input hash", () => {
  it("changes when a display form or the tag changes, not when nothing does", () => {
    const h = (src: string) => sceneInputHash("<section data-beat=\"a\"></section>", parseScript(src), new Map());
    const base = h("# T {tag: A}\n\nRun [[npm test|N P M test]].\n");
    expect(h("# T {tag: A}\n\nRun [[npm test|N P M test]].\n")).toBe(base);
    expect(h("# T {tag: B}\n\nRun [[npm test|N P M test]].\n")).not.toBe(base);
    expect(h("# T {tag: A}\n\nRun [[npm run test|N P M test]].\n")).not.toBe(base);
  });
});
