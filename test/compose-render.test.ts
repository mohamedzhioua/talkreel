import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { framePoints } from "../src/commands/frames.js";
import { qualityMixProblem, staleRenders } from "../src/commands/render.js";
import { statusReport } from "../src/commands/status.js";
import { buildPaths } from "../src/compose.js";
import { checkArgs, isProcessCrash, renderArgs, renderWorkers, retryOnCrash } from "../src/compose-hyperframes.js";
import { chapterOffsets, chaptersTxt, concatList, concatListLine, outPaths, transcriptMd, youtubeTime } from "../src/compose-concat.js";
import { currentConcatHash, currentRenderHash } from "../src/stages.js";
import { emptyState } from "../src/schema.js";
import { chapterKey, recordStage, writeState } from "../src/state.js";
import { listChapters, loadTalk, paths } from "../src/talk.js";
import { writeWav } from "./compose-fixtures.js";
import { makeTalk } from "./helpers.js";

describe("chapters.txt", () => {
  it("formats YouTube timestamps, including past 10 minutes and past an hour", () => {
    expect([0, 9.99, 65, 600, 754.4, 3599, 3600, 3725].map(youtubeTime)).toEqual(["00:00", "00:09", "01:05", "10:00", "12:34", "59:59", "1:00:00", "1:02:05"]);
  });

  it("lists cumulative chapter starts with titles", () => {
    const chapters = [
      { title: "Hook", duration: 95.4 },
      { title: "Why verify", duration: 300.2 },
      { title: "The loop", duration: 260 },
      { title: "Wrap-up", duration: 30 },
    ];
    expect(chapterOffsets(chapters).map((t) => Math.round(t * 10) / 10)).toEqual([0, 95.4, 395.6, 655.6]);
    expect(chaptersTxt(chapters)).toBe("00:00 Hook\n01:35 Why verify\n06:35 The loop\n10:55 Wrap-up\n");
  });

  it("transcript has one section per chapter with its start time", () => {
    const md = transcriptMd("My talk", [
      { title: "One", duration: 61, text: "First words." },
      { title: "Two", duration: 5, text: "Second.\n\nThird." },
    ]);
    expect(md).toBe("# My talk\n\n## One (00:00)\n\nFirst words.\n\n## Two (01:01)\n\nSecond.\n\nThird.\n");
  });
});

describe("concat list", () => {
  it("one file line per chapter, forward slashes, quotes escaped for the demuxer", () => {
    expect(concatListLine("C:\\talks\\x\\build\\en\\01\\chapter.mp4")).toBe("file 'C:/talks/x/build/en/01/chapter.mp4'");
    expect(concatListLine("/tmp/it's/a.mp4")).toBe("file '/tmp/it'\\''s/a.mp4'");
    expect(concatList(["/a/01.mp4", "/a/02.mp4"])).toBe("ffconcat version 1.0\nfile '/a/01.mp4'\nfile '/a/02.mp4'\n");
  });

  it("first language keeps the plain out/ names; others get a suffix", () => {
    const talk = loadTalk(makeTalk({}, { languages: ["en", "fr"] }));
    expect(outPaths(talk, "en").chapters.replace(/\\/g, "/")).toMatch(/\/out\/chapters\.txt$/);
    expect(outPaths(talk, "fr").transcript.replace(/\\/g, "/")).toMatch(/\/out\/transcript-fr\.md$/);
    expect(outPaths(talk, "fr").video.replace(/\\/g, "/")).toMatch(/\/out\/demo-fr\.mp4$/);
  });

  it("refuses a mix of draft and standard renders", () => {
    expect(qualityMixProblem(new Map([["01", "draft"], ["02", "draft"]]))).toBeNull();
    expect(qualityMixProblem(new Map([["01", "draft"], ["02", "standard"]]))).toMatch(/refusing to join draft and standard renders \(01 draft, 02 standard\)/);
  });
});

function put(p: string, content: string | Buffer) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

