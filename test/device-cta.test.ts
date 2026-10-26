import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { gsap } from "gsap";
import { describe, expect, it } from "vitest";
import { buildPage, composeChapter, prepareScene, sceneInputHash, timelineScript } from "../src/compose.js";
import { parseScene, resolveTimeline, validateScene } from "../src/compose-scene.js";
import { cursorEntry, cursorPath, deviceViewport, deviceZoom, GEOMETRY, portraitCamera } from "../src/geometry.js";
import { parseScript } from "../src/script.js";
import { check } from "../src/check.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { makeTalk } from "./helpers.js";
import { writeWav } from "./compose-fixtures.js";

const image = '<img src="assets/screen.png" alt="Product dashboard">';
const rect = (name = "save", attrs = "") => `<i data-target="${name}" data-x="60%" data-y="20%" data-width="20%" data-height="10%" ${attrs}></i>`;
const device = (frame = "phone", children = rect("save", 'data-zoom="70,25,2" data-cue="zoom"') + '<i data-click="save" data-cue="click"></i>') => `<div data-block="device" data-frame="${frame}">${image}${children}</div>`;
const cta = (attrs = "") => `<div data-block="cta" ${attrs}>${image}<h2>Make your next reel</h2><p class="action">Start a chapter</p><p class="url">example.org</p></div>`;
const sceneHtml = (block: string) => `<section data-beat="demo">${block}</section>`;
const cues = { zoom: 2, click: 3, again: 4 };
const options = { sources: new Set<string>(), cues: new Set(Object.keys(cues)), resolution: "portrait" as const };

function page(block = device(), resolution: "portrait" | "landscape" | "square" = "portrait", cueTimes = cues) {
  const scene = parseScene(sceneHtml(block));
  const issues = validateScene(scene, { ...options, resolution });
  expect(issues).toEqual([]);
  const timeline = resolveTimeline(scene, cueTimes, 6);
  expect(timeline.issues).toEqual([]);
  return { ...buildPage({ scene, timeline, lang: "en", captions: { lang: "en", words: [] }, audioDuration: 6, sources: new Map(), resolution }), timeline };
}

