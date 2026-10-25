import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { alignWords } from "../src/align-map.js";
import { check } from "../src/check.js";
import { ARABIC_FUNCTION_WORDS, captionDisplay, captionLines } from "../src/compose-captions.js";
import { buildPage, composeChapter, packageDir, prepareScene, timelineScript } from "../src/compose.js";
import { descendants, getAttr, languageDirection, parseFragment } from "../src/compose-html.js";
import { parseScene, resolveTimeline } from "../src/compose-scene.js";
import { resolveCues } from "../src/cues.js";
import type { CaptionsFile } from "../src/schema.js";
import { parseScript, parseScriptFile } from "../src/script.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { normToken } from "../src/text.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

const fixture = new URL("./fixtures/m3-portrait-rtl/", import.meta.url);
const script = readFileSync(new URL("01-arabic.md", fixture), "utf8");
const source = readFileSync(new URL("scene.html", fixture), "utf8");
const captionsJson = readFileSync(new URL("captions.json", fixture), "utf8");
const captions = JSON.parse(captionsJson) as CaptionsFile;
const words = (text: string) => text.split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25, matched: true }));
const lines = (text: string) => captionLines(words(text), 100, "portrait", "ar").map((l) => l.text);

function page(lang = "ar", resolution: "portrait" | "landscape" = "portrait", sceneSource = source) {
  const scene = parseScene(sceneSource);
  return buildPage({ lang, resolution, scene, timeline: resolveTimeline(scene, {}, 6, resolution), captions, audioDuration: 6, sources: new Map() });
}

describe("Arabic caption display and breaking", () => {
  it("pins the function-word list and keeps marked function words with following text", () => {
    expect([...ARABIC_FUNCTION_WORDS]).toEqual(["في", "من", "على", "إلى", "عن", "مع", "أن", "إن", "لا", "ما", "هذا", "هذه", "التي", "الذي"]);
    for (const word of ARABIC_FUNCTION_WORDS) {
      const marked = word + "َ";
      const result = lines(`نكتب مقاطع واضحة ومفيدة ${marked} جمهورنا العربي اليوم.`);
      expect(result.length).toBeGreaterThan(1);
      for (const line of result) expect(ARABIC_FUNCTION_WORDS.has(line.split(" ").at(-1)!)).toBe(false);
      expect(result.join(" ")).toBe(`نكتب مقاطع واضحة ومفيدة ${word} جمهورنا العربي اليوم.`);
    }
    const paused = words("نكتب فِي العالم اليوم.");
    paused[2]!.start = 2;
    paused[2]!.end = 2.25;
    paused[3]!.start = 2.3;
    paused[3]!.end = 2.55;
    expect(captionLines(paused, 4, "portrait", "ar").map((l) => l.text)).toEqual(["نكتب في العالم اليوم."]);
    expect(lines(`فِي ${"ك".repeat(40)}`)).toEqual([`في ${"ك".repeat(40)}`]);
  });

  it("strips only the specified harakat on NFC and preserves letters, tatweel and written digits", () => {
    expect(captionDisplay("أَ إِ آٌ ؤُ ئٍ ا\u0654َ ا\u0655ِ ا\u0653ٌ الـنَّصُّ هٰذا ٩٠٪ 90%", "ar"))
      .toBe("أ إ آ ؤ ئ أ إ آ الـنص هذا ٩٠٪ 90%");
    const marks = Array.from({ length: 0x65f - 0x64b + 1 }, (_, i) => String.fromCharCode(0x64b + i)).join("") + "\u0670";
    expect(captionDisplay("ب" + marks, "ar")).toBe("ب");
    expect(captionDisplay("أَهْلًا café", "en")).toBe("أَهْلًا café");
    expect(lines("نصنع مقاطع قصيرة وواضحة")).toEqual(["نصنع مقاطع قصيرة وواضحة"]);
  });

  it.each(["،", "؛"])("prefers a clause break at %s with punctuation attached", (punctuation) => {
    expect(lines(`نكتب مقاطع واضحة${punctuation} نصنع قصصا مفيدة للجميع.`))
      .toEqual([`نكتب مقاطع واضحة${punctuation}`, "نصنع قصصا مفيدة للجميع."]);
  });

  it("breaks after an Arabic question mark, including closing quotes", () => {
    expect(lines("هل نبدأ؟» نعم نبدأ.")).toEqual(["هل نبدأ؟»", "نعم نبدأ."]);
  });
});

