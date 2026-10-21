import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SLUG_RE, type SourcesFile, type TalkConfig } from "../schema.js";

export function defaultTalkConfig(slug: string, title: string): TalkConfig {
  return {
    slug,
    title,
    languages: ["en"],
    voice: { mode: "ai", en: "af_heart", fr: "ff_siwis" },
    theme: "default",
    fps: 30,
    resolution: "landscape",
  };
}

/** Create talks/<slug>/ under `root` with talk.json, sources.json, script/en/ and scenes/. */
export function cmdNew(root: string, slug: string | undefined, title: string | undefined): number {
  if (!slug || !SLUG_RE.test(slug)) {
    console.error(`usage: talkreel new <slug> --title "<title>"   (slug must match ${SLUG_RE.source})`);
    return 1;
  }
  if (!title || !title.trim()) {
    console.error('missing --title "<title>"');
    return 1;
  }
  const dir = resolve(root, "talks", slug);
  if (existsSync(dir)) {
    console.error(`${dir} already exists`);
    return 1;
  }
  mkdirSync(join(dir, "script", "en"), { recursive: true });
  mkdirSync(join(dir, "scenes"), { recursive: true });
  writeFileSync(join(dir, "talk.json"), JSON.stringify(defaultTalkConfig(slug, title.trim()), null, 2) + "\n", "utf8");
  const sources: SourcesFile = { sources: [] };
  writeFileSync(join(dir, "sources.json"), JSON.stringify(sources, null, 2) + "\n", "utf8");
  console.log(`created ${dir}`);
  return 0;
}
