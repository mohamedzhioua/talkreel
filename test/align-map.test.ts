import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alignWords, AlignError, buildCaptions, cardinal, tokenForms } from "../src/align-map.js";
import type { WhisperResult, WhisperWord } from "../src/schema.js";

const FIX = join(import.meta.dirname, "fixtures");
const recorded = JSON.parse(readFileSync(join(FIX, "whisper-spike-en.json"), "utf8")) as WhisperResult;
const scriptWords = readFileSync(join(FIX, "script-spike-en.txt"), "utf8").trim().split(/\s+/);

/** Evenly timed fake Whisper words, 0.4 s each. */
function heard(text: string, step = 0.4): WhisperWord[] {
  return text.split(/\s+/).map((word, i) => ({ word, start: i * step, end: i * step + step * 0.9 }));
}

describe("alignWords on recorded whisper output", () => {
  it("matches every word of the spike recording and keeps script spelling", () => {
    const r = alignWords(scriptWords, recorded.words, { duration: recorded.duration });
    expect(r.total).toBe(54);
    expect(r.matched).toBe(54);
    expect(r.words.map((w) => w.text)).toEqual(scriptWords);
    expect(r.words[0]).toMatchObject({ text: "Software", start: 0, end: 0.38, matched: true });
  });

  it("drops extra whisper words (insertions)", () => {
    const words = [...recorded.words];
    words.splice(5, 0, { word: "um", start: 1.9, end: 2.0 }, { word: "uh", start: 2.0, end: 2.05 });
    const r = alignWords(scriptWords, words);
    expect(r.matched).toBe(54);
    expect(r.words[5]).toMatchObject({ text: "changing", start: 2.06, end: 2.46 });
  });

  it("interpolates script words whisper missed (deletions)", () => {
    // Remove "how teams" (indices 6, 7): neighbours are "changing" (ends 2.46) and "design," (starts 3.16).
    const words = recorded.words.filter((_, i) => i !== 6 && i !== 7);
    const r = alignWords(scriptWords, words);
    expect(r.matched).toBe(52);
    const how = r.words[6]!;
    const teams = r.words[7]!;
    expect(how).toMatchObject({ text: "how", matched: false });
    expect(teams).toMatchObject({ text: "teams", matched: false });
    expect(how.start).toBeCloseTo(2.46, 3);
    expect(teams.end).toBeCloseTo(3.16, 3);
    expect(how.end).toBeLessThanOrEqual(teams.start + 1e-9);
  });

  it("keeps the script spelling and whisper timing for a misheard term", () => {
    const script = "We voice every chapter with Kokoro on the CPU".split(" ");
    const r = alignWords(script, heard("We voice every chapter with cocoa on the CPU"));
    const k = r.words[5]!;
    expect(k.text).toBe("Kokoro");
    expect(k.matched).toBe(false);
    expect(k.start).toBeCloseTo(2.0, 5);
    expect(r.matched).toBe(8);
  });
});

describe("many-to-one matches", () => {
  it('maps whisper "twenty twenty-six" onto script "2026"', () => {
    const r = alignWords("In 2026, agents ship code".split(" "), heard("In twenty twenty-six, agents ship code"));
    expect(r.matched).toBe(5);
    expect(r.words[1]).toMatchObject({ text: "2026,", start: 0.4, matched: true });
    expect(r.words[1]!.end).toBeCloseTo(0.8 + 0.36, 5);
    expect(r.words[2]!.start).toBeCloseTo(1.2, 5);
  });

  it('maps whisper "2026" onto script "twenty twenty-six"', () => {
    const r = alignWords("In twenty twenty-six, agents ship code".split(" "), heard("In 2026 agents ship code"));
    expect(r.matched).toBe(6);
    expect(r.words.map((w) => w.text)).toEqual(["In", "twenty", "twenty-six,", "agents", "ship", "code"]);
    expect(r.words[1]!.start).toBeCloseTo(0.4, 5);
    expect(r.words[2]!.end).toBeCloseTo(0.76, 5);
    expect(r.words[1]!.end).toBeLessThanOrEqual(r.words[2]!.start + 1e-9);
  });

  it("matches acronyms spelled out and identifiers read aloud", () => {
    const r = alignWords("The LLM reads talk.json first".split(" "), heard("The L L M reads talk dot json first"));
    expect(r.matched).toBe(5);
    expect(r.words[1]).toMatchObject({ text: "LLM", start: 0.4, matched: true });
    expect(r.words[3]).toMatchObject({ text: "talk.json", start: 2.0, matched: true });
  });

  it("matches percentages and hyphen splits", () => {
    const r = alignWords("About 80% of state-of-the-art teams".split(" "), heard("About eighty percent of state of the art teams"));
    expect(r.matched).toBe(5);
  });

  it("produces spoken forms for numbers", () => {
    expect(cardinal(2026)).toBe("two thousand twenty six");
    expect(cardinal(115, true)).toBe("one hundred and fifteen");
    expect(tokenForms("2026")).toContain("twentytwentysix");
    expect(tokenForms("1,500")).toContain("onethousandfivehundred");
    expect(tokenForms("3.5")).toContain("threepointfive");
  });
});

describe("buildCaptions", () => {
  it("returns {lang, words} with one caption word per script word", () => {
    const c = buildCaptions("en", scriptWords, recorded.words, { duration: recorded.duration });
    expect(c.lang).toBe("en");
    expect(c.words).toHaveLength(scriptWords.length);
    for (const w of c.words) expect(Object.keys(w).sort()).toEqual(["end", "matched", "start", "text"]);
  });

  it("fails below 80% matched (a recording that drifts from the script)", () => {
    const drift = heard("Today I want to talk about something else entirely and it has nothing to do with the plan");
    expect(() => buildCaptions("en", scriptWords.slice(0, 18), drift)).toThrow(AlignError);
    try {
      buildCaptions("en", scriptWords.slice(0, 18), drift);
    } catch (e) {
      expect((e as AlignError).ratio).toBeLessThan(0.8);
      expect((e as Error).message).toMatch(/need 80%/);
    }
  });

  it("passes at exactly the threshold and fails just under it", () => {
    const script = "one two three four five six seven eight nine ten".split(" ");
    expect(buildCaptions("en", script, heard("one two three four five six seven eight xx yy")).words).toHaveLength(10);
    expect(() => buildCaptions("en", script, heard("one two three four five six seven xx yy zz"))).toThrow(AlignError);
  });

  it("keeps times monotonic", () => {
    const c = buildCaptions("en", scriptWords, recorded.words);
    for (let i = 1; i < c.words.length; i++) expect(c.words[i]!.start).toBeGreaterThanOrEqual(c.words[i - 1]!.start);
  });
});

describe("recorded Kokoro + whisper chapter", () => {
  it("aligns a real chapter fully and resolves its cues", async () => {
    const { parseScript } = await import("../src/script.js");
    const { resolveCues } = await import("../src/cues.js");
    const ch = parseScript(readFileSync(join(FIX, "script-demo-01.md"), "utf8"));
    const rec = JSON.parse(readFileSync(join(FIX, "whisper-demo-01.json"), "utf8")) as WhisperResult;
    const c = buildCaptions("en", ch.words, rec.words, { duration: rec.duration });
    expect(c.words.every((w) => w.matched)).toBe(true);
    const cues = resolveCues(ch, c);
    expect(cues.hook).toBe(0);
    expect(cues.plan).toBeGreaterThan(5);
    expect(cues.plan).toBeLessThan(rec.duration);
  });
});
