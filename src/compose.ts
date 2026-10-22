// Composer: one chapter (scene + captions + narration) -> a self-contained HyperFrames project
// in build/<lang>/NN/ (scenes.md section 10). HyperFrames specifics live here and in
// src/hyperframes.ts only.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captionLines, type CaptionLine } from "./compose-captions.js";
import { TIMELINE_RUNTIME } from "./compose-runtime.js";
import { resolveCues } from "./cues.js";
import { hashJson, sha256, sha256File } from "./hash.js";
import { classList, escapeText, getAttr, hasAttr, setAttr, serialize, type HtmlElement, type HtmlText } from "./compose-html.js";
import { captionsProblems, type CaptionsFile, type Source } from "./schema.js";
import { parseScene, resolveTimeline, SceneError, usedCues, validateScene, type ResolvedTimeline, type Scene, type SceneIssue, type SceneWarning } from "./compose-scene.js";
import { parseScriptFile, type ParsedChapter } from "./script.js";
import { loadSources, paths, readJson, type ChapterFile, type Talk } from "./talk.js";
import { readWavInfo } from "./wav.js";

/** Bump when the generated page or timeline changes in a way that must re-render chapters. */
export const COMPOSE_VERSION = "2";

/** talkreel's own package root (the folder holding dist/, src/, themes/). */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Locate an installed npm package by walking up node_modules folders from talkreel's root. */
export function packageDir(name: string): string {
  for (let dir = PACKAGE_ROOT; ; dir = dirname(dir)) {
    const p = join(dir, "node_modules", name);
    if (existsSync(join(p, "package.json"))) return p;
    if (dirname(dir) === dir) throw new Error(`npm package ${name} is not installed (run "npm install" in ${PACKAGE_ROOT})`);
  }
}

export function packageVersion(name: string): string {
  return (JSON.parse(readFileSync(join(packageDir(name), "package.json"), "utf8")) as { version: string }).version;
}

export function themeDir(talk: Talk): string {
  const dir = join(PACKAGE_ROOT, "themes", talk.config.theme);
  if (!existsSync(join(dir, "theme.css"))) throw new Error(`theme "${talk.config.theme}" not found in ${join(PACKAGE_ROOT, "themes")}`);
  return dir;
}

export const FONT_FILES = [
  ["@fontsource/inter", ["400", "600", "800"].flatMap((w) => [`inter-latin-${w}-normal.woff2`, `inter-latin-ext-${w}-normal.woff2`])],
  ["@fontsource/jetbrains-mono", ["400", "600"].flatMap((w) => [`jetbrains-mono-latin-${w}-normal.woff2`, `jetbrains-mono-latin-ext-${w}-normal.woff2`])],
] as const;

export const buildPaths = {
  dir: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", lang, nn),
  index: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", lang, nn, "index.html"),
  mp4: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", lang, nn, "chapter.mp4"),
  /** What the last successful render used (quality), next to the MP4. */
  renderInfo: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", lang, nn, "render.json"),
  framesDir: (talk: Talk, lang: string, nn: string) => join(talk.dir, "build", "frames", lang, nn),
  concatList: (talk: Talk, lang: string) => join(talk.dir, "build", lang, "concat.txt"),
};

export function sceneFile(talk: Talk, ch: ChapterFile): string {
  return join(talk.dir, "scenes", `${ch.chapter}-${ch.name}.html`);
}

// ---------- pure page generation ----------

