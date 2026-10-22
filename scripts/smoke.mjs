#!/usr/bin/env node
// Local end-to-end smoke test (never in CI): a 2-chapter talk under .spike/smoke/talk built from
// the default theme's example scenes, through voice, align, render --quality draft, ffprobe and
// frames. Needs FFmpeg, uv and the models (see `talkreel doctor`). Exits non-zero on failure.
//
//   npm run smoke              reuse what is fresh (only stale stages run)
//   npm run smoke -- --clean   start from an empty talk folder
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findTool } from "../dist/ffmpeg.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TALK = join(ROOT, ".spike", "smoke", "talk");
const CLI = join(ROOT, "dist", "cli.js");
const EXAMPLES = join(ROOT, "themes", "default", "examples");

function fail(msg) {
  console.error(`\nSMOKE FAILED: ${msg}`);
  process.exit(1);
}

function step(name) {
  console.log(`\n=== ${name}`);
}

/** Write a file only when its content changed, so a re-run keeps fresh stages fresh. */
function put(rel, content) {
  const p = join(TALK, rel);
  if (existsSync(p) && readFileSync(p, "utf8") === content) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function example(name) {
  return readFileSync(join(EXAMPLES, `${name}.html`), "utf8").replace(/\r\n/g, "\n");
}

function cli(args, { capture = false, dir = TALK } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args, "--talk", dir], {
    stdio: capture ? ["ignore", "pipe", "inherit"] : ["ignore", "inherit", "inherit"],
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? "" };
}

if (!existsSync(CLI)) fail(`${CLI} is missing; run "npm run build"`);
if (process.argv.includes("--clean")) rmSync(TALK, { recursive: true, force: true });

step("fixture talk");
put("talk.json", JSON.stringify({ slug: "smoke", title: "talkreel smoke test", languages: ["en"], voice: { mode: "ai", en: "af_heart", fr: "ff_siwis" }, theme: "default", fps: 30, resolution: "landscape" }, null, 2) + "\n");
put(
  "sources.json",
  JSON.stringify(
    {
      sources: [
        { id: "example-survey", title: "Placeholder survey (smoke fixture)", publisher: "Example", url: "https://www.example.org/survey", quote: "84% of respondents use or plan to use AI tools in their work.", date: "2025-07-01" },
        { id: "fowler-context", title: "Placeholder article (smoke fixture)", publisher: "Example", url: "https://example.org/context", quote: "Deciding what an AI model sees before it answers.", date: "2025-02-01" },
      ],
    },
    null,
    2,
  ) + "\n",
);
put(
  "script/en/01-intro.md",
  "# Why verify\n\nYour AI assistant writes the code in minutes. But who checks it?\n\n{#promise}This talk shows how I work, from the spec to a verified diff. {#stat}Most developers already use AI tools at work. [s:example-survey]\n",
);
put(
  "script/en/02-pipeline.md",
  "# The pipeline\n\nChapter two is the pipeline. {#pipeline}One chapter runs end to end. The script comes first, {#voice}then the voice, {#align}then the alignment, {#render}then the render and the review.\n\n{#define}Context engineering decides what the model sees. [s:fowler-context]\n",
);
put("scenes/01-intro.html", example("title") + "\n" + example("stat"));
put("scenes/02-pipeline.html", example("chapter-card").replace(">03<", ">02<").replace("Verification beats vibes", "The pipeline") + "\n" + example("diagram") + "\n" + example("definition"));
console.log(TALK);

step("check");
if (cli(["check"]).code !== 0) fail("talkreel check failed on the fixture");

step("check rejects a stat block without data-source");
{
  const bad = mkdtempSync(join(tmpdir(), "talkreel-smoke-bad-"));
  cpSync(join(TALK, "talk.json"), join(bad, "talk.json"));
  cpSync(join(TALK, "sources.json"), join(bad, "sources.json"));
  cpSync(join(TALK, "script"), join(bad, "script"), { recursive: true });
  mkdirSync(join(bad, "scenes"));
  writeFileSync(join(bad, "scenes", "01-intro.html"), example("title") + "\n" + example("stat").replace(' data-source="s:example-survey"', ""));
  const r = cli(["check"], { dir: bad, capture: true });
  rmSync(bad, { recursive: true, force: true });
  if (r.code === 0) fail("check passed a stat block without data-source");
  console.log(`check exited ${r.code} as expected`);
}

for (const [name, args] of [
  ["voice", ["voice"]],
  ["align", ["align"]],
  ["render --quality draft", ["render", "--quality", "draft"]],
]) {
  step(name);
  const t0 = Date.now();
  if (cli(args).code !== 0) fail(`talkreel ${name} failed`);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

step("ffprobe");
const ffprobe = findTool("ffprobe");
if (!ffprobe) fail("ffprobe not found");
function probe(file) {
  const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name", "-of", "json", file], { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) fail(`ffprobe failed on ${file}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
const out = join(TALK, "out", "smoke-en.mp4");
if (!existsSync(out)) fail(`${out} was not written`);
const whole = probe(out);
const chapters = ["01", "02"].map((nn) => Number(probe(join(TALK, "build", "en", nn, "chapter.mp4")).format.duration));
const total = Number(whole.format.duration);
const sum = chapters.reduce((a, b) => a + b, 0);
const codecs = whole.streams.map((s) => `${s.codec_type}:${s.codec_name}`);
console.log(`chapters ${chapters.map((d) => d.toFixed(3)).join(" + ")} = ${sum.toFixed(3)} s; joined ${total.toFixed(3)} s; streams ${codecs.join(", ")}`);
if (Math.abs(total - sum) > 0.25) fail(`joined duration ${total} differs from the chapter sum ${sum} by more than 0.25 s`);
if (!codecs.includes("video:h264")) fail("no h264 video stream");
if (!codecs.includes("audio:aac")) fail("no aac audio stream");
for (const f of ["chapters.txt", "transcript.md"]) if (!existsSync(join(TALK, "out", f))) fail(`out/${f} was not written`);
console.log(readFileSync(join(TALK, "out", "chapters.txt"), "utf8").trim());

step("frames");
const fr = cli(["frames"], { capture: true });
if (fr.code !== 0) fail("talkreel frames failed");
const frames = JSON.parse(fr.stdout).frames;
if (!frames.length) fail("no frames extracted");
for (const f of frames) if (!existsSync(f.path)) fail(`missing frame ${f.path}`);
console.log(`${frames.length} frames:`);
for (const f of frames) console.log(`  ${f.chapter} ${String(f.time).padStart(7)} ${f.beat ?? "?"} ${f.label} ${f.path}`);

step("status");
cli(["status"]);
console.log("\nSMOKE OK");
