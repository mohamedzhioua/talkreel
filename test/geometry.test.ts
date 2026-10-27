import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPage, composeChapter, packageVersion, sceneInputHash, themeHash, timelineScript } from "../src/compose.js";
import { captionLines } from "../src/compose-captions.js";
import { renderArgs } from "../src/compose-hyperframes.js";
import { parseScene, resolveTimeline, validateScene } from "../src/compose-scene.js";
import { GEOMETRY, type Resolution } from "../src/geometry.js";
import { sha256File } from "../src/hash.js";
import { parseScriptFile } from "../src/script.js";
import { currentRenderHash } from "../src/stages.js";
import { renderInputHash } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { writeWav } from "./compose-fixtures.js";
import { landscapeFixtures } from "./geometry-fixtures.js";
import { makeTalk } from "./helpers.js";

it("keeps pre-s1 landscape index.html and timeline.js byte-identical", () => {
  for (const [name, page] of Object.entries(landscapeFixtures())) {
    const dir = new URL(`./fixtures/m2-landscape/${name}/`, import.meta.url);
    expect(Buffer.from(page.html).equals(readFileSync(new URL("index.html", dir)))).toBe(true);
    expect(Buffer.from(timelineScript(page.plan)).equals(readFileSync(new URL("timeline.js", dir)))).toBe(true);
  }
});

const resolutions = Object.keys(GEOMETRY) as Resolution[];

describe("resolution geometry", () => {
  it("holds the M2 landscape constants and all three canvases", () => {
    expect(resolutions).toEqual(["landscape", "portrait", "square"]);
    expect(GEOMETRY.landscape).toEqual({
      width: 1920, height: 1080,
      padding: { top: 72, right: 120, bottom: 208, left: 120 },
      caption: { width: 1600, height: 160, bottom: 0, fontSize: 52, maxChars: 48, absorbMaxChars: 54 },
      terminal: { maxChars: 72, rowHeight: 40, maxRows: 13 },
      safeZones: { top: 0.14, bottom: 0.35, sides: 0.06 },
    });
    expect([GEOMETRY.portrait.width, GEOMETRY.portrait.height]).toEqual([1080, 1920]);
    expect([GEOMETRY.square.width, GEOMETRY.square.height]).toEqual([1080, 1080]);
    for (const g of Object.values(GEOMETRY)) {
      expect(g.caption.width).toBeLessThanOrEqual(g.width - g.padding.left - g.padding.right);
      expect(g.height - g.padding.bottom).toBeLessThan(g.height - g.caption.bottom - g.caption.height);
      expect(g.terminal.maxRows * g.terminal.rowHeight + 116).toBeLessThanOrEqual(g.height - g.padding.top - g.padding.bottom);
      expect(g.caption.absorbMaxChars).toBeGreaterThanOrEqual(g.caption.maxChars);
      expect(g.safeZones).toEqual({ top: 0.14, bottom: 0.35, sides: 0.06 });
    }
    const p = GEOMETRY.portrait;
    expect(p.caption.bottom).toBeGreaterThanOrEqual(p.height * p.safeZones.bottom);
    expect(p.padding.left).toBeGreaterThanOrEqual(p.width * p.safeZones.sides);
    expect(p.padding.top - 56).toBeGreaterThan(p.height * p.safeZones.top);
  });

  it.each(resolutions)("enforces %s terminal character and row boundaries", (resolution) => {
    const { maxChars, maxRows, rowHeight } = GEOMETRY[resolution].terminal;
    const issues = (n: number, rows: number) => validateScene(parseScene(`<section data-beat="a"><div data-block="terminal" data-rows="${rows}"><p data-out>${"x".repeat(n)}</p></div></section>`), { sources: new Set(), resolution });
    expect(issues(maxChars, maxRows)).toEqual([]);
    expect(issues(maxChars + 1, maxRows)).toEqual([expect.objectContaining({ rule: "E_TERM_LINE", message: `${maxChars + 1} characters; a terminal line holds at most ${maxChars}` })]);
    expect(issues(maxChars, maxRows + 1)).toEqual([expect.objectContaining({ rule: "E_TERM_LINE", message: `data-rows must be a whole number from 1 to ${maxRows}` })]);
    const scene = parseScene(`<section data-beat="a"><div data-block="terminal">${Array.from({ length: maxRows + 1 }, () => "<p data-out>ok</p>").join("")}</div></section>`);
    const timeline = resolveTimeline(scene, {}, 5, resolution);
    const page = buildPage({ lang: "en", scene, timeline, captions: { lang: "en", words: [] }, audioDuration: 5, sources: new Map(), resolution });
    expect(page.plan.scrolls.map((s) => s.y)).toEqual([-rowHeight]);
    expect(page.plan.grows.at(-1)?.h).toBe(maxRows * rowHeight + 48);
    expect(page.html).toContain(`style="--rows:${maxRows}"`);
  });

  it.each(resolutions)("breaks %s captions using its own normal and absorb limits", (resolution) => {
    const { maxChars, absorbMaxChars } = GEOMETRY[resolution].caption;
    const words = (s: string) => s.split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25, matched: true }));
    const lines = captionLines(words("Every caption sentence keeps several useful words together across each screen."), 10, resolution);
    expect(lines.flatMap((l) => l.text.split(" "))).toEqual(words("Every caption sentence keeps several useful words together across each screen.").map((w) => w.text));
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(maxChars);
    const absorbed = captionLines(words(`${"x".repeat(absorbMaxChars - 5)} bye.`), 10, resolution);
    expect(absorbed).toHaveLength(1);
    expect(absorbed[0]!.text.length).toBe(absorbMaxChars);
    expect(captionLines(words(`${"x".repeat(absorbMaxChars - 4)} bye.`), 10, resolution)).toHaveLength(2);
  });

  it("keeps four Arabic words on a portrait caption line", () => {
    const text = "نصنع مقاطع قصيرة وواضحة";
    const words = text.split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25, matched: true }));
    expect(captionLines(words, 3, "portrait").map((l) => l.text)).toEqual([text]);
  });
});

