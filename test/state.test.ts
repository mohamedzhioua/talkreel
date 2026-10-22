import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterStatus } from "../src/stages.js";
import { currentAlignHash, currentVoiceHash } from "../src/stages.js";
import { parseScriptFile } from "../src/script.js";
import { alignInputHash, chapterKey, concatInputHash, readState, recordStage, renderInputHash, stageStatus, voiceInputHash, writeState } from "../src/state.js";
import { emptyState } from "../src/schema.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { makeTalk } from "./helpers.js";

function touch(p: string, content = "x") {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

describe("stage hashes", () => {
  it("voice hash depends on spoken text, voice and engine only", () => {
    const a = voiceInputHash({ mode: "ai", spokenHash: "s1", voice: "af_heart", engine: "e" });
    expect(voiceInputHash({ mode: "ai", spokenHash: "s1", voice: "af_heart", engine: "e" })).toBe(a);
    expect(voiceInputHash({ mode: "ai", spokenHash: "s2", voice: "af_heart", engine: "e" })).not.toBe(a);
    expect(voiceInputHash({ mode: "ai", spokenHash: "s1", voice: "am_adam", engine: "e" })).not.toBe(a);
    expect(voiceInputHash({ mode: "ai", spokenHash: "s1", voice: "af_heart", engine: "e2" })).not.toBe(a);
  });

  it("align, render and concat hashes change with each input", () => {
    const al = { wavHash: "w", spokenHash: "s", model: "small" };
    expect(alignInputHash({ ...al, model: "base" })).not.toBe(alignInputHash(al));
    const r = { sceneHash: "a", captionsHash: "b", wavHash: "c", themeHash: "d", hyperframesVersion: "0.8.185", composeVersion: "1", quality: "standard" };
    expect(renderInputHash({ ...r, quality: "draft" })).not.toBe(renderInputHash(r));
    expect(concatInputHash(["a", "b"])).not.toBe(concatInputHash(["b", "a"]));
  });
});

describe("stageStatus", () => {
  it("is stale when never run, changed, or output missing; fresh otherwise", () => {
    const dir = makeTalk({});
    const out = join(dir, "out.wav");
    const s = emptyState();
    expect(stageStatus(s, "voice", "en/01", "h", [out])).toEqual({ status: "stale", reason: "never run" });
    recordStage(s, "voice", "en/01", "h");
    expect(stageStatus(s, "voice", "en/01", "h2", [out]).reason).toBe("inputs changed");
    expect(stageStatus(s, "voice", "en/01", "h", [out]).reason).toMatch(/output missing/);
    touch(out);
    expect(stageStatus(s, "voice", "en/01", "h", [out])).toEqual({ status: "fresh" });
    expect(stageStatus(s, "voice", "en/01", null).reason).toBe("inputs missing");
  });

  it("round-trips through talk.state.json and tolerates a corrupt file", () => {
    const dir = makeTalk({});
    const file = join(dir, "talk.state.json");
    const s = emptyState();
    recordStage(s, "align", "en/02", "abc", new Date("2026-10-21T00:00:00Z"));
    writeState(file, s);
    expect(readState(file).stages.align["en/02"]).toEqual({ hash: "abc", updated: "2026-10-21T00:00:00.000Z" });
    writeFileSync(file, "{not json");
    expect(readState(file)).toEqual(emptyState());
  });
});

describe("chapter staleness", () => {
  it("editing the spoken text makes voice and align stale; editing a citation does not", async () => {
    const dir = makeTalk({ "script/en/01-intro.md": "# Intro\n\nHello world [s:a].\n" });
    const talk = loadTalk(dir);
    const ch = listChapters(talk, "en")[0]!;
    const key = chapterKey("en", "01");
    const state = emptyState();

    // Pretend voice and align ran.
    touch(paths.sourceWav(talk, "en", "01"));
    touch(paths.narrationWav(talk, "en", "01"));
    touch(paths.captions(talk, "en", "01"), "{}");
    let parsed = parseScriptFile(ch.file);
    recordStage(state, "voice", key, (await currentVoiceHash(talk, ch, parsed))!);
    recordStage(state, "align", key, (await currentAlignHash(talk, ch, parsed))!);
    let st = await chapterStatus(talk, state, ch);
    expect([st.voice.status, st.align.status]).toEqual(["fresh", "fresh"]);
    expect(st.render.status).toBe("stale");

    writeFileSync(ch.file, "# Intro\n\nHello world [s:b] {#cue}.\n");
    st = await chapterStatus(talk, state, ch);
    expect([st.voice.status, st.align.status]).toEqual(["fresh", "fresh"]);

    writeFileSync(ch.file, "# Intro\n\nHello there world.\n");
    st = await chapterStatus(talk, state, ch);
    expect(st.voice).toEqual({ status: "stale", reason: "inputs changed" });
    expect(st.align.status).toBe("stale");

    parsed = parseScriptFile(ch.file);
    recordStage(state, "voice", key, (await currentVoiceHash(talk, ch, parsed))!);
    recordStage(state, "align", key, (await currentAlignHash(talk, ch, parsed))!);
    st = await chapterStatus(talk, state, ch);
    expect([st.voice.status, st.align.status]).toEqual(["fresh", "fresh"]);
  });

  it("own-voice mode: the supplied WAV is the root input", async () => {
    const dir = makeTalk({ "script/en/01-intro.md": "# Intro\n\nHello world.\n" }, { voice: { mode: "own", en: "af_heart" } });
    const talk = loadTalk(dir);
    const ch = listChapters(talk, "en")[0]!;
    const parsed = parseScriptFile(ch.file);
    expect(await currentVoiceHash(talk, ch, parsed)).toBeNull();
    touch(paths.sourceWav(talk, "en", "01"), "take 1");
    const h1 = await currentVoiceHash(talk, ch, parsed);
    touch(paths.sourceWav(talk, "en", "01"), "take 2");
    expect(await currentVoiceHash(talk, ch, parsed)).not.toBe(h1);
  });
});
