import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { gsap } from "gsap";
import { describe, expect, it } from "vitest";
import { buildPage, composeChapter, sceneInputHash, timelineScript, type Plan } from "../src/compose.js";
import { parseScene, resolveTimeline, validateScene } from "../src/compose-scene.js";
import { GEOMETRY, type Resolution } from "../src/geometry.js";
import { hashJson, sha256 } from "../src/hash.js";
import { parseScript } from "../src/script.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

const resolutions = Object.keys(GEOMETRY) as Resolution[];
const photo = (src = "assets/photos/door.png") => `<img src="${src}" alt="A sectional door">`;
const cover = (src?: string, caption = "<figcaption>Made to measure</figcaption>", fit = 'data-fit="cover"') => `<figure data-block="figure" ${fit}>${photo(src)}${caption}</figure>`;
const hook = '<div data-block="title" data-variant="hook"><h1>Doors <em>this week</em></h1></div>';
const TWO_COVERS = `<section data-beat="hook" data-camera="push-in">${hook}${cover(undefined, "")}</section>`
  + `<section data-beat="wide" data-cue="wide">${cover("assets/photos/wide.jpg")}</section>`;
const CHECKLIST = '<div data-block="list"><h3 class="heading">Why us</h3><ul>'
  + '<li data-check data-cue="quote">Free quote</li><li data-check data-cue="fit">Made to measure</li><li data-cue="fast">Fitted in one visit</li></ul></div>';
const LIST_SCENE = `<section data-beat="open"><p>Hello</p></section><section data-beat="why" data-cue="why">${CHECKLIST}</section>`;
const LIST_CUES = { why: 1, quote: 2, fit: 3, fast: 4 };

function page(html: string, cues: Record<string, number> = {}, resolution: Resolution = "portrait", ambient?: { tag: string }, fps = 30) {
  const scene = parseScene(html);
  expect(validateScene(scene, { sources: new Set(), resolution })).toEqual([]);
  const timeline = resolveTimeline(scene, cues, 6);
  expect(timeline.issues).toEqual([]);
  return { ...buildPage({ scene, timeline, lang: "en", captions: { lang: "en", words: [] }, audioDuration: 6, sources: new Map(), resolution, ambient, fps }), timeline };
}

function rules(html: string, cues?: string[]) {
  return validateScene(parseScene(html), { sources: new Set(), cues: cues ? new Set(cues) : undefined, resolution: "portrait" }).map((i) => i.rule);
}

/** Run timeline.js against stand-in nodes; every node starts at the theme's opacity 0. */
async function runtime(plan: Plan) {
  const nodes = new Map<string, { x: number; y: number; scale: number; opacity: number }>();
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { x: 0, y: 0, scale: 1, opacity: 0 });
    return nodes.get(id)!;
  };
  const errors: unknown[] = [];
  const window = { gsap, dispatchEvent() {}, __hfTimelinesBuilding: true, __timelines: {} as Record<string, gsap.core.Timeline> };
  runInNewContext(timelineScript(plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: node }, Event: class {}, console: { error: (e: unknown) => errors.push(e) } });
  for (let n = 0; n < 20 && window.__hfTimelinesBuilding; n++) await Promise.resolve();
  expect(errors).toEqual([]);
  expect(window.__hfTimelinesBuilding).toBe(false);
  return { node, tl: window.__timelines.main! };
}

/** Every fromTo the runtime creates, recorded with its target id (and any gsap.config call). */
async function tweens(plan: Plan, configs: Record<string, unknown>[] = []) {
  const calls: { id: string; from: Record<string, unknown>; to: Record<string, unknown>; at: number }[] = [];
  const tl = { fromTo(el: { id: string }, from: Record<string, unknown>, to: Record<string, unknown>, at: number) { calls.push({ id: el.id, from, to, at }); }, set() {}, seek() {} };
  const config = (vars: Record<string, unknown>) => { expect(calls).toEqual([]); configs.push(vars); };
  const window: Record<string, unknown> = { gsap: { timeline: () => tl, set() {}, config }, dispatchEvent() {} };
  runInNewContext(timelineScript(plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: (id: string) => ({ id }) }, Event: class {}, console });
  for (let i = 0; i < 20 && window.__hfTimelinesBuilding !== false; i++) await Promise.resolve();
  expect(window.__hfTimelinesBuilding).toBe(false);
  return calls;
}