describe("stale-chapter selection", () => {
  async function renderedTalk() {
    const caps = (words: string[]) => JSON.stringify({ lang: "en", words: words.map((text, k) => ({ text, start: k * 0.4, end: k * 0.4 + 0.3, matched: true })) });
    const dir = makeTalk({
      "sources.json": JSON.stringify({ sources: [] }),
      "script/en/01-a.md": "# A\n\nHello {#b}there.\n",
      "script/en/02-b.md": "# B\n\nGood {#c}bye.\n",
      "scenes/01-a.html": `<section data-beat="x"><p>Hi</p></section><section data-beat="y" data-cue="b"><p>There</p></section>`,
      "scenes/02-b.html": `<section data-beat="x"><p>Good</p></section><section data-beat="y" data-cue="c"><p>Bye</p></section>`,
      "captions/en/01.json": caps(["Hello", "there."]),
      "captions/en/02.json": caps(["Good", "bye."]),
    });
    const talk = loadTalk(dir);
    const state = emptyState();
    const chapters = listChapters(talk, "en");
    for (const ch of chapters) {
      const wav = paths.narrationWav(talk, "en", ch.chapter);
      mkdirSync(dirname(wav), { recursive: true });
      writeWav(wav, 1);
      // Pretend the chapter was rendered at draft quality.
      put(buildPaths.mp4(talk, "en", ch.chapter), `mp4 ${ch.chapter}`);
      put(buildPaths.renderInfo(talk, "en", ch.chapter), JSON.stringify({ quality: "draft" }));
      recordStage(state, "render", chapterKey("en", ch.chapter), (await currentRenderHash(talk, ch, "draft"))!);
    }
    return { dir, talk, state, chapters };
  }

  it("nothing is stale right after a render; a quality change makes every chapter stale", async () => {
    const { talk, state, chapters } = await renderedTalk();
    expect(await staleRenders(talk, state, chapters, "draft")).toEqual([]);
    expect(await staleRenders(talk, state, chapters)).toEqual([]);
    expect((await staleRenders(talk, state, chapters, "standard")).map((s) => s.ch.chapter)).toEqual(["01", "02"]);
  });

  it("editing one scene, moving one cue, or changing one WAV re-renders only that chapter", async () => {
    const { dir, talk, state, chapters } = await renderedTalk();
    put(`${dir}/scenes/02-b.html`, `<section data-beat="x"><p>Good!</p></section><section data-beat="y" data-cue="c"><p>Bye</p></section>`);
    let stale = await staleRenders(talk, state, chapters, "draft");
    expect(stale.map((s) => [s.ch.chapter, s.reason])).toEqual([["02", "inputs changed"]]);

    const fresh = await renderedTalk();
    put(`${fresh.dir}/script/en/01-a.md`, "# A\n\n{#b}Hello there.\n"); // same words, cue moved
    stale = await staleRenders(fresh.talk, fresh.state, fresh.chapters, "draft");
    expect(stale.map((s) => s.ch.chapter)).toEqual(["01"]);

    const third = await renderedTalk();
    writeWav(paths.narrationWav(third.talk, "en", "02"), 1.5);
    expect((await staleRenders(third.talk, third.state, third.chapters, "draft")).map((s) => s.ch.chapter)).toEqual(["02"]);
  });

  it("toggling talk.json ambient makes every chapter stale", async () => {
    const { talk, state, chapters } = await renderedTalk();
    const before = await currentRenderHash(talk, chapters[0]!, "draft");
    talk.config.ambient = true;
    expect(await currentRenderHash(talk, chapters[0]!, "draft")).not.toBe(before);
    expect((await staleRenders(talk, state, chapters, "draft")).map((s) => s.ch.chapter)).toEqual(["01", "02"]);
  });

  it("a missing MP4 is stale; missing inputs give a null hash", async () => {
    const { dir, talk, state, chapters } = await renderedTalk();
    const { rmSync } = await import("node:fs");
    rmSync(buildPaths.mp4(talk, "en", "01"));
    const stale = await staleRenders(talk, state, chapters, "draft");
    expect(stale.map((s) => s.ch.chapter)).toEqual(["01"]);
    expect(stale[0]!.reason).toMatch(/output missing/);
    rmSync(`${dir}/scenes/02-b.html`);
    expect(await currentRenderHash(talk, chapters[1]!, "draft")).toBeNull();
  });

  it("the concat hash follows the ordered chapter MP4s", async () => {
    const { talk } = await renderedTalk();
    const h1 = await currentConcatHash(talk, "en");
    expect(h1).not.toBeNull();
    put(buildPaths.mp4(talk, "en", "02"), "mp4 02 re-rendered");
    expect(await currentConcatHash(talk, "en")).not.toBe(h1);
  });

  it("status reports concat stale when out/<slug>-<lang>.mp4 is missing", async () => {
    const { talk, state } = await renderedTalk();
    const out = outPaths(talk, "en");
    put(out.chapters, "00:00 A\n");
    put(out.transcript, "# t\n");
    recordStage(state, "concat", "en", (await currentConcatHash(talk, "en"))!);
    writeState(paths.state(talk), state);
    const missing = (await statusReport(talk)).concat.en!;
    expect(missing.status).toBe("stale");
    expect(missing.reason).toMatch(/output missing: .*\.mp4$/);
    put(out.video, "joined");
    // With the video back, concat is no longer stale for a missing output.
    expect((await statusReport(talk)).concat.en!.reason ?? "").not.toMatch(/output missing/);
  });
});

