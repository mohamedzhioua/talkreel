import { describe, expect, it } from "vitest";
import { defaultTalkConfig } from "../src/commands/new.js";
import { captionsProblems, emptyState, isCaptionsFile, isTalkConfig, isTalkState, isWhisperResult, sourcesProblems, talkConfigProblems } from "../src/schema.js";

describe("talk.json", () => {
  it("accepts the default config", () => {
    expect(talkConfigProblems(defaultTalkConfig("ai-engineering-today", "AI today"))).toEqual([]);
  });
  it("rejects bad fields", () => {
    const bad = { ...defaultTalkConfig("x", "X"), slug: "Bad Slug", fps: 29.97, voice: { mode: "robot" }, resolution: "4k" };
    const p = talkConfigProblems(bad);
    expect(p.some((m) => m.includes("slug"))).toBe(true);
    expect(p.some((m) => m.includes("fps"))).toBe(true);
    expect(p.some((m) => m.includes("voice.mode"))).toBe(true);
    expect(p.some((m) => m.includes("resolution"))).toBe(true);
    expect(isTalkConfig(null)).toBe(false);
  });
  it("requires a voice id per language in ai mode only", () => {
    const cfg = { ...defaultTalkConfig("x", "X"), languages: ["en", "de"] };
    expect(talkConfigProblems(cfg)).toEqual(["talk.json: voice.de is required in ai mode"]);
    expect(talkConfigProblems({ ...cfg, voice: { mode: "own" } })).toEqual([]);
  });
});

describe("sources.json", () => {
  const ok = { id: "a", title: "t", publisher: "p", url: "https://x", quote: "q", date: "2026-01-01" };
  it("accepts complete entries", () => expect(sourcesProblems({ sources: [ok] })).toEqual([]));
  it("rejects missing fields and duplicate ids", () => {
    expect(sourcesProblems({ sources: [{ ...ok, quote: "" }] })).toEqual(["sources.json: sources[0].quote must be a non-empty string"]);
    expect(sourcesProblems({ sources: [ok, ok] })).toEqual(['sources.json: duplicate id "a"']);
    expect(sourcesProblems([])).toHaveLength(1);
  });
});

describe("captions", () => {
  it("accepts {lang, words:[{text,start,end,matched}]}", () => {
    expect(isCaptionsFile({ lang: "en", words: [{ text: "Hi", start: 0, end: 0.2, matched: true }] })).toBe(true);
  });
  it("rejects bad words", () => {
    expect(captionsProblems({ lang: "en", words: [{ text: "Hi", start: 1, end: 0.5, matched: true }] })).toEqual(["captions: words[0] ends before it starts"]);
    expect(isCaptionsFile({ lang: "en", words: [{ text: "Hi", start: 0, end: 1 }] })).toBe(false);
  });
});

describe("whisper result and state", () => {
  it("validates helper output", () => {
    expect(isWhisperResult({ lang: "en", model: "small", duration: 1, words: [{ word: "Hi", start: 0, end: 0.3, prob: 0.9 }] })).toBe(true);
    expect(isWhisperResult({ lang: "en", model: "small", duration: 1, words: [{ word: "Hi" }] })).toBe(false);
  });
  it("validates talk.state.json", () => {
    expect(isTalkState(emptyState())).toBe(true);
    expect(isTalkState({ version: 1, stages: { voice: { "en/01": { hash: "", updated: "" } } } })).toBe(false);
    expect(isTalkState({ version: 2, stages: {} })).toBe(false);
  });
});