describe("device and CTA structure", () => {
  it.each(["phone", "browser"])("positions the %s screenshot and target from authored percentages", (frame) => {
    const p = page(device(frame));
    const g = deviceViewport(GEOMETRY.portrait, frame);
    expect(p.html).toContain(`--tr-device-width:${g.width}px;--tr-device-height:${g.height}px`);
    expect(p.html).toContain('left:60%;top:20%;width:20%;height:10%');
    expect(p.html.match(/<img /g)).toHaveLength(1);
    expect(p.html).toContain('class="tr-device-camera"');
    expect(p.html).not.toContain('data-click="');
    const z = p.plan.devices![0]!.zooms[0]!;
    expect(z).toEqual({ t: 2, d: 0.6, from: { x: 0, y: 0, scale: 1 }, to: deviceZoom(g.width, g.height, 70, 25, 2) });
  });

  it.each([
    device("tablet"), device("phone", rect().replace('60%', '60px')),
    device("phone", rect().replace('60%', '95%')), device("phone", rect() + rect()),
    device("phone", rect("save", 'data-zoom="70,25,0" data-cue="zoom"')),
    device("phone", rect("save", 'data-zoom="70,25,2"')),
    device("phone", '<i data-click="save"></i>'),
    device("phone", `<div>${rect()}</div>`),
    device().replace(image, ""), device().replace(image, image + image),
    cta().replace('<h2>Make your next reel</h2>', ""), cta().replace('class="action"', 'class="other"'),
    cta().replace(image, ""), cta().replace(image, image + image),
    cta().replace('class="action"', 'class="action url"'),
  ])("rejects malformed device/CTA markup: %s", (block) => {
    expect(validateScene(parseScene(sceneHtml(block)), options).length).toBeGreaterThan(0);
  });

  it("rejects click targets in another device from validation, prepare and check", async () => {
    const html = sceneHtml(device("phone", rect()) + device("browser", '<i data-click="save" data-cue="click"></i>'));
    expect(validateScene(parseScene(html), options).map((i) => i.rule)).toContain("E_CLICK_TARGET");
    const script = "# Demo\n\nHello {#click} world.\n";
    const captions = { lang: "en", words: [{ text: "Hello", start: 0, end: 1, matched: true }, { text: "world.", start: 3, end: 4, matched: true }] };
    const talk = loadTalk(makeTalk({ "sources.json": '{"sources":[]}', "script/en/01-demo.md": script, "scenes/01-demo.html": html, "assets/screen.png": "bytes" }));
    expect(() => prepareScene("scene.html", html, parseScript(script), captions, 5, new Set(), "portrait", talk.dir)).toThrow(/E_CLICK_TARGET/);
    expect((await check(talk)).some((i) => i.message.startsWith("E_CLICK_TARGET"))).toBe(true);
  });

  it.each([device(), cta()])("applies local image-slot rules to %s", (block) => {
    expect(validateScene(parseScene(sceneHtml(block.replace('assets/screen.png', 'assets/../escape.png'))), options).map((i) => i.rule)).toContain("E_ASSET");
    expect(validateScene(parseScene(sceneHtml(block.replace('alt="Product dashboard"', 'alt=""'))), options).map((i) => i.rule)).toContain("E_ASSET");
  });

  it.each(["phone", "browser", "cta"])("copies and hashes the %s image through full chapter composition", (kind) => {
    const source = sceneHtml(kind === "cta" ? cta() : device(kind, rect()));
    const script = "# Demo\n\nHello.\n";
    const talk = loadTalk(makeTalk({
      "sources.json": '{"sources":[]}', "script/en/01-demo.md": script,
      "scenes/01-demo.html": source, "assets/screen.png": "original image bytes",
      "captions/en/01.json": JSON.stringify({ lang: "en", words: [{ text: "Hello.", start: 0, end: 1, matched: true }] }),
    }, { resolution: "portrait" }));
    const wav = paths.narrationWav(talk, "en", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 4);
    const composed = composeChapter(talk, listChapters(talk, "en")[0]!);
    expect(readFileSync(join(composed.dir, "assets/screen.png"), "utf8")).toBe("original image bytes");
    expect(composed.page.html).toContain('src="assets/screen.png"');
    expect(sceneInputHash(source, parseScript(script), new Map(), talk.dir)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => sceneInputHash(source, parseScript(script), new Map())).toThrow(/E_ASSET/);
  });

  it("accepts CTA without URL and warns below the 1.5 s hold boundary", () => {
    expect(validateScene(parseScene(sceneHtml(cta().replace('<p class="url">example.org</p>', ""))), options)).toEqual([]);
    for (const [cue, warn] of [[4.5, false], [4.501, true]] as const) {
      const scene = parseScene(sceneHtml(cta('data-cue="close"')));
      const tl = resolveTimeline(scene, { close: cue }, 6); // D=6.6; entrance=0.6
      expect(tl.warnings.some((w) => w.message.includes("cta hold"))).toBe(warn);
    }
  });

  it("counts delayed CTA child entrances and early beat exits in the hold", () => {
    const scene = parseScene(sceneHtml(cta().replace('<p class="action"', '<p data-cue="late" class="action"')) + '<section data-beat="next" data-cue="next"><p>Next</p></section>');
    expect(resolveTimeline(scene, { late: 3, next: 4 }, 10).warnings.some((w) => w.message.includes("cta hold"))).toBe(true);
  });
});

async function runtime(block = device()) {
  const p = page(block);
  const draws: number[][] = [];
  const imageNode = { decode: () => Promise.resolve() };
  const context = { imageSmoothingEnabled: false, imageSmoothingQuality: "low", clearRect() {}, drawImage(_image: unknown, ...args: number[]) { draws.push(args); } };
  const createNode = () => ({ x: 0, y: 0, scale: 1, opacity: 0, width: 1000, height: 1000, querySelector: () => imageNode, getContext: () => context });
  const nodes = new Map<string, ReturnType<typeof createNode>>();
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, createNode());
    return nodes.get(id)!;
  };
  const errors: unknown[] = [];
  const window = { gsap, dispatchEvent() {}, __hfTimelinesBuilding: true, __timelines: {} as Record<string, gsap.core.Timeline> };
  runInNewContext(timelineScript(p.plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: node }, Event: class {}, console: { error: (e: unknown) => errors.push(e) } });
  for (let n = 0; n < 20 && window.__hfTimelinesBuilding; n++) await Promise.resolve();
  expect(errors).toEqual([]);
  expect(window.__hfTimelinesBuilding).toBe(false);
  return { p, node, tl: window.__timelines.main!, draws, context };
}

