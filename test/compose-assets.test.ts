import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { gsap } from "gsap";
import { describe, expect, it, vi } from "vitest";
import { check } from "../src/check.js";
import { cmdRender } from "../src/commands/render.js";
import { buildPage, composeChapter, prepareScene, sceneInputHash, timelineScript } from "../src/compose.js";
import { parseScene, resolveTimeline, SceneError, validateScene } from "../src/compose-scene.js";
import { hashJson, sha256 } from "../src/hash.js";
import { parseScript } from "../src/script.js";
import { emptyState } from "../src/schema.js";
import { currentAlignHash, currentRenderHash, currentVoiceHash } from "../src/stages.js";
import { chapterKey, recordStage, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { WORKED_SCENE, WORKED_SCRIPT, writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

const SCRIPT = "# Figure\n\nHello {#show} world.\n";
const CAPTIONS = { lang: "en", words: [{ text: "Hello", start: 0, end: 1, matched: true }, { text: "world.", start: 1, end: 2, matched: true }] };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g"><stop stop-color="gold"/></linearGradient><path id="p" d="M0 0h100v100z"/></defs><use href="#p" fill="url(#g)"/></svg>';
const img = (src = "assets/screen.png", alt = 'alt="Chapter dashboard"') => `<img src="${src}" ${alt}>`;
const figure = (image = img()) => `<figure data-block="figure">${image}<figcaption>Ready to review</figcaption></figure>`;
const scene = (block = figure()) => `<section data-beat="open">${block}</section>`;

function fixture(html = scene(), assets: Record<string, string> = { "assets/screen.png": "PNG bytes" }) {
  return loadTalk(makeTalk({
    "sources.json": '{"sources":[]}',
    "script/en/01-figure.md": SCRIPT,
    "scenes/01-figure.html": html,
    "captions/en/01.json": JSON.stringify(CAPTIONS),
    ...assets,
  }));
}

function issues(html: string, talkDir: string) {
  return validateScene(parseScene(html), { sources: new Set(), cues: new Set(["show"]), resolution: "portrait", talkDir });
}

describe("local image validation", () => {
  it.each(["png", "jpg", "jpeg", "webp", "PNG", "JpEg", "svg", "SVG"])("accepts a single %s image with alt text", (ext) => {
    const path = `assets/screens/product.${ext}`;
    const html = scene(figure(img(path)));
    const talk = fixture(html, { [path]: ext.toLowerCase() === "svg" ? SVG : "image bytes" });
    expect(issues(html, talk.dir)).toEqual([]);
  });

  const badImages: [string, string, Record<string, string>?][] = [
    ["POSIX absolute path", img("/tmp/screen.png")],
    ["Windows absolute path", img("C:\\screen.png")],
    ["drive-relative path", img("C:screen.png")],
    ["UNC path", img("\\\\server\\screen.png")],
    ["parent segment", img("assets/../screen.png")],
    ["nested parent segment", img("assets/screens/../../screen.png")],
    ["backslash traversal", img("assets/..\\screen.png")],
    ["encoded traversal", img("assets/%2e%2e/screen.png")],
    ["http URL", img("http://example.org/screen.png")],
    ["https URL", img("https://example.org/screen.png")],
    ["protocol-relative URL", img("//example.org/screen.png")],
    ["data URL", img("data:image/png;base64,AA==")],
    ["file URL", img("file:///screen.png")],
    ["another scheme", img("ftp:screen.png")],
    ["scheme inside assets", img("assets/file:screen.png")],
    ["missing src", '<img alt="Dashboard">'],
    ["outside assets", img("screen.png")],
    ["missing file", img("assets/missing.png")],
    ["directory", img("assets/directory.png"), { "assets/directory.png/child.txt": "x" }],
    ["empty alt", img("assets/screen.png", 'alt=""')],
    ["whitespace alt", img("assets/screen.png", 'alt=" &#32; "')],
    ["missing alt", img("assets/screen.png", "")],
    ["bare alt", img("assets/screen.png", "alt")],
    ["gif extension", img("assets/image.gif"), { "assets/image.gif": "image" }],
    ["no extension", img("assets/image"), { "assets/image": "image" }],
    ["query string", img("assets/screen.png?other")],
    ["fragment", img("assets/screen.png#other")],
    ["alternate srcset", '<img src="assets/screen.png" alt="Dashboard" srcset="assets/other.png 2x">'],
  ];

  const badSvgs = [
    '<use href="other.svg#p"/>',
    '<use xlink:href="https://example.org/p.svg#p"/>',
    '<use href="&#104;ttps://example.org/p.svg#p"/>',
    '<path fill="url(other.svg#g)"/>',
    '<path fill="url(\'https://example.org/g\')"/>',
    '<path fill="url(&quot;other.svg#g&quot;)"/>',
    '<style>path { fill: url(//example.org/g); }</style>',
    '<style>@import "other.css";</style>',
    '<style>@im&#112;ort "other.css";</style>',
    '<style>path { fill: u&#114;l(other.svg#g); }</style>',
    '<style>path { background-image: image-set("other.png" 1x); }</style>',
    '<style>path { fill: u\\72l(other.svg#g); }</style>',
    '<style>path { fill: u/**/rl(other.svg#g); }</style>',
    '<image href="#p"/>',
    '<image href="other.png"/>',
    '<feImage href="other.svg"/>',
    '<script>alert(1)</script>',
    '<foreignObject><div>HTML</div></foreignObject>',
    '<g xml:base="https://example.org/"><use href="#p"/></g>',
    '<use href="#p"><set attributeName="href" to="other.svg#p"/></use>',
    '<path onload="fetch(\'other.svg\')"/>',
    '<s:script xmlns:s="http://www.w3.org/2000/svg">alert(1)</s:script>',
  ];
  for (const body of badSvgs) badImages.push([`external or active SVG: ${body}`, img("assets/bad.svg"), { "assets/bad.svg": `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>` }]);
  badImages.push(["SVG external entity", img("assets/bad.svg"), { "assets/bad.svg": '<!DOCTYPE svg [<!ENTITY x SYSTEM "other.svg">]><svg>&x;</svg>' }]);
  badImages.push(["SVG stylesheet instruction", img("assets/bad.svg"), { "assets/bad.svg": '<?xml-stylesheet href="other.css"?><svg/>' }]);

  it.each(badImages)("reports E_ASSET from validation, compose preparation and check: %s", async (_name, image, files) => {
    const html = scene(figure(image));
    const talk = fixture(html, { "assets/screen.png": "image", ...files });
    expect(issues(html, talk.dir).map((i) => i.rule)).toContain("E_ASSET");
    expect(() => prepareScene("scenes/01-figure.html", html, parseScript(SCRIPT), CAPTIONS, 2, new Set(), "portrait", talk.dir)).toThrow(/E_ASSET/);
    const found = (await check(talk)).filter((i) => i.message.startsWith("E_ASSET"));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]).toMatchObject({ file: "scenes/01-figure.html", line: 1 });
  });

  it("rejects a symlink directory escaping the talk in validation and check", async () => {
    const talk = fixture(scene(figure(img("assets/escape/outside.png"))));
    const outside = makeTalk({ "outside.png": "outside bytes" });
    symlinkSync(outside, join(talk.dir, "assets/escape"), process.platform === "win32" ? "junction" : "dir");
    expect(issues(readFileSync(join(talk.dir, "scenes/01-figure.html"), "utf8"), talk.dir)).toContainEqual(expect.objectContaining({ rule: "E_ASSET", message: expect.stringContaining("symlink") }));
    expect((await check(talk)).some((i) => i.message.startsWith("E_ASSET"))).toBe(true);
  });

  it.each([
    '<div data-block="title">' + img() + '</div>',
    img(),
    figure(""),
    figure(img() + img()),
    figure('<div>' + img() + '</div>'),
  ])("rejects images outside the current slots and malformed figures: %s", (block) => {
    const talk = fixture();
    expect(issues(scene(block), talk.dir).map((i) => i.rule)).toContain("E_ASSET");
  });

  it("accepts XML declarations, comments and internal SVG references", async () => {
    const html = scene(figure(img("assets/good.svg")));
    const talk = fixture(html, { "assets/good.svg": '<?xml version="1.0" encoding="UTF-8"?>\n<!-- standalone -->' + SVG });
    expect(issues(html, talk.dir)).toEqual([]);
    expect(await check(talk)).toEqual([]);
  });
});

