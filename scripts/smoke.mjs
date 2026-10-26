#!/usr/bin/env node
// Local end-to-end smoke test (never in CI): a 2-chapter talk under .spike/smoke/talk built from
// the default theme's example scenes, through voice, align, render --quality draft, ffprobe, a
// music-bed mix measured with ebur128, and frames, then a French portrait reel with mix and
// safe-zone frames. Needs FFmpeg, uv and the models (see
// `talkreel doctor`). Exits non-zero on failure.
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
function put(rel, content, dir = TALK) {
  const p = join(dir, rel);
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
// Without music first (the M2 path: concat writes out/ directly); the music step below adds it.
const CONFIG = { slug: "smoke", title: "talkreel smoke test", languages: ["en"], voice: { mode: "ai", en: "af_heart", fr: "ff_siwis" }, theme: "default", fps: 30, resolution: "landscape" };
put("talk.json", JSON.stringify(CONFIG, null, 2) + "\n");
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
  const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,sample_rate,width,height", "-of", "json", file], { encoding: "utf8", shell: false, windowsHide: true });
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

step("music bed: mix, ducking, loudness");
const ffmpeg = findTool("ffmpeg");
if (!ffmpeg) fail("ffmpeg not found");
const BED = "assets/music/bed.wav";
const bedFile = join(TALK, BED);
if (!existsSync(bedFile)) {
  // 4 s of seeded pink noise over a 220 Hz tone: shorter than the talk, so the mix must loop it.
  mkdirSync(dirname(bedFile), { recursive: true });
  const g = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.3:seed=7:duration=4:sample_rate=44100",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100:duration=4",
    "-filter_complex", "[0:a][1:a]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo",
    "-c:a", "pcm_s16le", bedFile,
  ], { encoding: "utf8", shell: false, windowsHide: true });
  if (g.status !== 0) fail(`could not generate the music bed: ${g.stderr}`);
}
const MUSIC = { file: BED, credit: "Generated pink noise and a 220 Hz tone (smoke fixture)", license: "CC0-1.0" };
put("talk.json", JSON.stringify({ ...CONFIG, music: MUSIC }, null, 2) + "\n");
{
  const t0 = Date.now();
  if (cli(["render", "--quality", "draft"]).code !== 0) fail("talkreel render with music failed");
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
const joined = join(TALK, "build", "en", "concat.mp4");
if (!existsSync(joined)) fail(`${joined} was not written`);
const mixed = probe(out);
const mixedAudio = mixed.streams.find((s) => s.codec_type === "audio");
const mixedTotal = Number(mixed.format.duration);
const joinedTotal = Number(probe(joined).format.duration);
console.log(`mixed ${mixedTotal.toFixed(3)} s (joined ${joinedTotal.toFixed(3)} s); streams ${mixed.streams.map((s) => `${s.codec_type}:${s.codec_name}${s.sample_rate ? `@${s.sample_rate}` : ""}`).join(", ")}`);
if (!mixed.streams.some((s) => s.codec_type === "video" && s.codec_name === "h264")) fail("mixed output has no h264 video stream");
if (mixedAudio?.codec_name !== "aac" || mixedAudio.sample_rate !== "48000") fail("mixed output audio is not AAC at 48 kHz");
if (Math.abs(mixedTotal - joinedTotal) > 0.05) fail(`mixed duration ${mixedTotal} differs from the joined ${joinedTotal} by more than 0.05 s`);
/** MD5 of the video packets only: equal before and after the mix when the stream was copied. */
function videoMd5(file) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-map", "0:v:0", "-c", "copy", "-f", "md5", "-"], { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) fail(`ffmpeg md5 failed on ${file}: ${r.stderr}`);
  return r.stdout.trim();
}
if (videoMd5(joined) !== videoMd5(out)) fail("the mix re-encoded the video stream (expected -c:v copy)");
console.log("video stream copied unchanged");
const credits = join(TALK, "out", "credits.txt");
if (!existsSync(credits)) fail("out/credits.txt was not written");
const creditsText = readFileSync(credits, "utf8");
for (const want of [BED, MUSIC.credit, MUSIC.license, "Kokoro", "Watermark:", "Inter"]) if (!creditsText.includes(want)) fail(`out/credits.txt does not mention "${want}"`);
function checkLoudness(file) {
  const loud = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", shell: false, windowsHide: true });
  if (loud.status !== 0) fail(`ebur128 failed on ${file}: ${loud.stderr}`);
  const integrated = [...loud.stderr.matchAll(/Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/g)].at(-1)?.[1];
  const truePeak = [...loud.stderr.matchAll(/True peak:\s*Peak:\s*(-?[\d.]+) dBFS/g)].at(-1)?.[1];
  if (integrated === undefined) fail(`ebur128 printed no integrated loudness for ${file}:\n${loud.stderr.slice(-800)}`);
  console.log(`ebur128: integrated ${integrated} LUFS, true peak ${truePeak ?? "?"} dBFS (target -14 +/- 1 LUFS)`);
  if (Math.abs(Number(integrated) + 14) > 1) fail(`integrated loudness for ${file}: ${integrated} LUFS is outside -14 +/- 1`);
}
checkLoudness(out);

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

