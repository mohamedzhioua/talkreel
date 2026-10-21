import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defaultTalkConfig } from "../src/commands/new.js";
import type { TalkConfig } from "../src/schema.js";

/** Create a throwaway talk folder. `files` maps relative paths to contents. */
export function makeTalk(files: Record<string, string>, config: Partial<TalkConfig> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "talkreel-test-"));
  const cfg = { ...defaultTalkConfig("demo", "Demo"), ...config };
  writeFileSync(join(dir, "talk.json"), JSON.stringify(cfg));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

export const SOURCES = JSON.stringify({
  sources: [{ id: "dora", title: "State of DevOps", publisher: "DORA", url: "https://dora.dev", quote: "Teams that...", date: "2025-09-01" }],
});