describe("device motion", () => {
  it("computes a quadratic path from the previous cursor position", () => {
    const p = page(device("browser", rect() + '<i data-click="save" data-cue="click"></i>' + rect("other").replace('60%', '10%') + '<i data-click="other" data-cue="again"></i>'));
    const d = p.plan.devices![0]!;
    const first = d.clicks[0]!, second = d.clicks[1]!;
    expect(first.start).toBe(2.4);
    expect(first.t).toBe(3);
    expect(second.path[0]).toEqual(first.path[2]);
    expect(second.path).toEqual(cursorPath(first.path[2]!, second.path[2]!));
    expect(second.path[1]).not.toEqual([(second.path[0]![0] + second.path[2]![0]) / 2, (second.path[0]![1] + second.path[2]![1]) / 2]);
  });

  it("starts later zooms from the preceding transform and uses the authored entrance duration", () => {
    const d = page(device("browser", rect("save", 'data-zoom="70,25,2" data-cue="zoom" data-anim="pop"') + rect("next", 'data-zoom="50,50,1" data-cue="again"'))).plan.devices![0]!;
    expect(d.zooms[0]!.d).toBe(0.5);
    expect(d.zooms[1]!.from).toEqual(d.zooms[0]!.to);
    expect(d.zooms[1]!.to).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("rejects overlapping zooms and actions before the device entrance", () => {
    const scene = parseScene(sceneHtml(device("phone", rect("save", 'data-zoom="70,25,2" data-cue="zoom"') + rect("next", 'data-zoom="50,50,1" data-cue="again"'))));
    expect(resolveTimeline(scene, { zoom: 0.2, again: 0.4 }, 4).issues.map((i) => i.rule)).toContain("E_DEVICE");
  });

  it("reaches zoom at cue plus entrance duration, and click/pressed state at the click cue", async () => {
    const { p, node, tl } = await runtime();
    const d = p.plan.devices![0]!, c = d.clicks[0]!, z = d.zooms[0]!;
    try {
      tl.seek(z.t + z.d);
      expect(node(d.camera).scale).toBeCloseTo(z.to.scale, 5);
      expect(node(d.camera).x).toBeCloseTo(z.to.x, 4);
      expect(node(d.camera).y).toBeCloseTo(z.to.y, 4);
      tl.seek((c.start + c.t) / 2);
      const point = c.path.map((p) => p[0]);
      expect(node(d.cursor).x).toBeCloseTo((point[0]! + 2 * point[1]! + point[2]!) / 4, 4);
      tl.seek(c.t + 0.001);
      expect(node(d.cursor).x).toBeCloseTo(c.path[2]![0], 4);
      expect(node(c.halo).opacity).toBeGreaterThan(0.8);
      expect(node(c.target).opacity).toBe(1);
      tl.seek(c.t + 0.08);
      expect(node(c.target).scale).toBeCloseTo(0.96, 4);
      tl.seek(c.t + 0.5);
      expect(node(c.halo).opacity).toBe(0);
      expect(node(c.target).opacity).toBe(0);
      expect(node(c.target).scale).toBe(1);
    } finally { tl.kill(); }
  });

  it("reproduces fresh mid-motion states after sequential and shuffled seeks", async () => {
    const block = device("phone", rect("save", 'data-zoom="70,25,2" data-cue="zoom"') + '<i data-click="save" data-cue="click"></i>' + rect("reset", 'data-zoom="50,50,1" data-cue="again"') + '<i data-click="save" data-cue="again"></i>');
    const times = [0, 2.3, 2.7, 3.08, 3.7, 4.08, 4.3, 5];
    const sample = (r: Awaited<ReturnType<typeof runtime>>) => {
      const d = r.p.plan.devices![0]!;
      const camera = r.node(d.camera), draw = r.draws.at(-1)!;
      expect(draw[0]).toBeCloseTo(camera.x, 4);
      expect(draw[1]).toBeCloseTo(camera.y, 4);
      expect(draw[2]).toBeCloseTo(d.width * camera.scale, 3);
      expect(draw[3]).toBeCloseTo(d.height * camera.scale, 3);
      expect(r.context.imageSmoothingEnabled).toBe(true);
      expect(r.context.imageSmoothingQuality).toBe("high");
      return [...[d.camera, d.cursor, ...d.clicks.flatMap((c) => [c.target, c.halo])].map((id) => {
        const n = r.node(id);
        return [n.x, n.y, n.scale, n.opacity];
      }), draw];
    };
    const expected = new Map<number, number[][]>();
    for (const t of times) {
      const fresh = await runtime(block);
      fresh.tl.seek(t);
      expected.set(t, sample(fresh));
      fresh.tl.kill();
    }
    const r = await runtime(block);
    try {
      for (const t of [...times, 5, 3.7, 0, 4.3, 2.3, 4.08, 3.08, 2.7]) {
        r.tl.seek(t);
        expect(sample(r), `seek ${t}`).toEqual(expected.get(t));
      }
    } finally { r.tl.kill(); }
  });

  it("creates only single-property new tweens, all with immediateRender:false", async () => {
    const p = page(device() + cta().replace('class="action"', 'class="action" data-cue="again"'));
    const calls: { from: object; to: Record<string, unknown> }[] = [];
    const initial: Record<string, unknown>[] = [];
    const tl = { fromTo(el: unknown, from: object, to: Record<string, unknown>) {
      // A mixed DOM/object array makes GSAP apply its DOM harness to the raster state.
      expect(Array.isArray(el)).toBe(false);
      calls.push({ from, to });
    }, set() {}, seek() {} };
    const window: Record<string, unknown> = { gsap: { timeline: () => tl, set(_el: unknown, state: Record<string, unknown>) { initial.push(state); return { progress() { return this; }, kill() {} }; } }, dispatchEvent() {} };
    const context = { clearRect() {}, drawImage() {} };
    runInNewContext(timelineScript(p.plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: (id: string) => ({ id, querySelector: () => ({ decode: () => Promise.resolve() }), getContext: () => context }) }, Event: class {}, console });
    for (let i = 0; i < 20 && window.__hfTimelinesBuilding; i++) await Promise.resolve();
    expect(calls.length).toBeGreaterThan(10);
    expect(initial).toHaveLength(6);
    for (const state of initial) {
      expect(Object.keys(state).filter((k) => !["immediateRender", "paused"].includes(k))).toHaveLength(1);
      expect(state.immediateRender).toBe(false);
    }
    for (const { from, to } of calls) {
      expect(Object.keys(from)).toHaveLength(1);
      expect(Object.keys(to).filter((k) => !["duration", "ease", "immediateRender", "force3D"].includes(k))).toEqual(Object.keys(from));
      expect(to.immediateRender).toBe(false);
    }
    // Only DOM targets take the CSS force3D option; the raster state has no CSS properties.
    const device3d = calls.filter(({ to }) => "force3D" in to);
    expect(device3d).toHaveLength(13);
    expect(device3d.every(({ to }) => to.force3D === false)).toBe(true);
  });

  it.each([
    ["a zoom running at path start", device("browser"), cues, 0],
    ["a completed zoom", device("browser"), { zoom: 2, click: 3.2, again: 4 }, 0],
    ["a click sharing its zoom marker and cue", device("browser", rect("save", 'data-zoom="70,25,2" data-click="save" data-cue="zoom"')), cues, -1],
    ["a click before a zoom at the same cue in document order", device("browser", '<i data-click="save" data-cue="zoom"></i>' + rect("save", 'data-zoom="70,25,2" data-cue="zoom"')), cues, -1],
    ["two zooms before a click", device("browser", rect("next", 'data-zoom="70,25,2" data-cue="click"') + rect("save", 'data-zoom="50,50,1.2" data-cue="zoom"') + '<i data-click="save" data-cue="again"></i>'), cues, 1],
    ["a second zoom starting after path start", device("browser", rect("next", 'data-zoom="40,50,2" data-cue="click"') + rect("save", 'data-zoom="70,25,2" data-cue="zoom"') + '<i data-click="save" data-cue="click"></i>'), cues, 0],
  ] as const)("first cursor path stays inside the viewport after %s", (_name, block, cueTimes, entryZoom) => {
    const d = page(block, "portrait", cueTimes).plan.devices![0]!, c = d.clicks[0]!;
    const g = deviceViewport(GEOMETRY.portrait, "browser");
    const entryCamera = entryZoom < 0 ? { x: 0, y: 0, scale: 1 } : d.zooms[entryZoom]!.to;
    expect(c.path[0]).toEqual(cursorEntry(g.width, g.height, entryCamera));
    expect(d.initial).toEqual(c.path[0]);
    // Use the actual eased camera at each sampled time, including while the zoom is running.
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const time = c.start + (c.t - c.start) * s;
      let camera = { x: 0, y: 0, scale: 1 };
      for (const z of d.zooms) {
        if (time < z.t) break;
        const p = gsap.parseEase("power2.inOut")(Math.min(1, (time - z.t) / z.d));
        camera = {
          x: z.from.x + (z.to.x - z.from.x) * p,
          y: z.from.y + (z.to.y - z.from.y) * p,
          scale: z.from.scale + (z.to.scale - z.from.scale) * p,
        };
      }
      const [a, b, e] = c.path as [[number, number], [number, number], [number, number]];
      const point = [0, 1].map((k) => (1 - s) ** 2 * a[k]! + 2 * (1 - s) * s * b[k]! + s ** 2 * e[k]!);
      const screen = [point[0]! * camera.scale + camera.x, point[1]! * camera.scale + camera.y];
      expect(screen[0]).toBeGreaterThanOrEqual(0);
      expect(screen[0]).toBeLessThanOrEqual(g.width);
      expect(screen[1]).toBeGreaterThanOrEqual(0);
      expect(screen[1]).toBeLessThanOrEqual(g.height);
    }
  });

  it("uses the plain entry without zoom and leaves 32 px for the cursor at screenshot edges", () => {
    const g = deviceViewport(GEOMETRY.portrait, "browser");
    const plain = page(device("browser", rect() + '<i data-click="save" data-cue="click"></i>')).plan.devices![0]!;
    expect(plain.clicks[0]!.path[0]).toEqual([g.width * 0.1, g.height * 0.85]);
    expect(cursorEntry(100, 100, { x: 500, y: -500, scale: 2 })).toEqual([0, 68]);
    expect(cursorEntry(100, 100, { x: -500, y: 500, scale: 2 })).toEqual([68, 0]);
    expect(cursorEntry(g.width, g.height, deviceZoom(g.width, g.height, 100, 100, 2))).toEqual([g.width * 0.8, g.height - 32]);
  });

  it("re-enters for a later click when a zoom moves the previous cursor point off-screen", () => {
    const block = device("browser", rect("save") + '<i data-click="save" data-cue="zoom"></i>'
      + rect("next", 'data-zoom="20,25,2" data-cue="click"').replace('60%', '10%')
      + '<i data-click="next" data-cue="again"></i>');
    const d = page(block).plan.devices![0]!, camera = d.zooms[0]!.to;
    const [first, second] = d.clicks;
    const g = deviceViewport(GEOMETRY.portrait, "browser");
    expect(first!.path[2]![0] * camera.scale + camera.x).toBeGreaterThan(g.width);
    expect(second!.path[0]).toEqual(cursorEntry(g.width, g.height, camera));
    expect(second!.path[0]).not.toEqual(first!.path[2]);
  });

  it.each(["landscape", "portrait", "square"] as const)("paints the %s screenshot at fixed viewport resolution below an unscaled overlay holding the camera", (resolution) => {
    const p = page(device("browser"), resolution);
    const d = p.plan.devices![0]!;
    expect([d.width, d.height]).toEqual(Object.values(deviceViewport(GEOMETRY[resolution], "browser")));
    // The camera (scaled by the runtime) sits inside the overlay layer, never above it.
    expect(p.html).toMatch(new RegExp(`<div class="tr-device-vp"><canvas class="tr-device-raster" width="${Math.ceil(d.width)}" height="${Math.ceil(d.height)}" aria-hidden="true" id="${d.raster}"></canvas>`
      + `<div class="tr-device-overlay"><div class="tr-device-camera" id="${d.camera}">${image}`
      + `<i data-target="save"[^>]*></i><i class="tr-agent-cursor"[^>]*></i><i class="tr-click-halo"[^>]*></i></div></div></div></div>`));
    const css = readFileSync(new URL("../themes/default/theme.css", import.meta.url), "utf8");
    expect(css).toContain(".tr-device-vp { position: relative; width: var(--tr-device-width); height: var(--tr-device-height); overflow: hidden; contain: paint; }");
    expect(css).toContain(".tr-device-raster { position: absolute; left: 0; top: 0; max-width: none; }");
    expect(css).toContain(".tr-device-overlay { position: absolute; inset: 0; will-change: opacity; }");
    expect(css).toContain(".tr-device-camera { position: absolute; inset: 0; transform-origin: 0 0; overflow: hidden; }");
    expect(css).toContain(".tr-device-camera > img { display: none; }");
    // Nothing under the camera may become its own layer: its scale must be painted, not composited.
    const rules = css.slice(css.indexOf("/* ---------- device screenshot and CTA ---------- */"), css.indexOf('[data-block="cta"] {'));
    expect(rules).toContain(".tr-click-halo {");
    for (const [, selector, body] of rules.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/tr-device-camera|tr-agent-cursor|tr-click-halo|\[data-target\]/.test(selector!)) expect(body, selector).not.toMatch(/will-change|translateZ|translate3d|backface-visibility/);
    }
  });
});