step("portrait reel fixture");
const REEL = join(ROOT, ".spike", "smoke", "reel");
if (process.argv.includes("--clean")) rmSync(REEL, { recursive: true, force: true });
put("talk.json", JSON.stringify({
  slug: "smoke-reel", title: "Un reel en images", languages: ["fr"],
  voice: { mode: "ai", fr: "ff_siwis" }, theme: "default", fps: 30, resolution: "portrait",
  music: { file: BED, credit: "Generated 330 Hz tone (portrait smoke fixture)", license: "CC0-1.0" },
}, null, 2) + "\n", REEL);
put("sources.json", JSON.stringify({ sources: [] }, null, 2) + "\n", REEL);
put("script/fr/01-reel.md", `# Un reel en images

Votre prochain projet mérite mieux qu'une simple image.
{#cover}Avec ce format vertical, chaque détail reste au centre du regard.
{#checks}Voici les trois étapes de notre méthode.
{#image}Choisissez une image claire, {#voice}ajoutez une voix naturelle, {#music}puis une musique discrète.
{#cta}À vous de jouer, créez votre premier reel et partagez votre histoire dès aujourd'hui.
`, REEL);
put("scenes/01-reel.html", `<section data-beat="hook" data-camera="push-in">
  <div data-block="title" data-variant="hook">
    <h1>Votre projet mérite <em>un reel.</em></h1>
  </div>
</section>
<section data-beat="cover" data-cue="cover">
  <figure data-block="figure" data-fit="cover">
    <img src="assets/cover.png" alt="Mire de couleurs générée pour le reel">
    <figcaption>Chaque détail au centre du regard</figcaption>
  </figure>
</section>
<section data-beat="checks" data-cue="checks">
  <div data-block="list">
    <h3 class="heading">Trois étapes</h3>
    <ul>
      <li data-check data-cue="image">Une image claire</li>
      <li data-check data-cue="voice">Une voix naturelle</li>
      <li data-check data-cue="music">Une musique discrète</li>
    </ul>
  </div>
</section>
<section data-beat="cta" data-cue="cta" data-align="center">
  <div data-block="cta">
    <img src="assets/logo.svg" alt="Logo du reel de test">
    <h2>Racontez votre histoire</h2>
    <p class="action">Créez votre premier reel</p>
    <p class="url">example.org</p>
  </div>
</section>
`, REEL);
put("assets/logo.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#55ddaa"/><path d="M46 30 90 60 46 90Z" fill="#102030"/></svg>\n', REEL);
for (const [rel, args] of [
  ["assets/cover.png", ["-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=1", "-frames:v", "1"]],
  [BED, ["-f", "lavfi", "-i", "sine=frequency=330:sample_rate=44100:duration=4", "-ac", "2", "-c:a", "pcm_s16le"]],
]) {
  const file = join(REEL, rel);
  if (existsSync(file)) continue;
  mkdirSync(dirname(file), { recursive: true });
  const generated = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file], { encoding: "utf8", shell: false, windowsHide: true });
  if (generated.status !== 0) fail(`could not generate reel ${rel}: ${generated.stderr}`);
}
console.log(REEL);
for (const [name, args] of [
  ["check", ["check"]],
  ["voice", ["voice"]],
  ["align", ["align"]],
  ["render --quality draft", ["render", "--quality", "draft"]],
]) {
  step(`portrait reel: ${name}`);
  if (cli(args, { dir: REEL }).code !== 0) fail(`portrait reel: talkreel ${name} failed`);
}
step("portrait reel: mixed output loudness");
const reelOut = join(REEL, "out", "smoke-reel-fr.mp4");
const reelJoined = join(REEL, "build", "fr", "concat.mp4");
if (!existsSync(reelJoined)) fail(`${reelJoined} was not written`);
if (!existsSync(reelOut)) fail(`${reelOut} was not written`);
const reelMixed = probe(reelOut);
if (!reelMixed.streams.some((s) => s.codec_type === "video" && s.codec_name === "h264" && s.width === 1080 && s.height === 1920)) fail(`${reelOut} has no 1080x1920 h264 video stream`);
const reelAudio = reelMixed.streams.find((s) => s.codec_type === "audio");
if (reelAudio?.codec_name !== "aac" || reelAudio.sample_rate !== "48000") fail(`${reelOut} audio is not AAC at 48 kHz`);
const reelDuration = Number(reelMixed.format.duration);
console.log(`portrait reel: ${reelDuration.toFixed(3)} s`);
if (reelDuration < 15 || reelDuration > 25) fail(`portrait reel duration ${reelDuration} is outside 15-25 s`);
checkLoudness(reelOut);

step("portrait reel: frames --safe-zones");
const reelFrames = cli(["frames", "--safe-zones"], { dir: REEL, capture: true });
if (reelFrames.code !== 0) fail("portrait reel: talkreel frames --safe-zones failed");
const safeFrames = JSON.parse(reelFrames.stdout).frames;
if (!safeFrames.length) fail("no portrait safe-zone frames extracted");
for (const f of safeFrames) if (!existsSync(f.path)) fail(`missing portrait safe-zone frame ${f.path}`);
console.log(`${safeFrames.length} portrait safe-zone frames`);
console.log("\nSMOKE OK");
