// Scene files: parsing, the validation rules and the timeline resolution of
// skills/talkreel/references/scenes.md (sections 1-9). Pure functions, no I/O, so the rules are
// unit-testable without a browser.
import { classList, describe, descendants, elementChildren, geometryFor, getAttr, hasAttr, parseFragment, textContent, type HtmlElement } from "./compose-html.js";
import { GEOMETRY, type Resolution } from "./geometry.js";

export const TRANSITION = 0.3;
export const STAGGER = 0.12;
export const PADDING = 0.6;

export const ANIMS = ["fade-up", "fade", "pop", "type", "draw", "stream", "slide"] as const;

// Terminal geometry and pacing (scenes.md section 5a). Rows are fixed height and never wrap, so
// the scroll offsets are computed here instead of measured in the browser.
export const TERM_ROWS = GEOMETRY.landscape.terminal.maxRows;
export const TERM_MIN_ROWS = 1;

/** Visible rows of a terminal: data-rows (1..13), else 13. */
export function terminalRows(block: HtmlElement): number {
  const n = Number(getAttr(block, "data-rows"));
  const max = geometryFor(block).terminal.maxRows;
  return Number.isInteger(n) && n >= TERM_MIN_ROWS && n <= max ? n : max;
}
export const TERM_MAX_CHARS = GEOMETRY.landscape.terminal.maxChars;
/** First line after the window appears. */
export const TERM_OPEN = 0.3;
/** An output line after the previous output line starts. */
export const TERM_GAP = 0.07;
/** An output line after a prompt finishes typing (the "enter"). */
export const TERM_ENTER = 0.25;
/** A prompt after the previous line has entered. */
export const TERM_THINK = 0.4;
/** A window starts growing this long before the row that needs the space. */
export const TERM_GROW_LEAD = 0.1;
export const TERM_ROLES = ["data-prompt", "data-out", "data-tool", "data-result", "data-diff"] as const;
export const TERM_TONES = ["ok", "err", "warn", "dim", "accent"] as const;
export const PIPELINE_MIN = 3;
export const PIPELINE_MAX = 8;
export const PIPELINE_CHIP_CHARS = 14;
export type Anim = (typeof ANIMS)[number];
export const CAMERAS = ["none", "push-in", "pan-left"] as const;
export type Camera = (typeof CAMERAS)[number];

export type RuleId =
  | "E_TOP_LEVEL"
  | "E_BEAT_ID"
  | "E_BAD_CAMERA"
  | "E_FIRST_BEAT_CUE"
  | "E_BEAT_NO_CUE"
  | "E_CUE_ORDER"
  | "E_DUP_CUE"
  | "E_UNKNOWN_CUE"
  | "E_CUE_BEFORE_BEAT"
  | "E_BAD_ANIM"
  | "E_STEP_UNKNOWN"
  | "E_SOURCE_MISSING"
  | "E_SOURCE_PLACE"
  | "E_UNKNOWN_SOURCE"
  | "E_TERM_LINE"
  | "E_PIPELINE"
  | "E_FORBIDDEN";

export interface SceneIssue {
  rule: RuleId;
  line: number;
  element: string;
  message: string;
}

export interface SceneWarning {
  line?: number;
  message: string;
}

export function formatSceneIssue(file: string, i: SceneIssue): string {
  return `${file}:${i.line}: ${i.rule} ${i.element}: ${i.message}`;
}