const r3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** `Source: {title} · {host} · {year}`, missing parts left out with their separator. */
export function sourceLabel(s: Pick<Source, "title" | "url" | "date">): string {
  let host = "";
  try {
    host = new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const year = /^\d{4}/.test(s.date ?? "") ? s.date.slice(0, 4) : "";
  const parts = [s.title?.trim() ?? "", host, year].filter(Boolean);
  return `Source: ${parts.join(" · ")}`;
}

function rawNode(parent: HtmlElement, raw: string): HtmlText {
  return { type: "text", raw, parent, line: parent.line };
}

export interface PageInput {
  lang: string;
  scene: Scene;
  timeline: ResolvedTimeline;
  captions: CaptionsFile;
  audioDuration: number;
  sources: ReadonlyMap<string, Source>;
}

export interface Plan {
  D: number;
  diagrams: { renderId: string; host: string }[];
  beats: { id: string; start: number; unmount: number; fadeAt: number | null; camera: string }[];
  targets: { id: string; anim: string; t: number; d: number; n?: number }[];
  steps: { host: string; renderId: string; t: number; nodes: string[]; edges: [string, string][] }[];
  lines: { id: string; show: number; hide: number }[];
  words: { id: string; start: number; end: number }[];
}

export interface Page {
  html: string;
  plan: Plan;
  lines: CaptionLine[];
  hasDiagram: boolean;
}

/**
 * Build index.html and the timeline plan. Mutates the scene tree (ids, clip attributes, source
 * labels, Mermaid hosts), so pass a freshly parsed scene.
 */
export function buildPage(input: PageInput): Page {
  const { scene, timeline: tl, captions } = input;
  const D = tl.duration;
  const usedIds = new Set<string>();
  let nextId = 0;
  const idFor = (el: HtmlElement): string => {
    const own = getAttr(el, "id");
    if (typeof own === "string" && own) return own;
    let id: string;
    do id = `tr-e-${nextId++}`;
    while (usedIds.has(id));
    setAttr(el, "id", id);
    usedIds.add(id);
    return id;
  };

  for (const b of tl.beats) {
    const el = scene.beats[b.index]!.el;
    setAttr(el, "id", b.domId);
    setAttr(el, "class", [...classList(el), "clip"].join(" "));
    setAttr(el, "data-start", r3(b.start));
    setAttr(el, "data-duration", r3(b.unmount - b.start));
    setAttr(el, "data-track-index", "1");
  }

  const targets = tl.targets.map((t) => {
    const o: Plan["targets"][number] = { id: idFor(t.el), anim: t.anim, t: Math.round(t.t * 1000) / 1000, d: Math.round(t.duration * 1000) / 1000 };
    if (t.chars !== undefined) o.n = t.chars;
    return o;
  });

  const hostOf = new Map<HtmlElement, string>();
  const diagrams = tl.diagrams.map((d) => {
    const host = `tr-m-${d.renderId.slice("tr-d-".length)}`;
    const pre = d.figure.children.find((c): c is HtmlElement => c.type === "element" && hasAttr(c, "data-mermaid"));
    const at = pre ? d.figure.children.indexOf(pre) + 1 : d.figure.children.length;
    d.figure.children.splice(at, 0, rawNode(d.figure, `<div class="tr-mermaid" id="${host}"></div>`));
    hostOf.set(d.figure, host);
    return { renderId: d.renderId, host };
  });
  const renderIdOf = new Map(tl.diagrams.map((d) => [d.figure, d.renderId]));
  const steps = tl.steps.map((s) => ({ host: hostOf.get(s.figure)!, renderId: renderIdOf.get(s.figure)!, t: Math.round(s.t * 1000) / 1000, nodes: s.nodes, edges: s.edges }));

  // Source labels, appended as the block's last child.
  const walk = (el: HtmlElement) => {
    for (const c of el.children) if (c.type === "element") walk(c);
    const src = getAttr(el, "data-source");
    if (typeof src === "string" && src.startsWith("s:")) {
      const s = input.sources.get(src.slice(2));
      if (s) el.children.push(rawNode(el, `<p class="tr-source">${escapeText(sourceLabel(s))}</p>`));
    }
  };
  walk(scene.root);

  const lines = captionLines(captions.words, D);
  // Every word starts with an explicit data-state: GSAP records it as the start value, so seeking
  // back before a word reverts it to "upcoming" (a missing attribute cannot be restored).
  const lineHtml = lines
    .map((l, j) => `      <div class="tr-cap-line" id="tr-cap-${j}">${l.words.map((k) => `<span class="tr-word" id="tr-w-${k}" data-state="upcoming">${escapeText(captions.words[k]!.text)}</span>`).join(" ")}</div>`)
    .join("\n");

  const beatsHtml = scene.beats.map((b) => "      " + serialize(b.el)).join("\n");
  const hasDiagram = diagrams.length > 0;
  const html = `<!doctype html>
<html lang="${input.lang}" data-resolution="landscape">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080">
  <link rel="stylesheet" href="theme.css">
  <script src="vendor/gsap.min.js"></script>
${hasDiagram ? '  <script src="vendor/mermaid.min.js"></script>\n' : ""}</head>
<body>
  <div id="tr-root" class="tr-root" data-composition-id="main"
       data-start="0" data-duration="${r3(D)}" data-width="1920" data-height="1080">
    <div class="tr-stage">
${beatsHtml}
    </div>
    <div id="tr-captions" class="tr-captions clip" data-start="0" data-duration="${r3(D)}" data-track-index="2">
${lineHtml}
    </div>
    <audio id="tr-narration" src="assets/narration.wav" data-start="0"
           data-duration="${r3(input.audioDuration)}" data-track-index="3" data-volume="1"></audio>
  </div>
  <script>window.__hfTimelinesBuilding = true; window.__timelines = window.__timelines || {};</script>
  <script src="timeline.js"></script>
</body>
</html>
`;

  const round = (n: number) => Math.round(n * 1000) / 1000;
  const plan: Plan = {
    D: round(D),
    diagrams,
    beats: tl.beats.map((b) => ({ id: b.domId, start: round(b.start), unmount: round(b.unmount), fadeAt: b.fadeAt === null ? null : round(b.fadeAt), camera: b.camera })),
    targets,
    steps,
    lines: lines.map((l, j) => ({ id: `tr-cap-${j}`, show: round(l.show), hide: round(l.hide) })),
    words: captions.words.map((w, k) => ({ id: `tr-w-${k}`, start: round(w.start), end: round(w.end) })),
  };
  return { html, plan, lines, hasDiagram };
}

export function timelineScript(plan: Plan): string {
  return `// Generated by talkreel ${COMPOSE_VERSION}. Do not edit: run "talkreel render".\nwindow.__hfTimelinesBuilding = true;\nwindow.__trPlan = ${JSON.stringify(plan)};\n${TIMELINE_RUNTIME}`;
}

function dedupe(issues: SceneIssue[]): SceneIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.rule}|${i.line}|${i.element}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Validate and resolve a scene against its script and captions; throws SceneError. */
export function prepareScene(
  file: string,
  source: string,
  chapter: ParsedChapter,
  captions: CaptionsFile,
  audioDuration: number,
  sourceIds: ReadonlySet<string>,
): { scene: Scene; timeline: ResolvedTimeline; warnings: SceneWarning[] } {
  const scene = parseScene(source);
  const issues = validateScene(scene, { sources: sourceIds, cues: new Set(chapter.cues.map((c) => c.id)) });
  const seen = new Set<string>();
  for (const c of chapter.cues) {
    if (seen.has(c.id)) issues.push({ rule: "E_DUP_CUE", line: c.line, element: `{#${c.id}}`, message: `cue {#${c.id}} appears twice in the script` });
    seen.add(c.id);
  }
  if (issues.length) throw new SceneError(file, dedupe(issues));
  const timeline = resolveTimeline(scene, resolveCues(chapter, captions), audioDuration);
  if (timeline.issues.length) throw new SceneError(file, dedupe(timeline.issues));
  const used = usedCues(scene);
  const warnings = [...timeline.warnings];
  for (const c of chapter.cues) if (!used.has(c.id)) warnings.push({ line: c.line, message: `script cue {#${c.id}} is not used by the scene` });
  return { scene, timeline, warnings };
}