describe("carried visual fixes", () => {
  const css = readFileSync(new URL("../themes/default/theme.css", import.meta.url), "utf8");
  it("bounds portrait push-in and pan within the 6% side zone", () => {
    const g = GEOMETRY.portrait, left = g.padding.left, width = g.width - left - g.padding.right;
    for (const camera of ["push-in", "pan-left"]) {
      const c = portraitCamera(camera);
      for (const p of [0, 0.25, 0.5, 1]) {
        const value = c.from + (c.to - c.from) * p;
        const x = c.prop === "x" ? value : -(value - 1) * width / 2;
        const w = c.prop === "scale" ? width * value : width;
        expect(left + x).toBeGreaterThanOrEqual(g.width * g.safeZones.sides - 1e-9);
        expect(left + x + w).toBeLessThanOrEqual(g.width * (1 - g.safeZones.sides) + 1e-9);
      }
    }
    expect(timelineScript(page().plan)).toContain(`scale: ${portraitCamera("push-in").to}, duration: b.unmount - b.start`);
  });

  it("fades the portrait caption backdrop to transparent at both edges", () => {
    expect(css).toMatch(/\[data-resolution="portrait"\] \.tr-captions \{\s*background: linear-gradient\(to bottom, rgba\(8, 9, 12, 0\) 0%,[^;]+rgba\(8, 9, 12, 0\) 100%\);/);
  });

  it("gives portrait and square captions their own layer, keeping their text greyscale on every render worker", () => {
    expect(css).toMatch(/\[data-resolution="portrait"\] \.tr-captions,\r?\n\[data-resolution="square"\] \.tr-captions \{ will-change: transform; \}/);
  });

  it("gives wrapped Arabic headings more line height", () => {
    expect(css).toMatch(/:root:lang\(ar\) \[data-block="title"\] h1,[\s\S]+?line-height: 1\.5; letter-spacing: 0;/);
    expect(css).toContain(':root:lang(ar) [data-block="definition"] .term,');
  });

  it("mirrors RTL bullets, quote ornament, chapter divider and source padding", () => {
    expect(css).toContain('[dir="rtl"] [data-block="list"] li { padding-left: 0; padding-right: calc(var(--tr-k) * 64px); }');
    expect(css).toContain('[dir="rtl"] [data-block="list"] li::before { left: auto; right: 0; }');
    expect(css).toContain('[dir="rtl"] [data-block="quote"]::before { left: auto; right: 0; }');
    expect(css).toContain('border-right: 0; border-left: 4px solid var(--tr-line);');
    expect(css).toContain('[dir="rtl"] .tr-source { padding-left: 0; padding-right: 24px; }');
  });

  it("preserves the complete pre-s6 stylesheet and scopes every added rule", () => {
    const [legacy, added] = css.replace(/\r\n/g, "\n").split('/* ---------- device screenshot and CTA ---------- */');
    expect(createHash("sha256").update(legacy!.trimEnd()).digest("hex")).toBe("cff657176fb63182de825ae5886748e06e54a85446ddfeb5e41b8464297e29b4");
    for (const match of added!.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const selector of match[1]!.split(",")) {
        expect(selector.trim()).toMatch(/^(?:\[data-block="(?:device|cta)"\]|\.tr-(?:device|agent-cursor|click-halo)|\[data-resolution="(?:portrait|square)"\]|:root:lang\(ar\)|\[dir="rtl"\])/);
      }
    }
  });
});
