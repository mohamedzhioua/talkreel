// `talkreel check`: every [s:id] in the scripts must exist in sources.json, and (via the scene
// hook below) every stat or quote building block in the scenes must name a known source.
import { relative } from "node:path";
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
 * HOOK for the compose builder: check scenes/NN-*.html so that every stat or quote building
 * block cites an id present in ctx.sources. Return one issue per problem; [] means clean.
 */
export function checkSceneSources(_ctx: CheckContext): CheckIssue[] {
  return [];
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
