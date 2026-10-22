import { describe, expect, it } from "vitest";
import { getAttr } from "../src/compose-html.js";
import { parseScene, resolveTimeline, type ResolvedTimeline } from "../src/compose-scene.js";
import { resolveCues } from "../src/cues.js";
import { parseScript } from "../src/script.js";
import { WORKED_AUDIO, WORKED_CUES, WORKED_SCENE, WORKED_SCRIPT, workedCaptions } from "./compose-fixtures.js";

const r = (n: number) => Math.round(n * 1000) / 1000;

function targetsOf(tl: ResolvedTimeline) {
  return tl.targets.map((t) => ({ el: `${t.el.tag}${getAttr(t.el, "data-block") ? `[${getAttr(t.el, "data-block")}]` : ""}${getAttr(t.el, "data-cue") ? `@${getAttr(t.el, "data-cue")}` : ""}`, anim: t.anim, t: r(t.t), beat: t.beat }));
}

describe("cue resolution", () => {
  it("maps each cue to the start of the word after its marker (worked example)", () => {
    expect(resolveCues(parseScript(WORKED_SCRIPT), workedCaptions())).toEqual(WORKED_CUES);
  });

  it("a marker after the last word resolves to that word's start (clamped index)", () => {
    const ch = parseScript("# T\n\nOne two three. {#end}\n");
    const caps = { lang: "en", words: ch.words.map((text, k) => ({ text, start: k, end: k + 0.5, matched: true })) };
    expect(resolveCues(ch, caps)).toEqual({ end: 2 });
  });
});

describe("timeline resolution (scenes.md worked example)", () => {
  const tl = resolveTimeline(parseScene(WORKED_SCENE), WORKED_CUES, WORKED_AUDIO);

  it("has no issues and D = A + 0.6", () => {
    expect(tl.issues).toEqual([]);
    expect(r(tl.duration)).toBe(20.3);
  });

  it("beats: start, mounted length, fade-out at the next beat, camera", () => {
    expect(tl.beats.map((b) => ({ id: b.id, start: r(b.start), unmount: r(b.unmount), fadeAt: b.fadeAt === null ? null : r(b.fadeAt), floor: r(b.floor), camera: b.camera }))).toEqual([
      { id: "open", start: 0, unmount: 5.96, fadeAt: 5.66, floor: 0, camera: "push-in" },
      { id: "stat", start: 5.66, unmount: 11.8, fadeAt: 11.5, floor: 5.96, camera: "none" },
      { id: "loop", start: 11.5, unmount: 20.3, fadeAt: null, floor: 11.8, camera: "none" },
    ]);
  });

  it("entrances: the incoming beat's content waits for the outgoing fade (floor = start + 0.3)", () => {
    expect(targetsOf(tl)).toEqual([
      { el: "div[chapter-card]", anim: "pop", t: 0, beat: 0 },
      { el: "p@doubt", anim: "fade-up", t: 3.62, beat: 0 },
      { el: "div[stat]", anim: "fade-up", t: 5.96, beat: 1 },
      { el: "figure[diagram]", anim: "fade", t: 11.8, beat: 2 },
    ]);
    // No content of beat i+1 enters before beat i has finished fading out.
    for (const b of tl.beats.slice(1)) {
      const prev = tl.beats[b.index - 1]!;
      for (const t of tl.targets.filter((x) => x.beat === b.index)) expect(t.t).toBeGreaterThanOrEqual(prev.fadeAt! + 0.3 - 1e-9);
    }
  });

  it("diagram steps resolve to their cues, unstaggered, with nodes and edges", () => {
    expect(tl.diagrams.map((d) => d.renderId)).toEqual(["tr-d-2-0"]);
    expect(tl.steps.map((s) => ({ t: r(s.t), nodes: s.nodes, edges: s.edges }))).toEqual([
      { t: 14.12, nodes: ["S"], edges: [] },
      { t: 15.4, nodes: ["T"], edges: [["S", "T"]] },
      { t: 16.64, nodes: ["R"], edges: [["T", "R"], ["R", "S"]] },
    ]);
  });
});

