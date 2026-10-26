import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { isProcessCrash, renderArgs } from "../src/compose-hyperframes.js";

// Exercise the script with in-memory chapters and browser/process stand-ins: no render or Chrome.
const source = readFileSync(new URL("../scripts/determinism.mjs", import.meta.url), "utf8")
  .replace(/^#!.*\r?\n/, "")
  .replace(/^import .+;\r?$/gm, "")
  .replace('await import(pathToFileURL(require.resolve("puppeteer-core")).href)', "puppeteerModule");

function script(argv: string[], deviceDirs: string[], openError?: Error, differentFrame = false, device: object = { clicks: [], zooms: [] }, extra: object = {}) {
  const launches: { args: string[] }[] = [];
  const browsers: { close: ReturnType<typeof vi.fn> }[] = [];
  const spawnSync = vi.fn((_exe: string, args: string[], _options: unknown) => ({
    status: 0, stderr: "",
    stdout: args.includes("framemd5") ? "# header\n" + Array.from({ length: 60 }, (_, i) => `0, ${i}, ${i}, 1, 4, ${differentFrame && i === 0 && args.some((arg) => arg.endsWith("w4.mp4")) ? "changed" : "same"}`).join("\n") : "",
  }));
  const serverClose = vi.fn((done: () => void) => done());
  const server = { once() {}, listen(_port: number, _host: string, done: () => void) { done(); }, address: () => ({ port: 1 }), close: serverClose };
  const exit = vi.fn();
  const done = runInNewContext(`(async () => { ${source}\n })()`, {
    process: { argv: ["node", "determinism.mjs", ...argv], execPath: "node", env: { HYPERFRAMES_BROWSER_PATH: "chrome" }, exit },
    console: { log() {}, error() {} }, Buffer,
    createHash, basename, extname, isAbsolute, join, relative, resolve,
    spawnSync, findTool: () => "ffmpeg", hyperframesEntry: () => "hyperframes.mjs", hyperframesEnv: () => ({}), isProcessCrash, renderArgs,
    mkdtempSync: () => resolve("output"), tmpdir: () => resolve("tmp"), writeFileSync() {},
    readFileSync: (file: string) => {
      if (file.endsWith("timeline.js")) return `window.__trPlan = ${JSON.stringify({ D: 2, ...(deviceDirs.some((dir) => file === join(resolve(dir), "timeline.js")) ? { devices: [device] } : {}), ...extra })};\n`;
      if (file.endsWith("index.html")) return '<html data-resolution="landscape" data-width="1920" data-height="1080">';
      return Buffer.from("identical PNG");
    },
    createServer: () => server, createRequire: () => ({ resolve: () => "puppeteer-core" }),
    puppeteerModule: { default: { launch: async (options: { args: string[] }) => {
      launches.push(options);
      const browser = {
        close: vi.fn(async () => {}),
        newPage: async () => ({
          setViewport: async () => {}, goto: async () => { if (openError) throw openError; },
          waitForFunction: async () => {}, evaluate: async () => {}, screenshot: async () => Buffer.from("identical PNG"),
        }),
      };
      if (openError) browser.close.mockRejectedValueOnce(new Error("close failed"));
      browsers.push(browser);
      return browser;
    } } },
  }) as Promise<void>;
  return { done, spawnSync, launches, browsers, serverClose, exit };
}

describe("determinism script raster mode and cleanup", () => {
  it.each([
    [8.3, 249],
    [8.30002, 249],
    [8.30004, 250],
  ])("matches HyperFrames frame rounding for D=%s at 30 fps (%s frames)", (duration, expected) => {
    const helper = source.match(/function frameCount\([^]*?\n\}/)![0];
    expect(runInNewContext(`${helper}\nframeCount(${duration}, 30)`)).toBe(expected);
  });

  it.each(["before", "after"])("reads each comparison side's plan independently (%s has a device)", async (deviceDir) => {
    const r = script(["--compare", "before", "after", "1", "2", "3"], [deviceDir]);
    await r.done;
    const renders = r.spawnSync.mock.calls.map((call) => call[1]).filter((args) => args.includes("render"));
    expect(renders).toHaveLength(2);
    expect(renders.map((args) => args.includes("--no-browser-gpu"))).toEqual([deviceDir === "before", deviceDir === "after"]);
    expect(r.exit).toHaveBeenCalledWith(0);
  });

  it.each([false, true])("matches device-only software raster in seek browsers (device=%s)", async (device) => {
    const r = script(["chapter", "1"], device ? ["chapter"] : []);
    await r.done;
    expect(r.launches).toHaveLength(3);
    for (const launch of r.launches) {
      for (const flag of ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-compositing"]) {
        expect(launch.args.includes(flag)).toBe(device);
      }
    }
    expect(r.browsers.every((b) => b.close.mock.calls.length === 1)).toBe(true);
    expect(r.serverClose).toHaveBeenCalledOnce();
    expect(r.exit).toHaveBeenCalledWith(0);
  });

  it("retries failed browser cleanup in the final sweep and preserves the original seek error", async () => {
    const error = new Error("opening the chapter failed");
    const r = script(["chapter", "1"], ["chapter"], error);
    await expect(r.done).rejects.toBe(error);
    expect(r.browsers).toHaveLength(1);
    expect(r.browsers[0]!.close).toHaveBeenCalledTimes(2);
    expect(r.serverClose).toHaveBeenCalledOnce();
  });

  it("fails when an unsampled decoded frame differs even though every sampled PNG matches", async () => {
    const r = script(["chapter", "1"], ["chapter"], undefined, true);
    await r.done;
    expect(r.spawnSync.mock.calls.filter((call) => call[1].includes("framemd5"))).toHaveLength(2);
    expect(r.exit).toHaveBeenCalledWith(1);
  });

  it("samples mid-cursor, mid-zoom and settled after-zoom frames inside the chapter", async () => {
    const device = { clicks: [{ start: 0.2, t: 0.4 }], zooms: [{ t: 0.5, d: 0.6 }, { t: 1.4, d: 0.6 }] };
    const r = script(["chapter", "1"], ["chapter"], undefined, false, device);
    await r.done;
    const frames = r.spawnSync.mock.calls.map((call) => call[1].join(" ").match(/select=eq\(n\\,(\d+)\)/)?.[1]).filter(Boolean).map(Number);
    // 0.3 s mid-cursor, 0.8 s and 1.7 s mid-zoom, 1.3 s after the first zoom, 1 s requested;
    // the second zoom settles at 2.2 s, after the 2 s chapter, so it adds no frame.
    expect([...new Set(frames)].sort((a, b) => a - b)).toEqual([9, 24, 30, 39, 51]);
    expect(r.launches).toHaveLength(7);
    expect(r.exit).toHaveBeenCalledWith(0);
  });

  it("samples mid-fade cover backdrops and mid-tick checklist frames inside the chapter, without device raster", async () => {
    const plan = {
      backdrops: [{ id: "tr-backdrop-0", t: 0.12, d: 0.6, out: 1 }, { id: "tr-backdrop-1", t: 1.6, d: 0.6, out: null }],
      checks: [{ id: "tr-e-1", t: 0.5, d: 0.35 }, { id: "tr-e-2", t: 1.9, d: 0.35 }],
    };
    const r = script(["chapter"], [], undefined, false, undefined, plan);
    await r.done;
    const frames = r.spawnSync.mock.calls.map((call) => call[1].join(" ").match(/select=eq\(n\\,(\d+)\)/)?.[1]).filter(Boolean).map(Number);
    // 0.42 s and 1.9 s mid-fade, 0.675 s mid-tick; the second tick's midpoint (2.075 s) is past the 2 s chapter.
    expect([...new Set(frames)].sort((a, b) => a - b)).toEqual([13, 20, 57]);
    const renders = r.spawnSync.mock.calls.map((call) => call[1]).filter((args) => args.includes("render"));
    expect(renders.every((args) => !args.includes("--no-browser-gpu"))).toBe(true);
    expect(r.launches).toHaveLength(5);
    expect(r.exit).toHaveBeenCalledWith(0);
  });
});