describe("asset hashes and chapter copying", () => {
  // Exact pre-s2 hash payload: asset-free scenes must keep all and only these fields.
  const previousInputs = (source: string, script = SCRIPT) => {
    const chapter = parseScript(script);
    return { scene: sha256(source), cues: chapter.cues.map((c) => [c.id, c.wordIndex]), displays: chapter.displays.map((d) => [d.first, d.count, d.text]), tag: chapter.tag, sources: [] };
  };

  it.each([scene('<p>Hello</p>'), scene('<p>&lt;img src="assets/none.png"&gt;</p>'), scene('<p>Hello</p><!-- <img src="assets/none.png"> -->')])("preserves the exact hash with no images: %s", (html) => {
    expect(sceneInputHash(html, parseScript(SCRIPT), new Map())).toBe(hashJson(previousInputs(html)));
    expect(sceneInputHash(html, parseScript(SCRIPT), new Map(), "/missing/talk")).toBe(hashJson(previousInputs(html)));
  });

  it("preserves the original worked scene hash, including source labels and cues", () => {
    const chapter = parseScript(WORKED_SCRIPT);
    const ids = [...WORKED_SCENE.matchAll(/data-source\s*=\s*["']s:([^"']+)["']/g)].map((m) => m[1]!).sort();
    expect(sceneInputHash(WORKED_SCENE, chapter, new Map())).toBe(hashJson({ ...previousInputs(WORKED_SCENE, WORKED_SCRIPT), sources: ids.map(() => null) }));
  });

  it("hashes sorted, deduplicated path:sha256 pairs and only the referenced files", () => {
    const html = scene(figure(img("assets/z.png")) + figure(img("assets/a.svg")) + figure(img("assets/z.png")));
    const talk = fixture(html, { "assets/z.png": "last", "assets/a.svg": SVG, "assets/unused.png": "unused" });
    const hash = () => sceneInputHash(html, parseScript(SCRIPT), new Map(), talk.dir);
    const before = hash();
    expect(before).toBe(hashJson({ ...previousInputs(html), assets: [`assets/a.svg:${sha256(SVG)}`, `assets/z.png:${sha256("last")}`] }));
    writeFileSync(join(talk.dir, "assets/unused.png"), "changed");
    expect(hash()).toBe(before);
    writeFileSync(join(talk.dir, "assets/z.png"), "changed");
    expect(hash()).not.toBe(before);
    expect(() => sceneInputHash(html, parseScript(SCRIPT), new Map())).toThrow(/E_ASSET/);
    unlinkSync(join(talk.dir, "assets/z.png"));
    expect(hash).toThrow(SceneError);
  });

  it.each(["landscape", "portrait", "square"] as const)("copies original bytes and paths into a %s chapter and invalidates render hashes on asset edits", async (resolution) => {
    const html = scene(figure(img("assets/screens/product.SVG")));
    const talk = fixture(html, { "assets/screens/product.SVG": SVG });
    talk.config.resolution = resolution;
    const wav = paths.narrationWav(talk, "en", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 2);
    const ch = listChapters(talk, "en")[0]!;
    const before = await currentRenderHash(talk, ch);
    expect(before).not.toBeNull();
    const result = composeChapter(talk, ch);
    expect(readFileSync(join(result.dir, "assets/screens/product.SVG"))).toEqual(readFileSync(join(talk.dir, "assets/screens/product.SVG")));
    expect(existsSync(join(result.dir, "assets/narration.wav"))).toBe(true);
    expect(result.page.html).toContain('<img src="assets/screens/product.SVG" alt="Chapter dashboard">');
    expect(result.page.plan.figures).toEqual([{ id: expect.any(String), anim: "fade", t: 0, d: 0.6 }]);
    writeFileSync(join(talk.dir, "assets/screens/product.SVG"), SVG.replace("gold", "red"));
    expect(await currentRenderHash(talk, ch)).not.toBe(before);
    unlinkSync(join(talk.dir, "assets/screens/product.SVG"));
    expect(await currentRenderHash(talk, ch)).toBeNull();
    expect(() => composeChapter(talk, ch)).toThrow(/E_ASSET/);
  });

  it("render reports E_ASSET when invalid assets prevent computing a render hash", async () => {
    const talk = fixture(scene(figure(img("assets/missing.png"))));
    const ch = listChapters(talk, "en")[0]!;
    const state = emptyState();
    for (const file of [paths.narrationWav(talk, "en", "01"), paths.sourceWav(talk, "en", "01")]) {
      mkdirSync(dirname(file), { recursive: true });
      writeWav(file, 2);
    }
    recordStage(state, "voice", chapterKey("en", "01"), (await currentVoiceHash(talk, ch, parseScript(SCRIPT)))!);
    recordStage(state, "align", chapterKey("en", "01"), (await currentAlignHash(talk, ch, parseScript(SCRIPT)))!);
    writeState(paths.state(talk), state);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await cmdRender(talk, { lang: "en", quality: "draft", telemetry: false })).toBe(1);
      expect(error.mock.calls.some(([message]) => String(message).includes("E_ASSET"))).toBe(true);
    } finally {
      error.mockRestore();
    }
  });
});

