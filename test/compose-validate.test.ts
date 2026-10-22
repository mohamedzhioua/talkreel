import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { prepareScene } from "../src/compose.js";
import { parseScene, SceneError, validateScene, type RuleId } from "../src/compose-scene.js";
import { parseScript } from "../src/script.js";
import { loadTalk } from "../src/talk.js";
import { workedCaptions, WORKED_AUDIO, WORKED_SCENE, WORKED_SCRIPT } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

const SOURCES = new Set(["example-survey", "fowler-context", "example-quote"]);

function rules(html: string, cues?: string[]): RuleId[] {
  return validateScene(parseScene(html), { sources: SOURCES, cues: cues ? new Set(cues) : undefined }).map((i) => i.rule);
}

const ok = `<section data-beat="a"><p>Hello</p></section>`;

describe("scene validator", () => {
  it("accepts every example scene in themes/default/examples", () => {
    const dir = fileURLToPath(new URL("../themes/default/examples/", import.meta.url));
    for (const f of readdirSync(dir)) {
      const html = readFileSync(join(dir, f), "utf8");
      // Examples are single beats that may carry a cue; validate them as a later beat.
      const issues = validateScene(parseScene(`${ok}\n${html.replace(/<section data-beat="(\w+)"(?! data-cue)/, '<section data-beat="$1" data-cue="x"')}`), { sources: SOURCES });
      expect([f, issues]).toEqual([f, []]);
    }
  });

  it("accepts the worked example", () => {
    expect(rules(WORKED_SCENE, parseScript(WORKED_SCRIPT).cues.map((c) => c.id))).toEqual([]);
  });

  const cases: [RuleId, string, string[]?][] = [
    ["E_TOP_LEVEL", `<div>loose</div>${ok}`],
    ["E_TOP_LEVEL", `text at the top${ok}`],
    ["E_BEAT_ID", `<section data-beat="Bad_Id"><p>x</p></section>`],
    ["E_BEAT_ID", `${ok}<section data-beat="a" data-cue="c"><p>x</p></section>`],
    ["E_BAD_CAMERA", `<section data-beat="a" data-camera="zoom"><p>x</p></section>`],
    ["E_FIRST_BEAT_CUE", `<section data-beat="a" data-cue="c"><p>x</p></section>`],
    ["E_BEAT_NO_CUE", `${ok}<section data-beat="b"><p>x</p></section>`],
    ["E_UNKNOWN_CUE", `${ok}<section data-beat="b" data-cue="nope"><p>x</p></section>`, ["known"]],
    ["E_BAD_ANIM", `<section data-beat="a"><p data-anim="spin">x</p></section>`],
    ["E_STEP_UNKNOWN", `<section data-beat="a"><figure data-block="diagram"><pre data-mermaid>flowchart LR\n  A --> B</pre><i data-step data-nodes="C"></i></figure></section>`],
    ["E_STEP_UNKNOWN", `<section data-beat="a"><figure data-block="diagram"><pre data-mermaid>flowchart LR\n  A --> B</pre><i data-step data-edges="A-Z"></i></figure></section>`],
    ["E_SOURCE_MISSING", `<section data-beat="a"><div data-block="stat"><p class="value">1%</p></div></section>`],
    ["E_SOURCE_MISSING", `<section data-beat="a"><figure data-block="quote"><blockquote>q</blockquote></figure></section>`],
    ["E_SOURCE_PLACE", `<section data-beat="a"><div data-block="list" data-source="s:example-survey"><ul><li>x</li></ul></div></section>`],
    ["E_UNKNOWN_SOURCE", `<section data-beat="a"><div data-block="stat" data-source="s:made-up"><p class="value">1%</p></div></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><script>alert(1)</script></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><style>p{}</style></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><img src="x.png"></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><p onclick="x()">x</p></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><p style="color:red">x</p></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><p data-start="3">hard-coded time</p></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><p data-at="0.5">hard-coded time</p></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><a href="https://example.com">x</a></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><a href="//cdn.example.com/x">x</a></section>`],
    ["E_FORBIDDEN", `<section data-beat="a" class="clip"><p>x</p></section>`],
    ["E_FORBIDDEN", `<section data-beat="a"><p id="tr-mine">x</p></section>`],
  ];
  for (const [rule, html, cues] of cases) {
    it(`${rule}: ${html.replace(/\s+/g, " ").slice(0, 90)}`, () => {
      expect(rules(html, cues)).toContain(rule);
    });
  }

  it("data-source is optional on a definition", () => {
    expect(rules(`<section data-beat="a"><div data-block="definition"><p class="term">T</p><p class="text">x</p></div></section>`)).toEqual([]);
  });

  it("E_DUP_CUE and the error message name the file, rule and element", () => {
    const script = "# T\n\n{#a}One two {#a}three.\n";
    const ch = parseScript(script);
    const caps = { lang: "en", words: ch.words.map((text, k) => ({ text, start: k, end: k + 0.5, matched: true })) };
    try {
      prepareScene("scenes/01-t.html", `<section data-beat="x"><p data-cue="a" style="x">y</p></section>`, ch, caps, 3, SOURCES);
      throw new Error("expected a SceneError");
    } catch (e) {
      expect(e).toBeInstanceOf(SceneError);
      const msg = (e as Error).message;
      expect(msg).toContain('scenes/01-t.html:1: E_FORBIDDEN <p data-cue="a">');
      expect(msg).toContain("E_DUP_CUE {#a}");
    }
  });

  it("prepareScene resolves the worked example and warns about unused cues", () => {
    const { timeline, warnings } = prepareScene("w.html", WORKED_SCENE, parseScript(WORKED_SCRIPT + "\n{#unused}Extra words here.\n"), { lang: "en", words: [...workedCaptions().words, ...["Extra", "words", "here."].map((text, i) => ({ text, start: 19 + i * 0.1, end: 19.05 + i * 0.1, matched: true }))] }, WORKED_AUDIO, SOURCES);
    expect(timeline.beats).toHaveLength(3);
    expect(warnings.map((w) => w.message)).toContain("script cue {#unused} is not used by the scene");
  });
});

