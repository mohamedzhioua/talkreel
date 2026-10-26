import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { renderArgs } from "../src/compose-hyperframes.js";

// Exercise the script with in-memory chapters and browser/process stand-ins: no render or Chrome.
const source = readFileSync(new URL("../scripts/determinism.mjs", import.meta.url), "utf8")
  .replace(/^#!.*\r?\n/, "")
  .replace(/^import .+;\r?$/gm, "")
  .replace('await import(pathToFileURL(require.resolve("puppeteer-core")).href)', "puppeteerModule");

function script(argv: string[], deviceDirs: string[], openError?: Error) {
  const launches: { args: string[] }[] = [];
  const browsers: { close: ReturnType<typeof vi.fn> }[] = [];
  const spawnSync = vi.fn((_exe: string, _args: string[], _options: unknown) => ({ status: 0 }));
  const serverClose = vi.fn((done: () => void) => done());
  const server = { once() {}, listen(_port: number, _host: string, done: () => void) { done(); }, address: () => ({ port: 1 }), close: serverClose };
  const exit = vi.fn();
  const done = runInNewContext(`(async () => { ${source}\n })()`, {
    process: { argv: ["node", "determinism.mjs", ...argv], execPath: "node", env: { HYPERFRAMES_BROWSER_PATH: "chrome" }, exit },
    console: { log() {}, error() {} }, Buffer,
    createHash, basename, extname, isAbsolute, join, relative, resolve,
    spawnSync, findTool: () => "ffmpeg", hyperframesEntry: () => "hyperframes.mjs", hyperframesEnv: () => ({}), renderArgs,
    mkdtempSync: () => resolve("output"), tmpdir: () => resolve("tmp"), writeFileSync() {},
    readFileSync: (file: string) => {
      if (file.endsWith("timeline.js")) return `window.__trPlan = ${JSON.stringify(deviceDirs.some((dir) => file === join(resolve(dir), "timeline.js")) ? { devices: [{ clicks: [], zooms: [] }] } : {})};\n`;
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
});
