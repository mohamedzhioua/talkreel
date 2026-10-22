// Scene files: parsing, the validation rules and the timeline resolution of
// skills/talkreel/references/scenes.md (sections 1-9). Pure functions, no I/O, so the rules are
// unit-testable without a browser.
import { classList, describe, descendants, elementChildren, getAttr, hasAttr, parseFragment, textContent, type HtmlElement } from "./compose-html.js";

export const TRANSITION = 0.3;
export const STAGGER = 0.12;
export const PADDING = 0.6;

export const ANIMS = ["fade-up", "fade", "pop", "type", "draw"] as const;
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

export interface StaticCheckOptions {
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

export interface ResolvedTimeline {
  duration: number;
  beats: ResolvedBeat[];
  targets: ResolvedTarget[];
  steps: ResolvedStep[];
  diagrams: ResolvedDiagram[];
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

function defaultAnim(el: HtmlElement): Anim {
  if (getAttr(el, "data-block") === "diagram") return "fade";
  if (hasAttr(el, "data-line") && codeBlockOf(el)) return "type";
  return "fade-up";
}

function typeDuration(chars: number): number {
  return Math.min(1.2, Math.max(0.3, 0.035 * chars));
}

const ANIM_DURATION: Record<Exclude<Anim, "type">, number> = { "fade-up": 0.6, fade: 0.6, pop: 0.5, draw: 0.8 };

/** The entrance targets of a beat, in document order (section 5, "Targets"). */
export function beatTargets(beat: HtmlElement): HtmlElement[] {
  const set = new Set<HtmlElement>();
  const direct = new Set(elementChildren(beat));
  for (const el of descendants(beat)) {
    if (isExcluded(el)) continue;
    let target = direct.has(el) || hasAttr(el, "data-cue") || hasAttr(el, "data-anim");
    if (!target && el.tag === "li" && blockOf(el) === "list") target = true;
    if (!target && hasAttr(el, "data-line") && codeBlockOf(el)) target = true;
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
export function resolveTimeline(scene: Scene, cueTimes: Record<string, number>, audioDuration: number): ResolvedTimeline {
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

  scene.beats.forEach((b, bi) => {
    const rb = beats[bi]!;
    const list = beatTargets(b.el);
    const isTarget = new Set(list);
    const base = new Map<HtmlElement, number>();
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
      let t: number;
      if (code && prev && prev.anim === "type" && codeBlockOf(prev.el) === code && prev.base === t0) {
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
  });

  return { duration: D, beats, targets, steps, diagrams, issues, warnings };
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
