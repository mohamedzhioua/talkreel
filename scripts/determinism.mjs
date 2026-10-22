#!/usr/bin/env node
// Local determinism check (never in CI): render one composed chapter twice, with 1 and with 3
// HyperFrames workers, and compare the PNG bytes of chosen frames. Different worker counts start
// each worker's seek at a different frame, so equal bytes mean no frame depends on seek order.
//
//   node scripts/determinism.mjs <build/<lang>/NN dir> <t1> [t2 ...]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findTool } from "../dist/ffmpeg.js";
import { hyperframesEntry, hyperframesEnv } from "../dist/compose-hyperframes.js";

const [dirArg, ...times] = process.argv.slice(2);
if (!dirArg || !times.length) {
  console.error("usage: node scripts/determinism.mjs <chapter build dir> <seconds> [seconds ...]");
  process.exit(2);
}
const dir = resolve(dirArg);
const ffmpeg = findTool("ffmpeg");
if (!ffmpeg) throw new Error("ffmpeg not found");
const out = mkdtempSync(join(tmpdir(), "talkreel-det-"));
const FPS = 30;

function render(workers) {
  const mp4 = join(out, `w${workers}.mp4`);
  const args = [hyperframesEntry(), "render", dir, "--output", mp4, "--fps", String(FPS), "--resolution", "landscape", "--quality", "draft", "--workers", String(workers)];
  const r = spawnSync(process.execPath, args, { cwd: dir, env: hyperframesEnv(false), stdio: ["ignore", "ignore", "inherit"], windowsHide: true });
  if (r.status !== 0) throw new Error(`render with ${workers} worker(s) failed (exit ${r.status})`);
  return mp4;
}

function frameHash(mp4, t) {
  const n = Math.round(Number(t) * FPS);
  const png = join(out, `${mp4.endsWith("w1.mp4") ? "w1" : "w3"}-${n}.png`);
  const r = spawnSync(ffmpeg, ["-loglevel", "error", "-y", "-i", mp4, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", png], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`frame ${n} extraction failed`);
  return createHash("sha256").update(readFileSync(png)).digest("hex").slice(0, 16);
}

const a = render(1);
const b = render(3);
let bad = 0;
for (const t of times) {
  const [ha, hb] = [frameHash(a, t), frameHash(b, t)];
  const same = ha === hb;
  if (!same) bad++;
  console.log(`${same ? "same" : "DIFF"}  t=${t}s  workers1=${ha}  workers3=${hb}`);
}
console.log(bad ? `DETERMINISM FAILED: ${bad} frame(s) differ (${out})` : `DETERMINISM OK (${times.length} frames)`);
process.exit(bad ? 1 : 0);