describe("cover figure", () => {
  it.each(resolutions)("hoists each %s cover image into its own backdrop between the ambient layer and the stage", (resolution) => {
    const p = page(TWO_COVERS, { wide: 2 }, resolution, { tag: "02 · Doors" });
    const backdrops = '    <div class="tr-backdrop" id="tr-backdrop-0"><img src="assets/photos/door.png" alt="A sectional door"></div>\n'
      + '    <div class="tr-backdrop" id="tr-backdrop-1"><img src="assets/photos/wide.jpg" alt="A sectional door"></div>\n';
    expect(p.html).toContain(`<p class="tr-tag" id="tr-tag">02 · Doors</p>\n${backdrops}    <div class="tr-stage">`);
    expect(p.html.indexOf('class="tr-ambient"')).toBeLessThan(p.html.indexOf('class="tr-backdrop"'));
    const stage = p.html.slice(p.html.indexOf('<div class="tr-stage">'), p.html.indexOf('<div id="tr-captions"'));
    expect(stage).not.toContain("<img");
    expect(stage).toContain("<figcaption>Made to measure</figcaption>");
    expect(stage.match(/data-fit="cover"/g)).toHaveLength(2);
    // The figure keeps its own cue-timed entrance (its caption); the backdrop follows it.
    expect(p.plan.figures!.map((f) => f.t)).toEqual([0.12, 2.3]);
    expect(p.plan.backdrops).toEqual([
      { id: "tr-backdrop-0", t: 0.12, d: 0.6, out: 2 },
      { id: "tr-backdrop-1", t: 2.3, d: 0.6, out: null },
    ]);
  });

  it("writes the backdrop without an ambient layer directly before the stage", () => {
    const p = page(TWO_COVERS, { wide: 2 });
    expect(p.html).toMatch(/data-height="1920">\n {4}<div class="tr-backdrop" id="tr-backdrop-0">.*\n {4}<div class="tr-backdrop" id="tr-backdrop-1">.*\n {4}<div class="tr-stage">/);
  });

  it.each([
    [1.7, 2, 1.7, 0.3],
    [1.7006, 2.0002, 1.701, 0.299],
  ])("ends a late backdrop entrance at fade-out (cue %s, fade-out %s), continuously in every seek order", async (cue, fadeAt, t, d) => {
    const html = `<section data-beat="door">${cover().replace('data-fit="cover"', 'data-fit="cover" data-cue="photo"')}</section>`
      + '<section data-beat="next" data-cue="next"><p>Next</p></section>';
    const plan = page(html, { photo: cue, next: fadeAt }).plan;
    const out = 2;
    expect(plan.backdrops).toEqual([{ id: "tr-backdrop-0", t, d, out }]);
    const id = plan.backdrops![0]!.id;
    const times = [0, t - 0.001, t, t + d / 2, out - 0.001, out, out + 0.001, out + 0.15, out + 0.3, 6];
    const fresh = new Map<number, number>();
    for (const time of times) {
      const r = await runtime(plan);
      try {
        r.tl.seek(time);
        const opacity = r.node(id).opacity;
        fresh.set(time, opacity);
        const expected = time <= t ? 0 : time <= out ? gsap.parseEase("power1.out")((time - t) / d)
          : time < out + 0.3 ? 1 - gsap.parseEase("power1.in")((time - out) / 0.3) : 0;
        expect(opacity, `fresh seek ${time}`).toBeCloseTo(expected, 6);
      } finally { r.tl.kill(); }
    }
    // The entrance reaches 1 at fadeAt; both adjacent samples approach it without a jump.
    expect(fresh.get(out)).toBe(1);
    expect(fresh.get(out - 0.001)).toBeCloseTo(1, 4);
    expect(fresh.get(out + 0.001)).toBeCloseTo(1, 4);
    const shuffled = [...times.filter((_, i) => i % 2 === 1).reverse(), ...times.filter((_, i) => i % 2 === 0)];
    for (const order of [times, [...times].reverse(), shuffled]) {
      const r = await runtime(plan);
      try {
        for (const time of order) {
          r.tl.seek(time);
          expect(r.node(id).opacity, `ordered seek ${time}`).toBe(fresh.get(time));
        }
      } finally { r.tl.kill(); }
    }
  });

  it.each([
    [25, 1.96, 2, true], // Exactly one frame remains.
    [25, 1.97, 2.01, true], // Floating-point subtraction must not discard a full frame.
    [25, 1.97, 2, false],
    [60, 1.97, 2, true], // The same cue is visible at a higher talk FPS.
    [60, 1.99, 2, false],
    [30, 2, 2, false],
    [30, 2.01, 2, false],
  ])("at %s FPS, cue %s before fade-out %s yields a visible backdrop: %s", (fps, cue, fadeAt, visible) => {
    const html = `<section data-beat="door">${cover().replace('data-fit="cover"', 'data-fit="cover" data-cue="photo"')}</section>`
      + '<section data-beat="next" data-cue="next"><p>Next</p></section>';
    const p = page(html, { photo: cue, next: fadeAt }, "portrait", undefined, fps);
    expect(p.plan.backdrops?.length ?? 0).toBe(visible ? 1 : 0);
    // Even skipped backdrops keep their image out of the stage, hidden by CSS opacity:0.
    expect(p.html.slice(p.html.indexOf('<div class="tr-stage">'))).not.toContain("<img");
  });

  it.each([[25, 0], [60, 1]])("uses the talk's %s FPS when composing a 0.03-second backdrop window", (fps, count) => {
    const source = `<section data-beat="door">${cover().replace('data-fit="cover"', 'data-fit="cover" data-cue="photo"')}</section>`
      + '<section data-beat="next" data-cue="next"><p>Next</p></section>';
    const talk = loadTalk(makeTalk({
      "sources.json": '{"sources":[]}', "script/en/01-door.md": "# Door\n\nHello {#photo}world. {#next}Next.\n", "scenes/01-door.html": source,
      "assets/photos/door.png": "PNG bytes",
      "captions/en/01.json": JSON.stringify({ lang: "en", words: [
        { text: "Hello", start: 0, end: 0.9, matched: true },
        { text: "world.", start: 0.97, end: 0.99, matched: true },
        { text: "Next.", start: 1, end: 2, matched: true },
      ] }),
    }, { resolution: "portrait", fps }));
    const wav = paths.narrationWav(talk, "en", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 3);
    const composed = composeChapter(talk, listChapters(talk, "en")[0]!);
    expect(composed.page.plan.backdrops?.length ?? 0).toBe(count);
  });

  it.each([
    ["an unknown fit", cover(undefined, undefined, 'data-fit="contain"')],
    ["an empty fit", cover(undefined, undefined, 'data-fit=""')],
    ["a bare fit", cover(undefined, undefined, "data-fit")],
    ["a fit outside figure", '<div data-block="list" data-fit="cover"><ul><li>a</li></ul></div>'],
    ["a nested cover figure", `<div class="wrap">${cover()}</div>`],
    ["two cover figures in one beat", cover() + cover("assets/photos/wide.jpg")],
    ["a cued cover image", cover().replace("<img ", '<img data-cue="a" ')],
    ["an animated cover image", cover().replace("<img ", '<img data-anim="pop" ')],
  ])("rejects %s with E_FIGURE", (_name, block) => {
    expect(rules(`<section data-beat="a">${block}</section>`)).toContain("E_FIGURE");
  });

  it("never gives the hoisted image an entrance or an id: only the figure is a target", () => {
    expect(rules(`<section data-beat="a">${cover().replace('data-fit="cover"', 'data-fit="cover" data-cue="a" data-anim="pop"')}</section>`, ["a"])).not.toContain("E_FIGURE");
    expect(rules(`<section data-beat="a"><figure data-block="figure">${photo().replace("<img ", '<img data-anim="pop" ')}</figure></section>`)).toEqual([]);
    // Every image entrance belongs to a figure in the stage; the backdrop images carry no id.
    const p = page(TWO_COVERS, { wide: 2 });
    const stage = p.html.slice(p.html.indexOf('<div class="tr-stage">'));
    for (const f of p.plan.figures!) expect(stage).toMatch(new RegExp(`<figure [^>]*id="${f.id}"`));
    expect(p.html.match(/<div class="tr-backdrop" id="tr-backdrop-\d"><img src="[^"]+" alt="[^"]+"><\/div>/g)).toHaveLength(2);
  });

  it("fades the backdrop in at the figure's cue and out with its beat, the same after any seek order", async () => {
    const plan = page(TWO_COVERS, { wide: 2 }).plan;
    const [first, last] = plan.backdrops!;
    const times = [0, 0.1, 0.42, 0.72, 1.5, 2.1, 2.3, 2.6, 2.9, 4, 6.5];
    const sample = (r: Awaited<ReturnType<typeof runtime>>) => [r.node(first!.id).opacity, r.node(last!.id).opacity];
    const fresh = new Map<number, number[]>();
    for (const t of times) {
      const r = await runtime(plan);
      r.tl.seek(t);
      fresh.set(t, sample(r));
      r.tl.kill();
    }
    expect(fresh.get(0.1)).toEqual([0, 0]);
    expect(fresh.get(0.42)![0]).toBeCloseTo(gsap.parseEase("power1.out")(0.5), 5);
    expect(fresh.get(1.5)).toEqual([1, 0]);
    expect(fresh.get(2.1)![0]).toBeCloseTo(1 - gsap.parseEase("power1.in")(1 / 3), 5);
    expect(fresh.get(2.3)).toEqual([0, 0]);
    expect(fresh.get(2.9)).toEqual([0, 1]);
    expect(fresh.get(6.5)).toEqual([0, 1]);
    const r = await runtime(plan);
    try {
      for (const t of [...times, 6.5, 2.6, 0, 4, 0.42, 2.1, 0.72, 2.9, 0.1]) {
        r.tl.seek(t);
        expect(sample(r), `seek ${t}`).toEqual(fresh.get(t));
      }
    } finally { r.tl.kill(); }
  });

  it("copies the hoisted image and leaves asset validation and the scene input hash unchanged", () => {
    const source = `<section data-beat="door">${cover()}</section>`;
    const script = "# Door\n\nHello world.\n";
    const talk = loadTalk(makeTalk({
      "sources.json": '{"sources":[]}', "script/en/01-door.md": script, "scenes/01-door.html": source,
      "assets/photos/door.png": "PNG bytes",
      "captions/en/01.json": JSON.stringify({ lang: "en", words: [{ text: "Hello", start: 0, end: 1, matched: true }, { text: "world.", start: 1, end: 2, matched: true }] }),
    }, { resolution: "portrait" }));
    const wav = paths.narrationWav(talk, "en", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 3);
    const composed = composeChapter(talk, listChapters(talk, "en")[0]!);
    expect(readFileSync(join(composed.dir, "assets/photos/door.png"), "utf8")).toBe("PNG bytes");
    expect(readFileSync(join(composed.dir, "index.html"), "utf8")).toContain('<div class="tr-backdrop" id="tr-backdrop-0"><img src="assets/photos/door.png" alt="A sectional door"></div>');
    const chapter = parseScript(script);
    expect(sceneInputHash(source, chapter, new Map(), talk.dir)).toBe(hashJson({
      scene: sha256(source), cues: [], displays: [], tag: chapter.tag, sources: [], assets: [`assets/photos/door.png:${sha256("PNG bytes")}`],
    }));
    const missing = `<section data-beat="door">${cover("assets/photos/none.png")}</section>`;
    expect(validateScene(parseScene(missing), { sources: new Set(), resolution: "portrait", talkDir: talk.dir }).map((i) => i.rule)).toEqual(["E_ASSET"]);
    expect(existsSync(join(composed.dir, "assets/photos/none.png"))).toBe(false);
  });
});

