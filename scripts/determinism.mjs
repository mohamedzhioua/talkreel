#!/usr/bin/env node
// Local only: compare fresh, sequential and shuffled PNG seeks (using software raster for device
// chapters, as renders do), plus decoded frames from HyperFrames --workers 1 and --workers 4.
// Mid-cursor and mid-zoom times are added from the plan.
//
//   node scripts/determinism.mjs <build/<lang>/NN dir> <t1> [t2 ...]
// Theme regression: keep a copy of a composed M2 chapter BEFORE the theme change, compose it
// again AFTER, then render both and compare exactly three extracted PNGs byte for byte:
//   node scripts/determinism.mjs --compare <before dir> <after dir> <t1> <t2> <t3>
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findTool } from "../dist/ffmpeg.js";
import { hyperframesEntry, hyperframesEnv, renderArgs } from "../dist/compose-hyperframes.js";

const args = process.argv.slice(2);
const compare = args[0] === "--compare";
if (compare) args.shift();
const dirArg = args.shift();
const afterArg = compare ? args.shift() : undefined;
const times = args.map(Number);
if (!dirArg || (compare && (!afterArg || times.length !== 3)) || times.some((t) => !Number.isFinite(t) || t < 0)) {
  console.error("usage: node scripts/determinism.mjs <chapter build dir> [seconds ...]\n       node scripts/determinism.mjs --compare <before dir> <after dir> <t1> <t2> <t3>");
  process.exit(2);
}
const dir = resolve(dirArg);
const ffmpeg = findTool("ffmpeg");
if (!ffmpeg) throw new Error("ffmpeg not found");
const out = mkdtempSync(join(tmpdir(), "talkreel-det-"));
const FPS = 30;

function chapterPlan(dir) {
  const source = readFileSync(join(dir, "timeline.js"), "utf8");
  return JSON.parse(source.match(/window\.__trPlan = (.+);\r?\n/)?.[1] ?? "{}");
}
const plan = chapterPlan(dir);
const labels = new Map(times.map((t) => [t, "requested"]));
if (!compare) {
  for (const device of plan.devices ?? []) {
    for (const c of device.clicks) if (c.t > c.start) labels.set((c.start + c.t) / 2, "mid-cursor");
    for (const z of device.zooms) labels.set(z.t + z.d / 2, "mid-zoom");
  }
  times.splice(0, times.length, ...[...labels.keys()].map((t) => Math.round(t * FPS) / FPS));
  for (const [t, label] of [...labels]) labels.set(Math.round(t * FPS) / FPS, label);
}
if (!times.length) throw new Error("provide frame times or a chapter with device click/zoom motion");
const samples = [...new Set(times)].sort((a, b) => a - b);

function render(dir, workers, label) {
  const mp4 = join(out, `${label}.mp4`);
  const resolution = readFileSync(join(dir, "index.html"), "utf8").match(/data-resolution="(landscape|portrait|square)"/)?.[1] ?? "landscape";
  const software = !!chapterPlan(dir).devices?.length;
  const args = [hyperframesEntry(), ...renderArgs(dir, mp4, FPS, "draft", workers, resolution, software)];
  const r = spawnSync(process.execPath, args, { cwd: dir, env: hyperframesEnv(false), stdio: ["ignore", "ignore", "inherit"], windowsHide: true });
  if (r.status !== 0) throw new Error(`render with ${workers} worker(s) failed (exit ${r.status})`);
  return mp4;
}

function frame(mp4, t) {
  const n = Math.round(Number(t) * FPS);
  const png = join(out, `${basename(mp4, ".mp4")}-${n}.png`);
  const r = spawnSync(ffmpeg, ["-loglevel", "error", "-y", "-i", mp4, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", png], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`frame ${n} extraction failed`);
  return readFileSync(png);
}

const a = render(dir, 1, compare ? "before" : "w1");
const b = render(compare ? resolve(afterArg) : dir, compare ? 1 : 4, compare ? "after" : "w4");
let bad = 0;
for (const t of samples) {
  const [pa, pb] = [frame(a, t), frame(b, t)];
  const [ha, hb] = [pa, pb].map((p) => createHash("sha256").update(p).digest("hex"));
  const same = pa.equals(pb);
  if (!same) bad++;
  console.log(`${same ? "same" : "DIFF"}  ${labels.get(t)} t=${t}s  ${compare ? "before" : "workers1"}=${ha}  ${compare ? "after" : "workers4"}=${hb}`);
}
if (!compare) await checkSeeks();
console.log(bad ? `DETERMINISM FAILED: ${bad} frame(s) differ (${out})` : `DETERMINISM OK (${samples.length} frames; ${compare ? "theme comparison" : "fresh/sequential/shuffled and workers 1/4"}; ${out})`);
process.exit(bad ? 1 : 0);

// Use HyperFrames' already-installed Puppeteer, with an existing browser only; no download.
function chromeIn(root, depth = 0) {
  if (!existsSync(root) || depth > 5) return undefined;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isFile() && /^(?:chrome-headless-shell|chrome)(?:\.exe)?$/.test(entry.name)) return file;
    if (entry.isDirectory()) { const found = chromeIn(file, depth + 1); if (found) return found; }
  }
}