describe("hyperframes arguments", () => {
  it("check covers the whole chapter through --range, floored to the millisecond (HyperFrames rejects an end past its duration)", () => {
    expect(checkArgs("/b", 66.1113333)).toEqual(["check", "/b", "--range", "0,66.111"]);
    expect(checkArgs("/b", 12)).toEqual(["check", "/b", "--range", "0,12"]);
  });

  it("render passes an explicit worker count so HyperFrames skips calibration", () => {
    expect(renderArgs("/b", "/b/c.mp4", 30, "draft", 3)).toEqual(["render", "/b", "--output", "/b/c.mp4", "--fps", "30", "--resolution", "landscape", "--quality", "draft", "--workers", "3"]);
    expect([1, 2, 4, 8, 12, 16, 64].map(renderWorkers)).toEqual([1, 1, 1, 3, 4, 4, 4]);
  });

  it("uses software raster only when requested for a device chapter", () => {
    for (const resolution of ["landscape", "portrait", "square"] as const) {
      for (const workers of [1, 4]) {
        expect(renderArgs("/b", "/b/c.mp4", 30, "standard", workers, resolution, true)).toContain("--no-browser-gpu");
        expect(renderArgs("/b", "/b/c.mp4", 30, "standard", workers, resolution, false)).not.toContain("--no-browser-gpu");
        expect(renderArgs("/b", "/b/c.mp4", 30, "standard", workers, resolution)).not.toContain("--no-browser-gpu");
      }
    }
  });
});

describe("crash retry", () => {
  it("treats Windows exception codes as crashes, ordinary failures as failures", () => {
    expect(isProcessCrash(3221226505)).toBe(true); // 0xC0000409
    expect([0, 1, 2, 3, 127, 255].some(isProcessCrash)).toBe(false);
  });

  it("retries a crash exactly once and never retries an ordinary failure", async () => {
    const results = [{ code: 3221226505, stdout: "", stderr: "" }, { code: 0, stdout: "ok", stderr: "" }];
    let calls = 0;
    const retried: number[] = [];
    const ok = await retryOnCrash(async () => results[calls++]!, (c) => retried.push(c));
    expect([ok.code, calls, retried]).toEqual([0, 2, [3221226505]]);

    calls = 0;
    const fail = await retryOnCrash(async () => (calls++, { code: 1, stdout: "", stderr: "" }), () => retried.push(-1));
    expect([fail.code, calls, retried.length]).toEqual([1, 1, 1]);
  });
});

describe("frame points", () => {
  it("start + 0.5, each cue + 0.9 in time order, end - 0.5, de-duplicated", () => {
    expect(framePoints({ b: 4, a: 2, same: 2.02 }, 10)).toEqual([
      { label: "start", time: 0.5 },
      { label: "a", time: 2.9 },
      { label: "b", time: 4.9 },
      { label: "end", time: 9.5 },
    ]);
    expect(framePoints({ late: 9.8 }, 10).map((p) => p.time)).toEqual([0.5, 9.5, 9.95]);
  });

  it("adds a transition frame 0.15 s into every beat change, none for the first beat", () => {
    const beats = [{ id: "open", start: 0 }, { id: "two", start: 2 }, { id: "three", start: 4 }];
    expect(framePoints({ b: 4, a: 2 }, 10, beats)).toEqual([
      { label: "start", time: 0.5 },
      { label: "transition-two", time: 2.15 },
      { label: "a", time: 2.9 },
      { label: "transition-three", time: 4.15 },
      { label: "b", time: 4.9 },
      { label: "end", time: 9.5 },
    ]);
  });
});