describe("stagger, nesting and defaults", () => {
  const scene = (html: string, cues: Record<string, number> = {}) => resolveTimeline(parseScene(html), cues, 10);

  it("targets with the same time are staggered 0.12 s in document order", () => {
    const tl = scene(`<section data-beat="a"><h2>Heading</h2><div data-block="list"><ul><li>One</li><li>Two</li><li data-cue="c">Three</li></ul></div></section>`, { c: 4 });
    expect(targetsOf(tl)).toEqual([
      { el: "h2", anim: "fade-up", t: 0, beat: 0 },
      { el: "div[list]", anim: "fade-up", t: 0.12, beat: 0 },
      { el: "li", anim: "fade-up", t: 0.24, beat: 0 },
      { el: "li", anim: "fade-up", t: 0.36, beat: 0 },
      { el: "li@c", anim: "fade-up", t: 4, beat: 0 },
    ]);
  });

  it("a later beat's stagger starts at the entry floor", () => {
    const tl = scene(`<section data-beat="a"><p>x</p></section><section data-beat="b" data-cue="b"><h2>H</h2><p>P</p></section>`, { b: 2 });
    expect(targetsOf(tl).filter((t) => t.beat === 1).map((t) => t.t)).toEqual([2.3, 2.42]);
  });

  it("a child never enters before its ancestor target, and never before the floor", () => {
    const tl = scene(`<section data-beat="a"><p>x</p></section><section data-beat="b" data-cue="b"><div data-block="split" data-cue="late"><div class="col" data-cue="early"><h3>A</h3></div></div></section>`, { b: 2, late: 5, early: 3 });
    const t = targetsOf(tl).filter((x) => x.beat === 1);
    expect(t).toEqual([
      { el: "div[split]@late", anim: "fade-up", t: 5, beat: 1 },
      { el: "div@early", anim: "fade-up", t: 5.12, beat: 1 },
    ]);
  });

  it("entry defaults: diagram fade, code lines type (chained), others fade-up; data-anim overrides", () => {
    const tl = scene(
      `<section data-beat="a"><h2 data-anim="fade">T</h2><div data-block="code"><pre><code>
        <span data-line>abcdefghij</span>
        <span data-line></span>
        <span data-line>${"x".repeat(40)}</span>
      </code></pre></div></section>`,
    );
    const t = tl.targets.map((x) => ({ tag: x.el.tag, anim: x.anim, t: r(x.t), d: r(x.duration), n: x.chars }));
    expect(t).toEqual([
      { tag: "h2", anim: "fade", t: 0, d: 0.6, n: undefined },
      { tag: "div", anim: "fade-up", t: 0.12, d: 0.6, n: undefined },
      // first line takes the next stagger slot, n = 10 chars -> clamp(0.35, 0.3, 1.2)
      { tag: "span", anim: "type", t: 0.24, d: 0.35, n: 10 },
      // the empty line is not a target; the next line chains after the previous one
      { tag: "span", anim: "type", t: 0.59, d: 1.2, n: 40 },
    ]);
    const d = resolveTimeline(parseScene(`<section data-beat="a"><figure data-block="diagram"><pre data-mermaid>flowchart LR\n A --> B</pre></figure></section>`), {}, 5);
    expect(d.targets.map((x) => x.anim)).toEqual(["fade"]);
  });

  it("camera tweens run until the beat unmounts", () => {
    const tl = scene(`<section data-beat="a" data-camera="pan-left"><p>x</p></section><section data-beat="b" data-cue="b"><p>y</p></section>`, { b: 4 });
    expect(tl.beats.map((b) => [b.camera, r(b.start), r(b.unmount)])).toEqual([
      ["pan-left", 0, 4.3],
      ["none", 4, 10.6],
    ]);
  });

  it("E_CUE_ORDER and E_CUE_BEFORE_BEAT come from resolved times", () => {
    const tl = scene(`<section data-beat="a"><p>x</p></section><section data-beat="b" data-cue="b"><p data-cue="early">y</p></section><section data-beat="c" data-cue="c"><p>z</p></section>`, { b: 4, early: 1, c: 3 });
    expect(tl.issues.map((i) => i.rule).sort()).toEqual(["E_CUE_BEFORE_BEAT", "E_CUE_ORDER"]);
  });
});
