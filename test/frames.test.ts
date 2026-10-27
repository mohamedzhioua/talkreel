import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmdFrames, safeZoneFilter } from "../src/commands/frames.js";
import { buildPaths } from "../src/compose.js";
import { run } from "../src/proc.js";
import { loadTalk } from "../src/talk.js";
import type { Resolution } from "../src/geometry.js";
import { makeTalk } from "./helpers.js";

vi.mock("../src/ffmpeg.js", async (original) => ({ ...await original<object>(), requireTool: () => "ffmpeg" }));
vi.mock("../src/compose-concat.js", () => ({ probeDuration: async () => 3 }));
vi.mock("../src/proc.js", () => ({ run: vi.fn(async (_exe: string, args: string[]) => {
  writeFileSync(args.at(-1)!, "extracted PNG");
  return { code: 0, stdout: "", stderr: "" };
}) }));

afterEach(() => { vi.restoreAllMocks(); vi.mocked(run).mockClear(); });

describe("safe-zone frame review", () => {
  it("draws 14/35/6 percent bands relative to the actual encoded frame", () => {
    expect(safeZoneFilter("portrait")?.split(",")).toEqual([
      "drawbox=x=0:y=0:w=iw:h=ih*0.14:color=red@0.28:t=fill",
      "drawbox=x=0:y=ih*(1-0.35):w=iw:h=ih*0.35:color=red@0.28:t=fill",
      "drawbox=x=0:y=0:w=iw*0.06:h=ih:color=yellow@0.28:t=fill",
      "drawbox=x=iw*(1-0.06):y=0:w=iw*0.06:h=ih:color=yellow@0.28:t=fill",
    ]);
    expect(safeZoneFilter("landscape")).toBeNull();
    expect(safeZoneFilter("square")).toBeNull();
  });

  it.each<[Resolution, boolean]>([["portrait", true], ["portrait", false], ["landscape", true], ["square", true]])("extracts every %s frame with safeZones=%s", async (resolution, safeZones) => {
    const talk = loadTalk(makeTalk({
      "script/en/01-a.md": "# A\n\nHello.\n",
      "captions/en/01.json": JSON.stringify({ lang: "en", words: [{ text: "Hello.", start: 0, end: 1, matched: true }] }),
    }, { resolution }));
    const mp4 = buildPaths.mp4(talk, "en", "01");
    mkdirSync(dirname(mp4), { recursive: true });
    writeFileSync(mp4, "rendered MP4");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdFrames(talk, { lang: "en", safeZones })).toBe(0);
    expect(run).toHaveBeenCalledTimes(2);
    for (const [, args] of vi.mocked(run).mock.calls) {
      const vf = args.indexOf("-vf");
      if (safeZones && resolution === "portrait") expect(args[vf + 1]).toBe(safeZoneFilter("portrait"));
      else expect(vf).toBe(-1);
    }
    const warnings = warn.mock.calls.filter(([message]) => String(message).includes("without an overlay"));
    expect(warnings).toHaveLength(safeZones && resolution !== "portrait" ? 1 : 0);
    expect(JSON.parse(log.mock.calls[0]![0]).frames).toHaveLength(2);
  });
});
