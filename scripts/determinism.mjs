#!/usr/bin/env node
// Local determinism check (never in CI): render one composed chapter twice, with 1 and with 3
// HyperFrames workers, and compare the PNG bytes of chosen frames. Different worker counts start
// each worker's seek at a different frame, so equal bytes mean no frame depends on seek order.
//
//   node scripts/determinism.mjs <build/<lang>/NN dir> <t1> [t2 ...]
// Theme regression: keep a copy of a composed M2 chapter BEFORE the theme change, compose it
// again AFTER, then render both and compare exactly three extracted PNGs byte for byte:
//   node scripts/determinism.mjs --compare <before dir> <after dir> <t1> <t2> <t3>
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { findTool } from "../dist/ffmpeg.js";
import { hyperframesEntry, hyperframesEnv, renderArgs } from "../dist/compose-hyperframes.js";

const args = process.argv.slice(2);
const compare = args[0] === "--compare";
if (compare) args.shift();
const dirArg = args.shift();
const afterArg = compare ? args.shift() : undefined;
const times = args;
if (!dirArg || !times.length || (compare && (!afterArg || times.length !== 3)) || times.some((t) => !Number.isFinite(Number(t)) || Number(t) < 0)) {
  console.error("usage: node scripts/determinism.mjs <chapter build dir> <seconds> [seconds ...]\n       node scripts/determinism.mjs --compare <before dir> <after dir> <t1> <t2> <t3>");
  process.exit(2);
}
const dir = resolve(dirArg);
const ffmpeg = findTool("ffmpeg");
if (!ffmpeg) throw new Error("ffmpeg not found");
const out = mkdtempSync(join(tmpdir(), "talkreel-det-"));
const FPS = 30;

function render(dir, workers, label) {
  const mp4 = join(out, `${label}.mp4`);
  const resolution = readFileSync(join(dir, "index.html"), "utf8").match(/data-resolution="(landscape|portrait|square)"/)?.[1] ?? "landscape";
  const args = [hyperframesEntry(), ...renderArgs(dir, mp4, FPS, "draft", workers, resolution)];
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
const b = render(compare ? resolve(afterArg) : dir, compare ? 1 : 3, compare ? "after" : "w3");
let bad = 0;
for (const t of times) {
  const [pa, pb] = [frame(a, t), frame(b, t)];
  const [ha, hb] = [pa, pb].map((p) => createHash("sha256").update(p).digest("hex"));
  const same = pa.equals(pb);
  if (!same) bad++;
  console.log(`${same ? "same" : "DIFF"}  t=${t}s  ${compare ? "before" : "workers1"}=${ha}  ${compare ? "after" : "workers3"}=${hb}`);
}
console.log(bad ? `DETERMINISM FAILED: ${bad} frame(s) differ (${out})` : `DETERMINISM OK (${times.length} frames)`);
process.exit(bad ? 1 : 0);