describe("talkreel check runs the scene validator", () => {
  const SRC = JSON.stringify({ sources: [{ id: "s1", title: "T", publisher: "P", url: "https://example.org", quote: "q", date: "2025-01-01" }] });

  it("fails on a stat block without data-source", async () => {
    const dir = makeTalk({
      "sources.json": SRC,
      "script/en/01-intro.md": "# Intro\n\nHello world.\n",
      "scenes/01-intro.html": `<section data-beat="a"><div data-block="stat"><p class="value">5%</p><p class="label">x</p></div></section>`,
    });
    const issues = await check(loadTalk(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: "scenes/01-intro.html", line: 1 });
    expect(issues[0]!.message).toMatch(/^E_SOURCE_MISSING <div data-block="stat">/);
  });

  it("fails on an unknown source and an unknown cue, passes a clean scene", async () => {
    const dir = makeTalk({
      "sources.json": SRC,
      "script/en/01-intro.md": "# Intro\n\nHello {#b}world.\n",
      "scenes/01-intro.html": `<section data-beat="a"><div data-block="stat" data-source="s:nope"><p class="value">5%</p></div></section><section data-beat="b" data-cue="c"><p>x</p></section>`,
    });
    const msgs = (await check(loadTalk(dir))).map((i) => i.message.split(" ")[0]);
    expect(msgs.sort()).toEqual(["E_UNKNOWN_CUE", "E_UNKNOWN_SOURCE"]);

    const good = makeTalk({
      "sources.json": SRC,
      "script/en/01-intro.md": "# Intro\n\nHello {#b}world.\n",
      "scenes/01-intro.html": `<section data-beat="a"><div data-block="stat" data-source="s:s1"><p class="value">5%</p></div></section><section data-beat="b" data-cue="b"><p>x</p></section>`,
    });
    expect(await check(loadTalk(good))).toEqual([]);
  });
});