export class SceneError extends Error {
  constructor(
    public file: string,
    public issues: SceneIssue[],
  ) {
    super(issues.map((i) => formatSceneIssue(file, i)).join("\n"));
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const FORBIDDEN_TAGS = new Set(["script", "style", "link", "iframe", "img", "video", "audio", "object", "embed"]);
const TIMING_ATTRS = new Set(["data-start", "data-duration", "data-track-index", "data-delay", "data-at"]);
const SOURCED_BLOCKS = new Set(["stat", "quote", "definition"]);
const SOURCE_REQUIRED = new Set(["stat", "quote"]);
const URL_RE = /(^|[\s,;("'=])(?:https?:|\/\/)/i;

export interface Beat {
  index: number;
  id: string;
  el: HtmlElement;
  cue: string | null;
  camera: Camera;
}

export interface Scene {
  root: HtmlElement;
  beats: Beat[];
}

export function parseScene(source: string): Scene {
  const root = parseFragment(source);
  const beats: Beat[] = [];
  for (const el of elementChildren(root)) {
    if (el.tag !== "section" || !hasAttr(el, "data-beat")) continue;
    const cam = getAttr(el, "data-camera");
    beats.push({
      index: beats.length,
      id: getAttr(el, "data-beat") ?? "",
      el,
      cue: getAttr(el, "data-cue") ?? null,
      camera: (CAMERAS as readonly string[]).includes(cam ?? "") ? (cam as Camera) : "none",
    });
  }
  return { root, beats };
}

function issue(rule: RuleId, el: HtmlElement, message: string): SceneIssue {
  return { rule, line: el.line, element: describe(el), message };
}

/** Node ids of a `<pre data-mermaid>` source occur in it as whole words. */
function occursAsWord(source: string, id: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${id.replace(/[^A-Za-z0-9]/g, "")}($|[^A-Za-z0-9_])`).test(source) && /^[A-Za-z0-9]+$/.test(id);
}

/** The role attribute of a terminal line, or null when it has none or several. */
export function terminalRole(p: HtmlElement): (typeof TERM_ROLES)[number] | null {
  const roles = TERM_ROLES.filter((r) => hasAttr(p, r));
  return roles.length === 1 ? roles[0]! : null;
}

export function isPrompt(p: HtmlElement): boolean {
  return hasAttr(p, "data-prompt");
}

function terminalIssues(block: HtmlElement): SceneIssue[] {
  const limits = geometryFor(block).terminal;
  const out: SceneIssue[] = [];
  const lines = elementChildren(block);
  if (!lines.length) out.push(issue("E_TERM_LINE", block, "a terminal needs at least one <p> line"));
  const rows = getAttr(block, "data-rows");
  if (rows !== undefined && terminalRows(block) !== Number(rows)) out.push(issue("E_TERM_LINE", block, `data-rows must be a whole number from ${TERM_MIN_ROWS} to ${limits.maxRows}`));
  for (const p of lines) {
    if (p.tag !== "p") {
      out.push(issue("E_TERM_LINE", p, "a terminal holds only <p> lines"));
      continue;
    }
    const role = terminalRole(p);
    if (!role) out.push(issue("E_TERM_LINE", p, `a terminal line needs exactly one of ${TERM_ROLES.join(", ")}`));
    const prompt = getAttr(p, "data-prompt");
    if (role === "data-prompt" && prompt !== null && prompt !== "" && prompt !== "sh") out.push(issue("E_TERM_LINE", p, 'data-prompt is bare (Claude) or "sh" (shell)'));
    const diff = getAttr(p, "data-diff");
    if (role === "data-diff" && diff !== "add" && diff !== "del") out.push(issue("E_TERM_LINE", p, 'data-diff must be "add" or "del"'));
    const tone = getAttr(p, "data-tone");
    if (tone !== undefined && !(TERM_TONES as readonly string[]).includes(tone ?? "")) out.push(issue("E_TERM_LINE", p, `data-tone must be one of ${TERM_TONES.join(", ")}`));
    if (elementChildren(p).length) out.push(issue("E_TERM_LINE", p, "a terminal line holds plain text only"));
    const n = textContent(p).trim().length;
    if (n > limits.maxChars) out.push(issue("E_TERM_LINE", p, `${n} characters; a terminal line holds at most ${limits.maxChars}`));
  }
  return out;
}

function pipelineIssues(block: HtmlElement): SceneIssue[] {
  const kids = elementChildren(block);
  const ol = kids.length === 1 && kids[0]!.tag === "ol" ? kids[0]! : null;
  if (!ol) return [issue("E_PIPELINE", block, "a pipeline holds exactly one <ol>")];
  const chips = elementChildren(ol);
  const out: SceneIssue[] = [];
  if (chips.length < PIPELINE_MIN || chips.length > PIPELINE_MAX || chips.some((c) => c.tag !== "li")) {
    out.push(issue("E_PIPELINE", ol, `a pipeline has ${PIPELINE_MIN} to ${PIPELINE_MAX} <li> chips`));
  }
  for (const c of chips) {
    const n = textContent(c).trim().length;
    if (n > PIPELINE_CHIP_CHARS) out.push(issue("E_PIPELINE", c, `${n} characters; a chip holds at most ${PIPELINE_CHIP_CHARS}`));
    if (elementChildren(c).length) out.push(issue("E_PIPELINE", c, "a chip holds plain text only"));
  }
  return out;
}

export interface StaticCheckOptions {
  resolution: Resolution;
  /** Source ids from sources.json. */
  sources: ReadonlySet<string>;
  /** Cue names from the matching script; omit to skip E_UNKNOWN_CUE. */
  cues?: ReadonlySet<string>;
}

/**
 * Every rule that needs no timing: structure, forbidden content, beats, animations, diagram
 * steps, sources and (when `cues` is given) unknown cue names.
 */
export function validateScene(scene: Scene, opts: StaticCheckOptions): SceneIssue[] {
  scene.root.resolution = opts.resolution;
  const out: SceneIssue[] = [];
  const { root, beats } = scene;

  for (const n of root.children) {
    if (n.type === "comment") continue;
    if (n.type === "text" && n.raw.trim() === "") continue;
    if (n.type === "element" && n.tag === "section" && hasAttr(n, "data-beat")) continue;
    const line = n.line;
    const what = n.type === "element" ? describe(n) : n.type === "text" ? JSON.stringify(n.raw.trim().slice(0, 30)) : n.raw.slice(0, 30);
    out.push({ rule: "E_TOP_LEVEL", line, element: what, message: "only <section data-beat> elements, whitespace and comments may sit at the top level" });
  }

  const all = descendants(root);
  for (const el of all) {
    if (FORBIDDEN_TAGS.has(el.tag)) out.push(issue("E_FORBIDDEN", el, `<${el.tag}> is not allowed in a scene`));
    for (const a of el.attrs) {
      if (/^on/.test(a.name)) out.push(issue("E_FORBIDDEN", el, `event handler attribute ${a.name} is not allowed`));
      else if (a.name === "style") out.push(issue("E_FORBIDDEN", el, "style attributes are not allowed; the look belongs to the theme"));
      else if (TIMING_ATTRS.has(a.name)) out.push(issue("E_FORBIDDEN", el, `timing attribute ${a.name} is not allowed; time comes only from cues`));
      if (a.value !== null && URL_RE.test(a.value)) out.push(issue("E_FORBIDDEN", el, `external URL in ${a.name} is not allowed`));
    }
    if (classList(el).includes("clip")) out.push(issue("E_FORBIDDEN", el, 'class="clip" is reserved for the composer'));
    const id = getAttr(el, "id");
    if (typeof id === "string" && id.startsWith("tr-")) out.push(issue("E_FORBIDDEN", el, 'ids starting with "tr-" are reserved for the composer'));
  }

  const seenBeat = new Set<string>();
  beats.forEach((b, i) => {
    if (!NAME_RE.test(b.id)) out.push(issue("E_BEAT_ID", b.el, `beat id "${b.id}" must match ${NAME_RE.source}`));
    else if (seenBeat.has(b.id)) out.push(issue("E_BEAT_ID", b.el, `duplicate beat id "${b.id}"`));
    seenBeat.add(b.id);
    const cam = getAttr(b.el, "data-camera");
    if (cam !== undefined && !(CAMERAS as readonly string[]).includes(cam ?? "")) out.push(issue("E_BAD_CAMERA", b.el, `data-camera must be one of ${CAMERAS.join(", ")}`));
    if (i === 0 && b.cue !== null) out.push(issue("E_FIRST_BEAT_CUE", b.el, "the first beat starts at 0 s and must not have data-cue"));
    if (i > 0 && (b.cue === null || b.cue === "")) out.push(issue("E_BEAT_NO_CUE", b.el, "every beat after the first needs data-cue"));
  });
  if (beats.length === 0 && out.length === 0) {
    out.push({ rule: "E_TOP_LEVEL", line: 1, element: "(scene)", message: "a scene needs at least one <section data-beat>" });
  }

  for (const el of all) {
    const anim = getAttr(el, "data-anim");
    if (anim !== undefined && !(ANIMS as readonly string[]).includes(anim ?? "")) out.push(issue("E_BAD_ANIM", el, `data-anim must be one of ${ANIMS.join(", ")}`));
    if (opts.cues && hasAttr(el, "data-cue")) {
      const cue = getAttr(el, "data-cue") ?? "";
      if (!opts.cues.has(cue)) out.push(issue("E_UNKNOWN_CUE", el, `cue "${cue}" has no {#${cue}} marker in the script`));
    }
    const src = getAttr(el, "data-source");
    const block = getAttr(el, "data-block");
    if (src !== undefined) {
      if (typeof block !== "string" || !SOURCED_BLOCKS.has(block)) {
        out.push(issue("E_SOURCE_PLACE", el, "data-source is only allowed on stat, quote and definition blocks"));
      } else {
        const m = /^s:(.+)$/.exec(src ?? "");
        if (!m) out.push(issue("E_UNKNOWN_SOURCE", el, `data-source must be "s:<id>", got "${src ?? ""}"`));
        else if (!opts.sources.has(m[1]!)) out.push(issue("E_UNKNOWN_SOURCE", el, `source "${m[1]}" is not in sources.json`));
      }
    } else if (typeof block === "string" && SOURCE_REQUIRED.has(block)) {
      out.push(issue("E_SOURCE_MISSING", el, `a ${block} block needs data-source="s:<id>"`));
    }
    if (block === "terminal") out.push(...terminalIssues(el));
    if (block === "pipeline") out.push(...pipelineIssues(el));
    if (block === "diagram") {
      const pre = descendants(el).find((d) => hasAttr(d, "data-mermaid"));
      const source = pre ? textContent(pre) : "";
      for (const st of descendants(el).filter((d) => hasAttr(d, "data-step"))) {
        const nodes = (getAttr(st, "data-nodes") ?? "").split(",").filter(Boolean);
        for (const n of nodes) if (!occursAsWord(source, n)) out.push(issue("E_STEP_UNKNOWN", st, `node "${n}" is not in the Mermaid source`));
        for (const e of (getAttr(st, "data-edges") ?? "").split(",").filter(Boolean)) {
          const ends = e.split("-");
          if (ends.length !== 2 || !ends[0] || !ends[1]) {
            out.push(issue("E_STEP_UNKNOWN", st, `edge "${e}" must be FROM-TO`));
            continue;
          }
          for (const n of ends) if (!occursAsWord(source, n)) out.push(issue("E_STEP_UNKNOWN", st, `edge end "${n}" of "${e}" is not in the Mermaid source`));
        }
      }
    }
  }
  return out;
}

// ---------- timeline resolution (sections 4-7) ----------

export interface ResolvedBeat {
  index: number;
  id: string;
  /** Element id written into the page: tr-beat-<i>. */
  domId: string;
  start: number;
  /** start(i+1) for every beat but the last, D for the last. */
  end: number;
  /** When the beat leaves the page: end + TRANSITION, or D for the last beat. */
  unmount: number;
  /** Fade-out start, null for the last beat. */
  fadeAt: number | null;
  /** Earliest time any content of this beat may enter. */
  floor: number;
  camera: Camera;
}

export interface ResolvedTarget {
  el: HtmlElement;
  beat: number;
  anim: Anim;
  /** Time before stagger (steps 1-3). */
  base: number;
  /** Final start time on the chapter timeline. */
  t: number;
  /** Tween duration; for `draw` the per-geometry duration. */
  duration: number;
  /** For `type`: the number of characters (steps(n)). */
  chars?: number;
}

export interface ResolvedStep {
  el: HtmlElement;
  beat: number;
  /** The diagram figure the step belongs to. */
  figure: HtmlElement;
  t: number;
  nodes: string[];
  edges: [string, string][];
}

export interface ResolvedDiagram {
  figure: HtmlElement;
  beat: number;
  /** mermaid.render id: tr-d-<beatIndex>-<n>. */
  renderId: string;
}

/** A terminal's content moves up to `y` px at `t` (line `row` entered below the last row). */
export interface ResolvedScroll {
  block: HtmlElement;
  t: number;
  y: number;
}

/** A terminal window grows to show `rows` rows at `t` (it opens one row tall). */
export interface ResolvedGrow {
  block: HtmlElement;
  t: number;
  rows: number;
}

/** The cursor after a typed prompt: blinking from `show` until `hide`. */
export interface ResolvedCursor {
  line: HtmlElement;
  show: number;
  hide: number;
}

/** A pipeline chip lights at `t`; the rail then fills to `fraction` of its length. */
export interface ResolvedChip {
  block: HtmlElement;
  chip: HtmlElement;
  t: number;
  fraction: number;
  /** Lit when the beat opens (data-done): no pop, the rail starts there. */
  done: boolean;
}

export interface ResolvedTimeline {
  duration: number;
  beats: ResolvedBeat[];
  targets: ResolvedTarget[];
  steps: ResolvedStep[];
  diagrams: ResolvedDiagram[];
  scrolls: ResolvedScroll[];
  grows: ResolvedGrow[];
  cursors: ResolvedCursor[];
  chips: ResolvedChip[];
  issues: SceneIssue[];
  warnings: SceneWarning[];
}

function isExcluded(el: HtmlElement): boolean {
  if (hasAttr(el, "data-step") || hasAttr(el, "data-mermaid")) return true;
  const cls = classList(el);
  return cls.includes("tr-source") || cls.includes("tr-mermaid");
}

function blockOf(el: HtmlElement): string | null {
  for (let p: HtmlElement | null = el.parent; p; p = p.parent) {
    const b = getAttr(p, "data-block");
    if (typeof b === "string") return b;
  }
  return null;
}

function codeBlockOf(el: HtmlElement): HtmlElement | null {
  for (let p: HtmlElement | null = el.parent; p; p = p.parent) if (getAttr(p, "data-block") === "code") return p;
  return null;
}

/** The terminal block of a terminal line (a <p> directly inside it), else null. */
function terminalOf(el: HtmlElement): HtmlElement | null {
  return el.tag === "p" && el.parent && getAttr(el.parent, "data-block") === "terminal" ? el.parent : null;
}

function isPipelineChip(el: HtmlElement): boolean {
  return el.tag === "li" && blockOf(el) === "pipeline";
}

function defaultAnim(el: HtmlElement): Anim {
  const block = getAttr(el, "data-block");
  if (block === "diagram" || block === "terminal" || block === "pipeline") return "fade";
  if (hasAttr(el, "data-line") && codeBlockOf(el)) return "type";
  if (terminalOf(el)) return isPrompt(el) ? "type" : "stream";
  return "fade-up";
}

export function typeDuration(chars: number): number {
  return Math.min(1.2, Math.max(0.3, 0.035 * chars));
}

const ANIM_DURATION: Record<Exclude<Anim, "type">, number> = { "fade-up": 0.6, fade: 0.6, pop: 0.5, draw: 0.8, stream: 0.12, slide: 0.6 };

/** The entrance targets of a beat, in document order (section 5, "Targets"). */
export function beatTargets(beat: HtmlElement): HtmlElement[] {
  const set = new Set<HtmlElement>();
  const direct = new Set(elementChildren(beat));
  for (const el of descendants(beat)) {
    // Pipeline chips are always on screen; they light up (ResolvedChip), they do not enter.
    if (isExcluded(el) || isPipelineChip(el)) continue;
    let target = direct.has(el) || hasAttr(el, "data-cue") || hasAttr(el, "data-anim");
    if (!target && el.tag === "li" && blockOf(el) === "list") target = true;
    if (!target && hasAttr(el, "data-line") && codeBlockOf(el)) target = true;
    if (!target && terminalOf(el)) target = true;
    // An empty code line has no tween and appears with its block.
    if (target && hasAttr(el, "data-line") && codeBlockOf(el) && !hasAttr(el, "data-cue") && textContent(el).trim() === "") target = false;
    if (target) set.add(el);
  }
  return [...set];
}

/**
 * Resolve every beat, entrance, diagram step and camera move to absolute times.
 * `cueTimes` maps a cue name to seconds (resolveCues); `audioDuration` is A, so D = A + 0.6.
 */
export interface TagFade {
  t: number;
  from: number;
  to: number;
  d: number;
}

export const TAG_IN_AT = 0.2;
export const TAG_IN = 0.6;
export const TAG_OUT = 0.3;

/**
 * Opacity tweens for the ambient chapter tag. It fades in at 0.2 s and stays, except while a beat
 * whose primary block is `title` is on screen: it fades out as that beat enters and back in as the
 * next beat enters. A chapter that opens on a title keeps the tag hidden until the title leaves.
 */
export function tagFades(scene: Scene, beats: ResolvedBeat[]): TagFade[] {
  const isTitle = (i: number) => elementChildren(scene.beats[i]!.el).some((c) => getAttr(c, "data-block") === "title");
  const out: TagFade[] = [];
  let shown = false;
  if (!isTitle(0)) {
    out.push({ t: TAG_IN_AT, from: 0, to: 1, d: TAG_IN });
    shown = true;
  }
  for (let i = 1; i < beats.length; i++) {
    if (isTitle(i) && shown) {
      out.push({ t: beats[i]!.start, from: 1, to: 0, d: TAG_OUT });
      shown = false;
    } else if (!isTitle(i) && !shown) {
      out.push({ t: beats[i]!.start, from: 0, to: 1, d: TAG_IN });
      shown = true;
    }
  }
  return out;
}

export function resolveTimeline(scene: Scene, cueTimes: Record<string, number>, audioDuration: number, resolution?: Resolution): ResolvedTimeline {
  if (resolution) scene.root.resolution = resolution;
  const D = audioDuration + PADDING;
  const issues: SceneIssue[] = [];
  const warnings: SceneWarning[] = [];
  const cueTime = (el: HtmlElement): number | null => {
    const c = getAttr(el, "data-cue");
    if (typeof c !== "string") return null;
    if (!(c in cueTimes)) {
      issues.push(issue("E_UNKNOWN_CUE", el, `cue "${c}" has no {#${c}} marker in the script`));
      return null;
    }
    return cueTimes[c]!;
  };

  const starts = scene.beats.map((b, i) => (i === 0 ? 0 : (cueTime(b.el) ?? 0)));
  for (let i = 1; i < starts.length; i++) {
    if (!(starts[i]! > starts[i - 1]!)) {
      issues.push(issue("E_CUE_ORDER", scene.beats[i]!.el, `beat starts at ${starts[i]!.toFixed(2)} s, not after the previous beat (${starts[i - 1]!.toFixed(2)} s)`));
    }
  }
  const beats: ResolvedBeat[] = scene.beats.map((b, i) => {
    const last = i === scene.beats.length - 1;
    const start = starts[i]!;
    const end = last ? D : starts[i + 1]!;
    return {
      index: i,
      id: b.id,
      domId: `tr-beat-${i}`,
      start,
      end,
      unmount: last ? D : end + TRANSITION,
      fadeAt: last ? null : end,
      floor: i === 0 ? 0 : start + TRANSITION,
      camera: b.camera,
    };
  });
  for (const b of beats) if (b.start >= D) issues.push(issue("E_CUE_ORDER", scene.beats[b.index]!.el, `beat starts at ${b.start.toFixed(2)} s, after the chapter ends (${D.toFixed(2)} s)`));

  const targets: ResolvedTarget[] = [];
  const steps: ResolvedStep[] = [];
  const diagrams: ResolvedDiagram[] = [];
  const scrolls: ResolvedScroll[] = [];
  const grows: ResolvedGrow[] = [];
  const cursors: ResolvedCursor[] = [];
  const chips: ResolvedChip[] = [];

  scene.beats.forEach((b, bi) => {
    const rb = beats[bi]!;
    const list = beatTargets(b.el);
    const isTarget = new Set(list);
    const base = new Map<HtmlElement, number>();
    // Resolved entrance time of each target (its base plus any slot stagger).
    const entered = new Map<HtmlElement, number>();
    const nearestTargetAncestor = (el: HtmlElement): HtmlElement | null => {
      for (let p = el.parent; p && p !== b.el; p = p.parent) if (isTarget.has(p)) return p;
      return null;
    };
    const resolveBase = (el: HtmlElement): number => {
      const anc = nearestTargetAncestor(el);
      const ancT = anc ? base.get(anc)! : rb.start;
      const own = cueTime(el);
      if (own !== null && own < rb.start) {
        issues.push(issue("E_CUE_BEFORE_BEAT", el, `cue at ${own.toFixed(2)} s is before its beat "${b.id}" starts (${rb.start.toFixed(2)} s)`));
      }
      if (own !== null && own >= rb.end) {
        warnings.push({ line: el.line, message: `${describe(el)} enters at ${own.toFixed(2)} s, after its beat "${b.id}" ends (${rb.end.toFixed(2)} s)` });
      }
      const t = Math.max(own ?? ancT, ancT);
      return Math.max(t, rb.floor);
    };

    // Terminal lines chain inside their block (section 5a): each starts after the line before it.
    const terms = new Map<HtmlElement, { rows: number; prev: { t: number; duration: number; prompt: boolean } | null; cursor: ResolvedCursor | null }>();
    const terminalLineTime = (el: HtmlElement, block: HtmlElement, t0: number, anim: Anim, duration: number): number => {
      const st = terms.get(block) ?? { rows: 0, prev: null, cursor: null };
      terms.set(block, st);
      const blockT = entered.get(block) ?? base.get(block) ?? rb.floor;
      const p = st.prev;
      const next = !p ? blockT + TERM_OPEN : anim === "type" ? p.t + p.duration + TERM_THINK : p.prompt ? p.t + p.duration + TERM_ENTER : p.t + TERM_GAP;
      let t: number;
      if (hasAttr(el, "data-cue")) {
        t = t0;
        if (t < next - 1e-9) warnings.push({ line: el.line, message: `${describe(el)} is cued at ${t.toFixed(2)} s, before the line above it has finished (${next.toFixed(2)} s); the cue wins` });
      } else t = Math.max(next, t0);
      if (t + duration > rb.end + 1e-9 && !hasAttr(el, "data-cue")) {
        warnings.push({ line: el.line, message: `${describe(el)} finishes at ${(t + duration).toFixed(2)} s, after its beat "${b.id}" ends (${rb.end.toFixed(2)} s); add a cue or cut lines` });
      }
      const row = st.rows++;
      const rows = terminalRows(block);
      if (row >= rows) scrolls.push({ block, t, y: -(row - (rows - 1)) * geometryFor(block).terminal.rowHeight });
      // Grow just before the row fades in, never before the row above it entered.
      else if (row > 0) grows.push({ block, t: Math.max(st.prev?.t ?? t, t - TERM_GROW_LEAD), rows: row + 1 });
      if (st.cursor) st.cursor.hide = t;
      st.cursor = null;
      if (anim === "type") {
        st.cursor = { line: el, show: t + duration, hide: rb.unmount };
        cursors.push(st.cursor);
      }
      st.prev = { t, duration, prompt: anim === "type" };
      return t;
    };

    const slot = new Map<string, number>();
    let prev: ResolvedTarget | null = null;
    for (const el of list) {
      const t0 = resolveBase(el);
      base.set(el, t0);
      const animAttr = getAttr(el, "data-anim");
      const anim: Anim = typeof animAttr === "string" && (ANIMS as readonly string[]).includes(animAttr) ? (animAttr as Anim) : defaultAnim(el);
      const chars = Math.max(1, textContent(el).trim().length);
      const duration = anim === "type" ? typeDuration(chars) : ANIM_DURATION[anim];
      const code = anim === "type" ? codeBlockOf(el) : null;
      const term = terminalOf(el);
      let t: number;
      if (term) {
        t = terminalLineTime(el, term, t0, anim, duration);
      } else if (code && prev && prev.anim === "type" && codeBlockOf(prev.el) === code && prev.base === t0) {
        t = prev.t + prev.duration; // chained typing
      } else {
        const key = t0.toFixed(6);
        const n = slot.get(key) ?? 0;
        slot.set(key, n + 1);
        t = t0 + STAGGER * n;
      }
      const rt: ResolvedTarget = { el, beat: bi, anim, base: t0, t, duration };
      if (anim === "type") rt.chars = chars;
      targets.push(rt);
      entered.set(el, t);
      prev = rt;
    }

    let n = 0;
    for (const fig of descendants(b.el).filter((d) => getAttr(d, "data-block") === "diagram")) {
      diagrams.push({ figure: fig, beat: bi, renderId: `tr-d-${bi}-${n++}` });
      for (const st of descendants(fig).filter((d) => hasAttr(d, "data-step"))) {
        const t = resolveBase(st);
        const nodes = (getAttr(st, "data-nodes") ?? "").split(",").filter(Boolean);
        const edges = (getAttr(st, "data-edges") ?? "")
          .split(",")
          .filter(Boolean)
          .map((e) => e.split("-"))
          .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]);
        steps.push({ el: st, beat: bi, figure: fig, t, nodes, edges });
      }
    }

    // Pipeline chips: equal widths, so the k-th of n chips sits at k/(n-1) of the rail.
    for (const pl of descendants(b.el).filter((d) => getAttr(d, "data-block") === "pipeline")) {
      const blockT = entered.get(pl) ?? base.get(pl) ?? resolveBase(pl);
      const ol = elementChildren(pl).find((c) => c.tag === "ol");
      const list = ol ? elementChildren(ol).filter((c) => c.tag === "li") : [];
      let k = 0;
      list.forEach((chip, i) => {
        const fraction = list.length > 1 ? i / (list.length - 1) : 1;
        const done = hasAttr(chip, "data-done");
        const t = done ? blockT : hasAttr(chip, "data-cue") ? Math.max(resolveBase(chip), blockT) : blockT + STAGGER * k++;
        chips.push({ block: pl, chip, t, fraction, done });
      });
    }
  });

  return { duration: D, beats, targets, steps, diagrams, scrolls, grows, cursors, chips, issues, warnings };
}

/** Cue names used anywhere in the scene (beats, elements, steps). */
export function usedCues(scene: Scene): Set<string> {
  const out = new Set<string>();
  for (const el of descendants(scene.root)) {
    const c = getAttr(el, "data-cue");
    if (typeof c === "string") out.add(c);
  }
  return out;
}