describe("checklist ticks", () => {
  it("places RTL ticks on the right and composes checked Arabic lists", () => {
    const css = readFileSync(new URL("../themes/default/theme.css", import.meta.url), "utf8");
    expect(css).toMatch(/\[dir="rtl"\] \[data-block="list"\] \.tr-check\s*\{[^}]*\bright:\s*0\s*;/);
    const scene = parseScene(LIST_SCENE);
    expect(validateScene(scene, { sources: new Set(), resolution: "portrait", lang: "ar" })).toEqual([]);
    const timeline = resolveTimeline(scene, LIST_CUES, 6);
    const p = buildPage({ scene, timeline, lang: "ar", captions: { lang: "ar", words: [] }, audioDuration: 6, sources: new Map(), resolution: "portrait" });
    expect(p.html).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
    expect(p.html).toContain('class="tr-check"');
  });

  it("calls late checked cues ticks and late plain cues entrances", () => {
    const html = LIST_SCENE + '<section data-beat="next" data-cue="next"><p>Next</p></section>';
    const timeline = resolveTimeline(parseScene(html), { ...LIST_CUES, next: 1.8 }, 6);
    expect(timeline.issues).toEqual([]);
    expect(timeline.warnings.map((w) => w.message)).toEqual([
      expect.stringContaining('enters at 4.00 s, after its beat "why" ends (1.80 s)'),
      expect.stringContaining('ticks at 2.00 s, after its beat "why" ends (1.80 s)'),
      expect.stringContaining('ticks at 3.00 s, after its beat "why" ends (1.80 s)'),
    ]);
  });

  it("adds a check layer to each checked item: items enter with the list, ticks land on their cues", () => {
    const p = page(LIST_SCENE, LIST_CUES);
    expect(p.html).toMatch(/<li data-check data-cue="quote" id="tr-e-\d+">Free quote<i class="tr-check" aria-hidden="true" id="(tr-e-\d+)"><\/i><\/li>/);
    expect(p.html).toMatch(/<li data-cue="fast" id="tr-e-\d+">Fitted in one visit<\/li>/);
    expect(p.html.match(/class="tr-check"/g)).toHaveLength(2);
    expect(p.plan.checks!.map((c) => [c.t, c.d])).toEqual([[2, 0.35], [3, 0.35]]);
    // List at its beat floor (1.3), checked items staggered with it; the unchecked item keeps its cue.
    expect(p.plan.targets.map((t) => t.t)).toEqual([0, 1.3, 1.42, 1.54, 4]);
  });

  it("ticks an uncued item as it enters and never before its item has entered", () => {
    const html = LIST_SCENE.replace('<li data-check data-cue="fit">', "<li data-check>");
    const p = page(html, { ...LIST_CUES, quote: 1.1 });
    expect(p.plan.checks!.map((c) => c.t)).toEqual([1.42, 1.54]);
  });

  it.each([
    ["on a paragraph", '<section data-beat="a"><p data-check>x</p></section>'],
    ["with a value", '<section data-beat="a"><div data-block="list"><ul><li data-check="quote">x</li></ul></div></section>'],
    ["on a pipeline chip", '<section data-beat="a"><div data-block="pipeline"><ol><li data-check>a</li><li>b</li><li>c</li></ol></div></section>'],
  ])("rejects data-check %s with E_LIST", (_name, html) => {
    expect(rules(html)).toContain("E_LIST");
  });

  it("keeps cue validation for checked items", () => {
    expect(rules(LIST_SCENE, ["why", "fit", "fast"])).toContain("E_UNKNOWN_CUE");
    const early = resolveTimeline(parseScene(LIST_SCENE), { ...LIST_CUES, quote: 0.5 }, 6);
    expect(early.issues.map((i) => i.rule)).toContain("E_CUE_BEFORE_BEAT");
  });

  it("ticks with one opacity tween at the cue, the same after any seek order", async () => {
    const plan = page(LIST_SCENE, LIST_CUES).plan;
    const ids = plan.checks!.map((c) => c.id);
    const times = [0, 1.9, 2.175, 2.35, 2.9, 3.2, 6];
    const fresh = new Map<number, number[]>();
    for (const t of times) {
      const r = await runtime(plan);
      r.tl.seek(t);
      fresh.set(t, ids.map((id) => r.node(id).opacity));
      r.tl.kill();
    }
    expect(fresh.get(1.9)).toEqual([0, 0]);
    expect(fresh.get(2.175)![0]).toBeCloseTo(gsap.parseEase("power1.out")(0.5), 5);
    expect(fresh.get(2.9)).toEqual([1, 0]);
    expect(fresh.get(6)).toEqual([1, 1]);
    const r = await runtime(plan);
    try {
      for (const t of [...times, 6, 2.175, 0, 3.2, 2.35, 1.9]) {
        r.tl.seek(t);
        expect(ids.map((id) => r.node(id).opacity), `seek ${t}`).toEqual(fresh.get(t));
      }
    } finally { r.tl.kill(); }
  });
});