describe("Arabic script and composed pages", () => {
  it("parses the handwritten fixture with tashkeel and tatweel, preserving cue resolution", () => {
    const chapter = parseScriptFile(fileURLToPath(new URL("01-arabic.md", fixture)));
    expect(chapter.words).toEqual(captions.words.map((w) => w.text));
    expect(resolveCues(chapter, captions)).toEqual({ brand: 0.75, last: 3.55 });
    expect(normToken("الـنَّصُّ")).toBe("النص");
    expect(normToken("أَهْلًا")).toBe("اهلا"); // Existing alignment matching is unchanged.
    expect(parseScript("# عنوان\n\nأَهْلًا {#next}، بِكُمْ [s:ref]؛ نبدأ ؟").words)
      .toEqual(["أَهْلًا،", "بِكُمْ؛", "نبدأ؟"]);
  });

  it.each([["مـن", "من"], ["الــنَّصُّ", "النص"]])("aligns script %s with heard %s without tatweel, keeping script spelling and timing", (written, heard) => {
    const result = alignWords([written], [{ word: heard, start: 0.75, end: 1.25 }]);
    expect(result.matched).toBe(1);
    expect(result.words).toEqual([{ text: written, start: 0.75, end: 1.25, matched: true }]);
  });

  it.each(["portrait", "landscape"] as const)("sets RTL and LTR islands in %s, displaying the script without marks", (resolution) => {
    const before = JSON.stringify(captions);
    const p = page("ar", resolution);
    const root = parseFragment(p.html);
    const all = descendants(root);
    expect(getAttr(all.find((el) => el.tag === "html")!, "dir")).toBe("rtl");
    for (const block of all.filter((el) => ["terminal", "code"].includes(getAttr(el, "data-block") ?? ""))) expect(getAttr(block, "dir")).toBe("ltr");
    const displayWords = all.filter((el) => getAttr(el, "class") === "tr-word").map((el) => el.children.map((c) => c.type === "text" ? c.raw : "").join(""));
    expect(displayWords).toEqual(["أهلا", "بكم،", "نصنع", "مع", "TalkReel", "مقاطع", "قصيرة؛", "إلى", "العالم", "ننطلق؟", "آفاق", "ومسؤول", "وبيئة", "والـنص", "٩٠٪", "90%."]);
    expect(p.lines.some((l) => /[\u0600-\u06ff]/.test(l.text) && l.text.includes("TalkReel"))).toBe(true);
    expect(p.plan.words.map(({ start, end }) => ({ start, end }))).toEqual(captions.words.map(({ start, end }) => ({ start, end })));
    expect(JSON.stringify(captions)).toBe(before);
    expect(p.plan.targets.filter((t) => t.anim === "type")).toHaveLength(2);
  });

  it("emits no dir attributes on LTR pages and uses the direction table", () => {
    for (const lang of ["en", "fr", "unknown"]) {
      expect(languageDirection(lang)).toBe("ltr");
      expect(page(lang).html).not.toContain('dir="');
    }
    expect(languageDirection("ar")).toBe("rtl");
  });

  it("mirrors executed text and figure slide tweens in RTL", async () => {
    for (const lang of ["ar", "en"]) {
      const withFigure = source.replace("</section>", '<figure data-block="figure" data-anim="slide"><img src="assets/demo.png" alt="مثال"></figure></section>');
      const p = page(lang, "portrait", withFigure);
      const calls: { from: { x?: number }; to: { x?: number } }[] = [];
      const tl = { fromTo: (_el: unknown, from: { x?: number }, to: { x?: number }) => calls.push({ from, to }), set: () => {}, seek: () => {} };
      const window = { gsap: { timeline: () => tl, set: () => {} }, dispatchEvent: () => {} };
      runInNewContext(timelineScript(p.plan), { window, document: { fonts: { ready: Promise.resolve() }, getElementById: () => ({}) }, Event: class {} });
      await new Promise((resolve) => setImmediate(resolve));
      expect(calls.filter(({ to }) => to.x === 0).map(({ from }) => from.x)).toEqual(lang === "ar" ? [-80, -80] : [80, 80]);
    }
  });

  it("rejects RTL type in compose and check, allowing terminal/code typing", async () => {
    const bad = '<section data-beat="a"><p data-anim="type">أهلا</p></section>';
    const talk = loadTalk(makeTalk({ "sources.json": '{"sources":[]}', "script/ar/01-a.md": script, "script/en/01-a.md": "# A\n\nHello.", "scenes/01-a.html": bad }, { languages: ["en", "ar"], voice: { mode: "own" } }));
    expect(() => prepareScene("scene.html", bad, parseScript(script), captions, 6, new Set(), "portrait", talk.dir)).toThrow(/E_RTL_TYPE/);
    const issues = await check(talk);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/E_RTL_TYPE.*script\/ar/);
    expect(() => prepareScene("scene.html", source, parseScript(script), captions, 6, new Set(), "portrait", talk.dir)).not.toThrow();
    writeFileSync(join(talk.dir, "scenes/01-a.html"), source);
    expect(await check(talk)).toEqual([]);
  });

  it("copies Arabic font weights and leaves the captions JSON unchanged during compose", () => {
    const talk = loadTalk(makeTalk({ "sources.json": '{"sources":[]}', "script/ar/01-a.md": script, "scenes/01-a.html": source, "captions/ar/01.json": captionsJson }, { languages: ["ar"], resolution: "portrait", voice: { mode: "own" } }));
    const wav = paths.narrationWav(talk, "ar", "01");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, 6);
    const result = composeChapter(talk, listChapters(talk, "ar")[0]!);
    const css = readFileSync(join(result.dir, "theme.css"), "utf8");
    expect(css).toMatch(/\.tr-word\s*\{[^}]*unicode-bidi:\s*isolate/);
    expect(css).toMatch(/:root:lang\(ar\)\s*\{[^}]*--tr-font:\s*"IBM Plex Sans Arabic"/);
    for (const weight of [400, 600, 700]) {
      const font = `ibm-plex-sans-arabic-arabic-${weight}-normal.woff2`;
      expect(css).toContain(`fonts/${font}`);
      expect(readFileSync(join(result.dir, "fonts", font))).toEqual(readFileSync(join(packageDir("@fontsource/ibm-plex-sans-arabic"), "files", font)));
    }
    expect(readFileSync(paths.captions(talk, "ar", "01"), "utf8")).toBe(captionsJson);
    writeFileSync(join(talk.dir, "scenes/01-a.html"), '<section data-beat="a"><p data-anim="type">أهلا</p></section>');
    expect(() => composeChapter(talk, listChapters(talk, "ar")[0]!)).toThrow(/E_RTL_TYPE/);
  });
});