// ---------- I/O ----------

export function loadCaptions(file: string): CaptionsFile {
  const v = readJson(file);
  const problems = captionsProblems(v);
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
  return v as CaptionsFile;
}

function copy(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

export interface ComposeResult {
  dir: string;
  duration: number;
  audioDuration: number;
  warnings: SceneWarning[];
  page: Page;
  timeline: ResolvedTimeline;
}

/** Write build/<lang>/NN/ for one chapter. Throws SceneError on a contract violation. */
export function composeChapter(talk: Talk, ch: ChapterFile): ComposeResult {
  if (talk.config.resolution !== "landscape") throw new Error(`resolution "${talk.config.resolution}" is not supported yet; the default theme is 1920x1080 landscape`);
  const scenePath = sceneFile(talk, ch);
  if (!existsSync(scenePath)) throw new Error(`no scene file scenes/${ch.chapter}-${ch.name}.html for ${ch.file}`);
  const wav = paths.narrationWav(talk, ch.lang, ch.chapter);
  const capFile = paths.captions(talk, ch.lang, ch.chapter);
  if (!existsSync(wav)) throw new Error(`missing narration ${wav}; run "talkreel voice"`);
  if (!existsSync(capFile)) throw new Error(`missing captions ${capFile}; run "talkreel align"`);
  const chapter = parseScriptFile(ch.file);
  const captions = loadCaptions(capFile);
  const A = readWavInfo(wav).duration;
  const sources = new Map(loadSources(talk).sources.map((s) => [s.id, s]));
  const rel = `scenes/${ch.chapter}-${ch.name}.html`;
  const { scene, timeline, warnings } = prepareScene(rel, readFileSync(scenePath, "utf8"), chapter, captions, A, new Set(sources.keys()));
  const page = buildPage({ lang: ch.lang, scene, timeline, captions, audioDuration: A, sources });

  const dir = buildPaths.dir(talk, ch.lang, ch.chapter);
  mkdirSync(dir, { recursive: true });
  const theme = themeDir(talk);
  copy(join(theme, "theme.css"), join(dir, "theme.css"));
  for (const [pkg, files] of FONT_FILES) for (const f of files) copy(join(packageDir(pkg), "files", f), join(dir, "fonts", f));
  copy(join(packageDir("gsap"), "dist", "gsap.min.js"), join(dir, "vendor", "gsap.min.js"));
  if (page.hasDiagram) {
    copy(join(packageDir("mermaid"), "dist", "mermaid.min.js"), join(dir, "vendor", "mermaid.min.js"));
    copy(join(theme, "mermaid.mjs"), join(dir, "mermaid.mjs"));
  }
  copy(wav, join(dir, "assets", "narration.wav"));
  writeFileSync(join(dir, "index.html"), page.html, "utf8");
  writeFileSync(join(dir, "timeline.js"), timelineScript(page.plan), "utf8");
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ id: `${talk.config.slug}-${ch.lang}-${ch.chapter}`, name: `${talk.config.slug} ${ch.lang}/${ch.chapter}` }, null, 2) + "\n", "utf8");
  return { dir, duration: timeline.duration, audioDuration: A, warnings, page, timeline };
}

// ---------- render input hash ----------

export async function themeHash(talk: Talk): Promise<string> {
  const dir = themeDir(talk);
  const parts = [await sha256File(join(dir, "theme.css"))];
  if (existsSync(join(dir, "mermaid.mjs"))) parts.push(await sha256File(join(dir, "mermaid.mjs")));
  return sha256(parts.join("\n"));
}

/**
 * Scene-side render input: the scene file, the cue positions in the script (moving a cue moves
 * the picture without touching captions) and the sources the scene cites (their labels).
 */
export function sceneInputHash(sceneSource: string, chapter: ParsedChapter, sources: ReadonlyMap<string, Source>): string {
  const cited = [...sceneSource.matchAll(/data-source\s*=\s*["']s:([^"']+)["']/g)].map((m) => m[1]!).sort();
  return hashJson({
    scene: sha256(sceneSource),
    cues: chapter.cues.map((c) => [c.id, c.wordIndex]),
    sources: cited.map((id) => sources.get(id) ?? null),
  });
}