describe("new motion stays single-property and transform-free", () => {
  it("creates only opacity tweens with immediateRender:false and force3D:false for backdrops and ticks", async () => {
    const p = page(TWO_COVERS + `<section data-beat="why" data-cue="why">${CHECKLIST}</section>`, { wide: 2, why: 3, quote: 3.5, fit: 4, fast: 4.5 });
    const ids = new Set([...p.plan.backdrops!.map((b) => b.id), ...p.plan.checks!.map((c) => c.id)]);
    const calls = (await tweens(p.plan)).filter((c) => ids.has(c.id));
    // Two backdrops in and out (neither cover beat is last), two ticks.
    expect(calls).toHaveLength(4 + 2);
    for (const { from, to } of calls) {
      expect(Object.keys(from)).toEqual(["opacity"]);
      expect(Object.keys(to).filter((k) => !["duration", "ease", "immediateRender", "force3D"].includes(k))).toEqual(["opacity"]);
      expect(to.immediateRender).toBe(false);
      expect(to.force3D).toBe(false);
    }
  });

  it.each([
    ["cover figures", TWO_COVERS, { wide: 2 }],
    ["checked items", LIST_SCENE, LIST_CUES],
  ])("keeps every tween on pages with %s 2D, configured before the first tween", async (_name, html, cues) => {
    const configs: Record<string, unknown>[] = [];
    const calls = await tweens(page(html, cues).plan, configs);
    expect(calls.length).toBeGreaterThan(0);
    expect(configs).toEqual([{ force3D: false }]);
  });

  it("gives all portrait and square caption lines their own opacity layer, leaving landscape untouched", () => {
    const css = readFileSync(new URL("../themes/default/theme.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const layers = rules.filter(([, selector, body]) => selector!.includes(".tr-cap-line") && /will-change\s*:/.test(body!));
    expect(layers).toHaveLength(1);
    expect(layers[0]![1]!.split(",").map((s) => s.trim())).toEqual([
      '[data-resolution="portrait"] .tr-cap-line',
      '[data-resolution="square"] .tr-cap-line',
    ]);
    expect(layers[0]![2]!.trim()).toBe("will-change: opacity;");
  });

  it("styles the backdrop, scrim, cover caption and check layers without transforms or new layers", () => {
    const css = readFileSync(new URL("../themes/default/theme.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const added = css.slice(css.indexOf("/* ---------- checklist ticks and cover figure ---------- */")).replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...added.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    expect(rules.map((m) => m[1]!.trim())).toEqual(expect.arrayContaining([".tr-backdrop", ".tr-backdrop > img", ".tr-backdrop::after", '[data-block="list"] .tr-check']));
    // box-shadow too: a rounded inset shadow at a list row's fractional y drew worker-dependent corners.
    for (const [, selector, body] of rules) expect(body, selector).not.toMatch(/transform|translate|will-change|backface-visibility|animation|transition|box-shadow/);
    expect(added).toMatch(/\.tr-backdrop \{[^}]*position: absolute; inset: 0;[^}]*opacity: 0;/);
    expect(added).toMatch(/\.tr-backdrop > img \{[^}]*object-fit: cover;/);
    expect(added).toMatch(/\[data-resolution="portrait"\] \.tr-backdrop::after \{\s*background: linear-gradient\(/);
  });
});

describe("pages without cover figures or checked items", () => {
  // A plain figure and a plain list, composed at HEAD 4f3a75f (before slice 8): same bytes now.
  const SCENE = '<section data-beat="a" data-camera="push-in"><div data-block="title" data-variant="hook"><h1>Doors <em>this week</em></h1></div></section>\n'
    + '<section data-beat="b" data-cue="b"><figure data-block="figure"><img src="assets/p.png" alt="Photo"><figcaption>Cap</figcaption></figure></section>\n'
    + '<section data-beat="c" data-cue="c"><div data-block="list"><h3 class="heading">Why</h3><ul><li>One</li><li data-cue="d">Two</li></ul></div></section>\n';
  const words = ["Doors", "this", "week.", "Look", "at", "it.", "Why", "one", "two."].map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4, matched: true }));
  const pinned: Record<Resolution, [string, string]> = {
    landscape: ["5f5e6b06a5f05bc7a8d172c32cc87f2f2ca7b09fb638bbf68bd2025f1bbf9275", "ee8c6a4a2aeff0069ca2b5757c99d4e1dda9525915b2d156479a2c7b8551ea1a"],
    portrait: ["b06a8a9dd632d4f288601d325ad1739aafc15285355e267392fe8cfdf42d5ff1", "92e833a5f2c5c395238df8402e35a78bf35f8d6d3b5ba77731a0b7a2bfef8912"],
    square: ["b376bd310f05e096ee6f0d5a8c647abe273e3274589c45746797dca7b193c69f", "ee8c6a4a2aeff0069ca2b5757c99d4e1dda9525915b2d156479a2c7b8551ea1a"],
  };

  it.each(resolutions)("compose %s index.html and timeline.js to the pre-slice-8 bytes", (resolution) => {
    const scene = parseScene(SCENE);
    const tl = resolveTimeline(scene, { b: 1.5, c: 3, d: 3.5 }, 5, resolution);
    const p = buildPage({ lang: "en", scene, timeline: tl, captions: { lang: "en", words }, audioDuration: 5, sources: new Map(), resolution });
    const h = (s: string) => createHash("sha256").update(s).digest("hex");
    expect([h(p.html), h(timelineScript(p.plan))]).toEqual(pinned[resolution]);
    expect(timelineScript(p.plan)).not.toContain("gsap.config");
    expect(p.plan).not.toHaveProperty("backdrops");
    expect(p.plan).not.toHaveProperty("checks");
    expect(tl).not.toHaveProperty("checks");
  });
});
