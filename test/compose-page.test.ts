import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPTION_ABSORB_MAX_CHARS, CAPTION_FUNCTION_WORDS, CAPTION_MAX_CHARS, captionLines } from "../src/compose-captions.js";
import { buildPage, composeChapter, sourceLabel, timelineScript } from "../src/compose.js";
import { parseScene, resolveTimeline } from "../src/compose-scene.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import type { Source } from "../src/schema.js";
import { WORKED_AUDIO, WORKED_CUES, WORKED_SCENE, WORKED_SCRIPT, workedCaptions, writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

const SURVEY: Source = { id: "example-survey", title: "Developer Survey", publisher: "Example", url: "https://www.example.org/survey", quote: "46% ...", date: "2025-07-01" };

function page() {
  const scene = parseScene(WORKED_SCENE);
  const timeline = resolveTimeline(scene, WORKED_CUES, WORKED_AUDIO);
  return buildPage({ lang: "en", scene, timeline, captions: workedCaptions(), audioDuration: WORKED_AUDIO, sources: new Map([[SURVEY.id, SURVEY]]) });
}

describe("composition page", () => {
  const p = page();
  const js = timelineScript(p.plan);

  it("has the HyperFrames root, beat clips, caption track and narration audio", () => {
    expect(p.html).toMatch(/^<!doctype html>\n<html lang="en" data-resolution="landscape">/);
    expect(p.html).toContain('<div id="tr-root" class="tr-root" data-composition-id="main"');
    expect(p.html).toContain('data-start="0" data-duration="20.3" data-width="1920" data-height="1080"');
    expect(p.html).toContain('<section data-beat="open" data-camera="push-in" id="tr-beat-0" class="clip" data-start="0" data-duration="5.96" data-track-index="1">');
    expect(p.html).toContain('<section data-beat="stat" data-cue="stat" id="tr-beat-1" class="clip" data-start="5.66" data-duration="6.14" data-track-index="1">');
    expect(p.html).toContain('id="tr-beat-2" class="clip" data-start="11.5" data-duration="8.8" data-track-index="1"');
    expect(p.html).toContain('<div id="tr-captions" class="tr-captions clip" data-start="0" data-duration="20.3" data-track-index="2">');
    // HyperFrames' static lint reads only the HTML, so the registry is initialised inline.
    expect(p.html).toContain('<script>window.__hfTimelinesBuilding = true; window.__timelines = window.__timelines || {};</script>\n  <script src="timeline.js"></script>');
    expect(p.html).toContain('<audio id="tr-narration" src="assets/narration.wav" data-start="0"\n           data-duration="19.7" data-track-index="3" data-volume="1"></audio>');
    expect(p.html).toContain('<div class="tr-cap-line" id="tr-cap-0"><span class="tr-word" id="tr-w-0" data-state="upcoming">An</span> <span class="tr-word" id="tr-w-1" data-state="upcoming">assistant</span>');
  });

  it("appends the source label and the Mermaid host; keeps the scene markup", () => {
    expect(p.html).toContain('<p class="tr-source">Source: Developer Survey · example.org · 2025</p></div>');
    expect(p.html).toContain('</pre><div class="tr-mermaid" id="tr-m-2-0"></div>');
    expect(p.html).toContain("S[Spec] --> T[Tests]");
    expect(p.html).toContain("<i data-step data-nodes=\"T\" data-edges=\"S-T\" data-cue=\"tests\"></i>");
  });

  it("references only local assets", () => {
    const refs = [...p.html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(refs).toEqual(["theme.css", "vendor/gsap.min.js", "vendor/mermaid.min.js", "assets/narration.wav", "timeline.js"]);
    for (const text of [p.html, js]) {
      expect(text).not.toMatch(/https?:|\/\/[a-z]/i);
    }
  });

  it("timeline.js follows the readiness protocol and is deterministic", () => {
    expect(js.indexOf("window.__hfTimelinesBuilding = true;")).toBeLessThan(js.indexOf("window.__trPlan"));
    expect(js).toContain('window.__timelines["main"] = tl;');
    expect(js).toContain('new Event("hf-timelines-built")');
    expect(js).toContain("gsap.timeline({ paused: true })");
    expect(js).toContain("tl.set({}, {}, P.D)");
    expect(js).toContain('import("./mermaid.mjs")');
    expect(js).not.toMatch(/Math\.random|Date\.now|new Date\(|performance\.now|setTimeout|setInterval|requestAnimationFrame/);
  });

  it("the plan carries the resolved times with at most 3 decimals", () => {
    expect(p.plan.D).toBe(20.3);
    expect(p.plan.beats).toEqual([
      { id: "tr-beat-0", start: 0, unmount: 5.96, fadeAt: 5.66, camera: "push-in" },
      { id: "tr-beat-1", start: 5.66, unmount: 11.8, fadeAt: 11.5, camera: "none" },
      { id: "tr-beat-2", start: 11.5, unmount: 20.3, fadeAt: null, camera: "none" },
    ]);
    expect(p.plan.targets.map((t) => [t.anim, t.t])).toEqual([["pop", 0], ["fade-up", 3.62], ["fade-up", 5.96], ["fade", 11.8]]);
    for (const t of p.plan.targets) expect(p.html).toContain(`id="${t.id}"`);
    expect(p.plan.steps.map((s) => [s.host, s.renderId, s.t])).toEqual([["tr-m-2-0", "tr-d-2-0", 14.12], ["tr-m-2-0", "tr-d-2-0", 15.4], ["tr-m-2-0", "tr-d-2-0", 16.64]]);
    expect(p.plan.diagrams).toEqual([{ renderId: "tr-d-2-0", host: "tr-m-2-0" }]);
    expect(p.plan.words).toHaveLength(46);
    const nums = JSON.stringify(p.plan).match(/\d+\.\d+/g) ?? [];
    for (const n of nums) expect(n.split(".")[1]!.length).toBeLessThanOrEqual(3);
  });

  it("a scene without a diagram loads no Mermaid", () => {
    const scene = parseScene(`<section data-beat="a"><p>x</p></section>`);
    const tl = resolveTimeline(scene, {}, 2);
    const q = buildPage({ lang: "fr", scene, timeline: tl, captions: { lang: "fr", words: [{ text: "x", start: 0, end: 1, matched: true }] }, audioDuration: 2, sources: new Map() });
    expect(q.html).not.toContain("mermaid");
    expect(q.html).toContain('<html lang="fr"');
    expect(timelineScript(q.plan)).toContain('"diagrams":[]');
  });
});

describe("source label", () => {
  it("joins title, host without www and year, leaving out missing parts", () => {
    expect(sourceLabel(SURVEY)).toBe("Source: Developer Survey · example.org · 2025");
    expect(sourceLabel({ title: "T", url: "not a url", date: "" })).toBe("Source: T");
  });
});

describe("caption lines", () => {
  const w = (text: string, start: number, end: number) => ({ text, start, end, matched: true });

  it("fill lines up to 48 characters and break after sentence ends", () => {
    const words = "This is a fairly long caption sentence that keeps on going past the limit. Next one".split(" ").map((t, i) => w(t, i * 0.3, i * 0.3 + 0.25));
    const lines = captionLines(words, 10);
    // "that" may not end a line (COMPOSE_VERSION 4), so it opens the second one.
    expect(lines.map((l) => l.text)).toEqual(["This is a fairly long caption sentence", "that keeps on going past the limit.", "Next one"]);
    for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(48);
  });

  it("break before a pause longer than 0.6 s; show at start - 0.05, hide at the next show or end + 0.3", () => {
    const lines = captionLines([w("One", 1, 1.2), w("two", 1.3, 1.5), w("three", 2.2, 2.5), w("four", 5, 5.4)], 6);
    expect(lines.map((l) => l.text)).toEqual(["One two", "three", "four"]);
    expect(lines.map((l) => [Math.round(l.show * 1000) / 1000, Math.round(l.hide * 1000) / 1000])).toEqual([
      [0.95, 1.8],
      [2.15, 2.8],
      [4.95, 5.7],
    ]);
    expect(captionLines([w("x", 0.02, 0.5)], 0.6)[0]).toMatchObject({ show: 0, hide: 0.6 });
  });

  // Real strings from talks/ai-engineering-today (review of the m1 frames).
  const said = (text: string, t0 = 0) => text.split(" ").map((t, i) => w(t, t0 + i * 0.3, t0 + i * 0.3 + 0.25));
  const texts = (s: string) => captionLines(said(s), 1000).map((l) => l.text);
  const FUNCTION_END = new RegExp(`\\b(${[...CAPTION_FUNCTION_WORDS].join("|")})$`, "i");

  it("never leaves a lone word on the last line of a sentence (01: \"us.\")", () => {
    const lines = texts("In ten minutes: the words, how I work, and what it changes for us.");
    expect(lines.at(-1)).not.toBe("us.");
    expect(lines.at(-1)!.split(" ").length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("In ten minutes: the words, how I work, and what it changes for us.");
  });

  it("balances the last two lines, or absorbs a lone word up to the 54-character cap", () => {
    // Greedy gave "An L L M agent runs tools in a loop to achieve a" / "goal.".
    const bal = texts("An L L M agent runs tools in a loop to achieve a goal.");
    expect(bal).toHaveLength(2);
    for (const l of bal) expect(l.split(" ").length).toBeGreaterThan(1);
    // Two words that cannot be split below the cap: the second is absorbed (45 + 1 + 4 = 50 characters).
    const long = "x".repeat(45);
    expect(captionLines([w(long, 0, 1), w("bye.", 1.1, 1.3)], 5).map((l) => l.text)).toEqual([`${long} bye.`]);
    // Past the absorb cap the lone word stays on its own line.
    const longer = "y".repeat(50);
    expect(captionLines([w(longer, 0, 1), w("bye.", 1.1, 1.3)], 5).map((l) => l.text)).toEqual([longer, "bye."]);
  });

  it("no line exceeds the cap on the talk's real sentences", () => {
    for (const s of [
      "Then orchestrator and workers, and evaluator and optimizer.",
      "So a new file, or a dependency change, asks me first.",
      "Simon Willison says AI tools amplify existing expertise.",
      "My rule: every run-until-done loop carries a wall clock cap, a receipt per tick, and an explicit stop reason.",
    ]) {
      for (const l of texts(s)) expect(l.length).toBeLessThanOrEqual(CAPTION_MAX_CHARS);
    }
  });

  it("joins a short fragment like \"My rule:\", keeps \"wall clock cap\" whole and prefers clause breaks (03)", () => {
    expect(texts("My rule: every run-until-done loop carries a wall clock cap, a receipt per tick, and an explicit stop reason.")).toEqual([
      "My rule: every run-until-done loop carries",
      "a wall clock cap, a receipt per tick,",
      "and an explicit stop reason.",
    ]);
  });

  it("never ends a line on a function word (03: \"toward a\")", () => {
    for (const s of [
      "Slash goal keeps Claude working toward a condition, and a fresh model, not the one doing the work, decides when it's met.",
      "My rule: every run-until-done loop carries a wall clock cap, a receipt per tick, and an explicit stop reason.",
      "In ten minutes: the words, how I work, and what it changes for us.",
    ]) {
      const lines = texts(s);
      for (const l of lines.slice(0, -1)) expect(l).not.toMatch(FUNCTION_END);
      expect(lines.join(" ")).toBe(s);
    }
  });

  it("never ends a line on this, its, that, while, what, it (04-08 review)", () => {
    for (const [s, bad] of [
      ["Anthropic's research system works this way, with a lead agent delegating to subagents in parallel.", "works this"],
      ["Its central bet: a rule the model can reason its way around is not a rule.", "reason its"],
      ["A second AI, given only that doc, found that nobody owned the timeline.", "found that"],
      ["Anthropic's Justin Young found that a long-running agent tended to try to do too much at once.", "found that"],
      ["And across tools, one side implements while a fresh context on the other, Claude or Codex, reviews the real diff.", "implements while"],
      ["That's the whole path, and you're watching what came out of it.", "and you're watching what"],
      ["Boris Cherny, who created Claude Code, calls it probably the most important thing.", "calls it"],
    ] as const) {
      const lines = texts(s);
      for (const l of lines.slice(0, -1)) {
        expect(l.endsWith(bad)).toBe(false);
        expect(l).not.toMatch(FUNCTION_END);
      }
      expect(lines.join(" ")).toBe(s);
    }
  });

  it("never splits a hyphenated compound across lines (06: \"human-owned\")", () => {
    const s = "The spec, user challenge decisions, and human-owned boundaries like merge, tag and publish.";
    const lines = texts(s);
    expect(lines.some((l) => l.split(" ").includes("human-owned"))).toBe(true);
    expect(lines.join(" ")).toBe(s);
    // A compound the script writes across words ("human- owned") still never breaks at its hyphen.
    const split = texts("The spec, user challenge decisions, and very human- owned boundaries like merge, tag and publish.");
    for (const l of split.slice(0, -1)) expect(l).not.toMatch(/-$/);
    for (const l of split.slice(1)) expect(l).not.toMatch(/^-/);
    expect(split.some((l) => l.includes("human- owned"))).toBe(true);
  });

  it("still breaks after . ? ! and fades a line out before the next one shows (03 at 65.30 s)", () => {
    const lines = captionLines(said("Next, agent. Anthropic draws a clean line. My rule: every run-until-done loop carries a wall clock cap, a receipt per tick, and an explicit stop reason.", 60), 1000);
    expect(lines.slice(0, 2).map((l) => l.text)).toEqual(["Next, agent.", "Anthropic draws a clean line."]);
    for (let j = 0; j + 1 < lines.length; j++) expect(lines[j]!.hide + 0.08).toBeLessThanOrEqual(lines[j + 1]!.show + 1e-9);
  });
});

describe("composeChapter writes a self-contained project", () => {
  it("copies fonts, gsap, mermaid, the narration and writes index.html + timeline.js", () => {
    const dir = makeTalk({
      "sources.json": JSON.stringify({ sources: [SURVEY] }),
      "script/en/02-verification.md": WORKED_SCRIPT,
      "scenes/02-verification.html": WORKED_SCENE,
      "captions/en/02.json": JSON.stringify(workedCaptions()),
    });
    const talk = loadTalk(dir);
    const wav = paths.narrationWav(talk, "en", "02");
    mkdirSync(dirname(wav), { recursive: true });
    writeWav(wav, WORKED_AUDIO);
    const ch = listChapters(talk, "en")[0]!;
    const r = composeChapter(talk, ch);
    expect(r.duration).toBeCloseTo(20.3, 6);
    const b = join(dir, "build", "en", "02");
    for (const f of [
      "index.html",
      "timeline.js",
      "theme.css",
      "mermaid.mjs",
      "vendor/gsap.min.js",
      "vendor/mermaid.min.js",
      "assets/narration.wav",
      "fonts/inter-latin-400-normal.woff2",
      "fonts/inter-latin-ext-800-normal.woff2",
      "fonts/jetbrains-mono-latin-600-normal.woff2",
      "fonts/jetbrains-mono-latin-ext-400-normal.woff2",
    ]) {
      expect([f, existsSync(join(b, f))]).toEqual([f, true]);
    }
    const css = readFileSync(join(b, "theme.css"), "utf8");
    for (const m of css.matchAll(/url\("([^"]+)"\)/g)) expect(existsSync(join(b, m[1]!))).toBe(true);
    writeFileSync(join(dir, "scenes", "02-verification.html"), WORKED_SCENE.replace(' data-source="s:example-survey"', ""));
    expect(() => composeChapter(talk, ch)).toThrow(/E_SOURCE_MISSING/);
  });
});