describe("figure cue plan", () => {
  it("stays hidden before its cue across forward and backward seeks", async () => {
    const parsed = parseScene(scene(figure().replace('data-block="figure"', 'data-block="figure" data-cue="show"')));
    const timeline = resolveTimeline(parsed, { show: 1 }, 2);
    const page = buildPage({ lang: "en", scene: parsed, timeline, captions: { lang: "en", words: [] }, audioDuration: 2, sources: new Map() });
    const nodes = new Map<string, { opacity: number }>();
    const node = (id: string) => {
      if (!nodes.has(id)) nodes.set(id, { opacity: 1 });
      return nodes.get(id)!;
    };
    const window = { gsap, dispatchEvent() {}, __hfTimelinesBuilding: true, __timelines: {} as Record<string, gsap.core.Timeline> };
    runInNewContext(timelineScript(page.plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: node }, Event: class {}, console });
    for (let n = 0; n < 20 && window.__hfTimelinesBuilding; n++) await Promise.resolve();
    const tl = window.__timelines.main!;
    const image = node(page.plan.figures![0]!.id);
    try {
      for (const time of [0.5, 2, 0.5, 1.3, 0, 2]) {
        tl.seek(time);
        if (time < 1) expect(image.opacity).toBe(0);
        else if (time >= 1.6) expect(image.opacity).toBe(1);
        else expect(image.opacity).toBeGreaterThan(0);
      }
    } finally {
      tl.kill();
    }
  });

  it.each(["fade", "fade-up", "pop", "slide", "type", "draw", "stream"])("builds single-property %s tweens at the resolved cue, with immediateRender:false", async (anim) => {
    const parsed = parseScene(scene(figure().replace('data-block="figure"', `data-block="figure" data-cue="show" data-anim="${anim}"`)));
    const timeline = resolveTimeline(parsed, { show: 1 }, 2);
    const page = buildPage({ lang: "en", scene: parsed, timeline, captions: CAPTIONS, audioDuration: 2, sources: new Map() });
    const id = page.plan.figures![0]!.id;
    expect(page.plan.targets.some((t) => t.id === id)).toBe(false);
    const calls: { el: unknown; from: object; to: Record<string, unknown>; t: number }[] = [];
    const tl = { fromTo(el: unknown, from: object, to: Record<string, unknown>, t: number) { calls.push({ el, from, to, t }); }, set() {}, seek() {} };
    const window: Record<string, unknown> = { gsap: { timeline: () => tl }, dispatchEvent() {} };
    runInNewContext(timelineScript(page.plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: (id: string) => id }, Event: class {}, console });
    // The runtime awaits fonts and diagram setup before publishing the paused timeline.
    for (let n = 0; n < 20 && window.__hfTimelinesBuilding; n++) await Promise.resolve();
    const figureCalls = calls.filter((c) => c.el === id);
    expect(figureCalls.length).toBeGreaterThan(0);
    for (const call of figureCalls) {
      expect(call.t).toBe(1);
      expect(Object.keys(call.from)).toHaveLength(1);
      expect(Object.keys(call.to).filter((k) => !["duration", "ease", "immediateRender"].includes(k))).toEqual(Object.keys(call.from));
      expect(call.to.immediateRender).toBe(false);
    }
  });
});
