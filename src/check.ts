// `talkreel check`: every [s:id] in the scripts must exist in sources.json, and (via the scene
// hook below) every stat or quote building block in the scenes must name a known source.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseScene, validateScene, type SceneIssue } from "./compose-scene.js";
import { parseScriptFile, ScriptError } from "./script.js";
import { listChapters, loadSources, TalkError, type Talk } from "./talk.js";
import type { Source } from "./schema.js";

export interface CheckIssue {
  file: string;
  line?: number;
  message: string;
}

export interface CheckContext {
  talk: Talk;
  sources: Map<string, Source>;
}

export type SceneCheck = (ctx: CheckContext) => Promise<CheckIssue[]> | CheckIssue[];

/**
 * Run the scene validator (scenes.md rules that need no timing) on every scenes/NN-*.html:
 * structure, forbidden content, beats, animations, diagram steps, data-source on stat and quote
 * blocks with ids present in ctx.sources, and cue names against each language's script.
 * Timing rules (E_CUE_ORDER, E_CUE_BEFORE_BEAT) need captions and run at compose time.
 */
export function checkSceneSources(ctx: CheckContext): CheckIssue[] {
  const dir = join(ctx.talk.dir, "scenes");
  if (!existsSync(dir)) return [];
  const issues: CheckIssue[] = [];
  const ids = new Set(ctx.sources.keys());
  for (const f of readdirSync(dir).filter((n) => /^\d{2}-.+\.html$/.test(n)).sort()) {
    const file = `scenes/${f}`;
    const scene = parseScene(readFileSync(join(dir, f), "utf8"));
    const toIssue = (i: SceneIssue, lang?: string): CheckIssue => ({ file, line: i.line, message: `${i.rule} ${i.element}: ${i.message}${lang ? ` (script/${lang})` : ""}` });
    issues.push(...validateScene(scene, { sources: ids, resolution: ctx.talk.config.resolution, talkDir: ctx.talk.dir }).map((i) => toIssue(i)));
    for (const lang of ctx.talk.config.languages) {
      const ch = listChapters(ctx.talk, lang).find((c) => `${c.chapter}-${c.name}.html` === f);
      if (!ch) continue;
      let cues: Set<string>;
      try {
        cues = new Set(parseScriptFile(ch.file).cues.map((c) => c.id));
      } catch {
        continue; // the script problem is reported by the script checks
      }
      for (const i of validateScene(scene, { sources: ids, cues, resolution: ctx.talk.config.resolution, talkDir: ctx.talk.dir })) if (i.rule === "E_UNKNOWN_CUE") issues.push(toIssue(i, lang));
    }
  }
  return issues;
}

/** Scene-side checks run after the script checks. Append to this list rather than editing check(). */
export const sceneChecks: SceneCheck[] = [checkSceneSources];

export async function check(talk: Talk): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  let sources = new Map<string, Source>();
  try {
    sources = new Map(loadSources(talk).sources.map((s) => [s.id, s]));
  } catch (e) {
    if (!(e instanceof TalkError)) throw e;
    for (const m of e.message.split("\n")) issues.push({ file: "sources.json", message: m });
  }
  for (const lang of talk.config.languages) {
    for (const ch of listChapters(talk, lang)) {
      const file = relative(talk.dir, ch.file).replace(/\\/g, "/");
      try {
        const parsed = parseScriptFile(ch.file);
        for (const c of parsed.citations) {
          if (!sources.has(c.id)) issues.push({ file, line: c.line, message: `unknown source [s:${c.id}] (not in sources.json)` });
        }
        const seen = new Set<string>();
        for (const cue of parsed.cues) {
          if (seen.has(cue.id)) issues.push({ file, line: cue.line, message: `duplicate cue {#${cue.id}}` });
          seen.add(cue.id);
        }
        if (parsed.words.length === 0) issues.push({ file, message: "chapter has no narration" });
      } catch (e) {
        if (!(e instanceof ScriptError)) throw e;
        issues.push({ file, message: e.message.replace(ch.file + ": ", "") });
      }
    }
  }
  const ctx: CheckContext = { talk, sources };
  for (const sc of sceneChecks) issues.push(...(await sc(ctx)));
  return issues;
}

export function formatIssue(i: CheckIssue): string {
  return `${i.file}${i.line ? `:${i.line}` : ""}: ${i.message}`;
}