async function checkSeeks() {
  const require = createRequire(hyperframesEntry());
  const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
  const executablePath = process.env.HYPERFRAMES_BROWSER_PATH ??
    chromeIn(join(homedir(), ".cache", "hyperframes", "chrome")) ??
    chromeIn(join(homedir(), ".cache", "puppeteer"));
  if (!executablePath) throw new Error("seek checks need an existing Chrome; set HYPERFRAMES_BROWSER_PATH");
  const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".wav": "audio/wav" };
  const server = createServer((req, res) => {
    try {
      const file = resolve(dir, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
      const rel = relative(dir, file);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith("../") || rel.startsWith("..\\")) throw new Error("outside chapter");
      res.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      res.end(readFileSync(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const width = Number(html.match(/data-width="(\d+)"/)[1]), height = Number(html.match(/data-height="(\d+)"/)[1]);
  // Match renderArgs' device-only software raster path; other chapters keep browser defaults.
  const chromeArgs = ["--no-sandbox", "--disable-dev-shm-usage",
    ...(plan.devices?.length ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-compositing"] : []),
    "--font-render-hinting=none", "--force-color-profile=srgb", "--force-device-scale-factor=1", `--window-size=${width},${height}`];
  const browsers = new Set();
  const launch = async () => {
    const b = await puppeteer.launch({ executablePath, headless: true, args: chromeArgs });
    browsers.add(b);
    return b;
  };
  const quit = async (b) => {
    try { await b.close(); browsers.delete(b); } catch { /* Keep it for the final sweep without masking a seek error. */ }
  };
  try {
    const open = async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle0" });
      // Return a boolean, not the timeline: a GSAP timeline is a thenable, Puppeteer awaits the
      // predicate's value, and a paused timeline never settles, so the wait used to time out.
      await page.waitForFunction(() => !window.__hfTimelinesBuilding && !!window.__timelines?.main, { polling: 50 });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((img) => img.decode())); });
      return page;
    };
    const seek = (page, t) => page.evaluate((time) => {
      window.__timelines.main.seek(time);
      // Match HyperFrames' clip mounting without adding a second clock.
      for (const el of document.querySelectorAll(".tr-stage > section[data-beat]")) {
        const start = Number(el.dataset.start), end = start + Number(el.dataset.duration);
        el.style.visibility = time >= start && time < end ? "visible" : "hidden";
      }
    }, t);
    // Two animation frames let Chrome paint the seeked state before the capture.
    const shot = async (page) => {
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      return Buffer.from(await page.screenshot({ type: "png" }));
    };
    // Fresh: a new browser per sample, like a HyperFrames worker whose chunk starts there; pages
    // in one browser can share a renderer process and its raster caches.
    const fresh = new Map();
    for (const t of samples) {
      const browser = await launch();
      try { const page = await open(browser); await seek(page, t); fresh.set(t, await shot(page)); } finally { await quit(browser); }
    }
    const compareShot = async (page, t, mode) => {
      const png = await shot(page), baseline = fresh.get(t);
      const same = png.equals(baseline);
      if (!same) {
        bad++;
        writeFileSync(join(out, `fresh-${t}.png`), baseline);
        writeFileSync(join(out, `${mode}-${t}.png`), png);
      }
      console.log(`${same ? "same" : "DIFF"}  ${labels.get(t)} t=${t}s fresh/${mode}`);
    };
    const seqBrowser = await launch();
    try {
      const sequential = await open(seqBrowser);
      const wanted = new Set(samples.map((t) => Math.round(t * FPS)));
      for (let n = 0; n <= Math.round(samples.at(-1) * FPS); n++) {
        await seek(sequential, n / FPS);
        if (wanted.has(n)) await compareShot(sequential, n / FPS, "sequential");
      }
    } finally { await quit(seqBrowser); }
    const shuffleBrowser = await launch();
    try {
      const shuffled = await open(shuffleBrowser);
      // Fixed alternating high/low order exercises backwards and forwards seeks reproducibly.
      const order = samples.filter((_, i) => i % 2 === 0).reverse().concat(samples.filter((_, i) => i % 2));
      await seek(shuffled, samples.at(-1));
      for (const t of order) { await seek(shuffled, t); await compareShot(shuffled, t, "shuffled"); }
    } finally { await quit(shuffleBrowser); }
  } finally {
    for (const b of browsers) await b.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}