describe("composing and hashing new resolutions", () => {
  function fixture(resolution: Resolution) {
    const source = '<section data-beat="a"><p>Hello</p></section>';
    const talk = loadTalk(makeTalk({
      "sources.json": '{"sources":[]}', "script/en/01-a.md": "# A\n\nHello.\n", "scenes/01-a.html": source,
      "captions/en/01.json": JSON.stringify({ lang: "en", words: [{ text: "Hello.", start: 0, end: 1, matched: true }] }),
    }, { resolution }));
    const ch = listChapters(talk, "en")[0]!;
    const wav = paths.narrationWav(talk, "en", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 2);
    return { talk, ch, wav, source };
  }

  it.each(resolutions)("composes %s with the declared canvas and render resolution", (resolution) => {
    const { talk, ch } = fixture(resolution);
    const result = composeChapter(talk, ch);
    const g = GEOMETRY[resolution];
    expect(result.page.html).toContain(`data-resolution="${resolution}"`);
    expect(result.page.html).toContain(`content="width=${g.width}, height=${g.height}"`);
    expect(result.page.html).toContain(`data-width="${g.width}" data-height="${g.height}"`);
    if (resolution !== "landscape") {
      expect(result.page.html).toContain(`--tr-caption-bottom:${g.caption.bottom}px`);
      expect(result.page.html).toContain(`--tr-safe-top:${g.padding.top}px`);
    }
    const args = renderArgs("/b", "/b/c.mp4", 30, "draft", 1, resolution);
    expect(args[args.indexOf("--resolution") + 1]).toBe(resolution);
  });

  it.each(resolutions)("hashes %s with its version suffix, preserving ambient suffixes", async (resolution) => {
    const { talk, ch, wav, source } = fixture(resolution);
    for (const ambient of [false, true]) {
      talk.config.ambient = ambient;
      expect(await currentRenderHash(talk, ch, "draft")).toBe(renderInputHash({
        sceneHash: sceneInputHash(source, parseScriptFile(ch.file), new Map()),
        captionsHash: await sha256File(paths.captions(talk, "en", "01")), wavHash: await sha256File(wav),
        themeHash: await themeHash(talk), hyperframesVersion: packageVersion("hyperframes"), quality: "draft",
        composeVersion: `8${ambient ? "+ambient" : ""}${resolution === "landscape" ? "" : `+${resolution}`}`,
      }));
    }
  });
});
