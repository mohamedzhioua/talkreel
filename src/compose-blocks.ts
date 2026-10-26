// Page structure for the terminal and pipeline blocks (scenes.md section 5a). The composer adds
// the window chrome, the scroll track, the cursors, the rail and the lit chip layers; every time
// was already resolved in compose-scene.ts, so this only writes nodes and plan entries.
import { elementChildren, escapeText, geometryFor, getAttr, hasAttr, setAttr, textContent, type HtmlElement, type HtmlNode } from "./compose-html.js";
import { targetRect, terminalRows, type ResolvedTimeline } from "./compose-scene.js";

/** Viewport padding above and below the rows (theme.css .tr-term-vp). */
const TERM_PAD_PX = 24;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface BlocksPlan {
  /** Image-block entrances only; omitted on legacy pages to preserve their bytes. */
  figures?: { id: string; anim: string; t: number; d: number; n?: number }[];
  devices?: {
    camera: string; cursor: string; initial: [number, number];
    raster: string; width: number; height: number;
    zooms: { t: number; d: number; from: { x: number; y: number; scale: number }; to: { x: number; y: number; scale: number } }[];
    clicks: { target: string; halo: string; t: number; start: number; path: [number, number][] }[];
  }[];
  scrolls: { id: string; t: number; y: number }[];
  /** Viewport heights in px: `h0` before the first grow, then `h` from `t`. */
  grows: { id: string; t: number; h: number; h0: number }[];
  cursors: { id: string; show: number; hide: number }[];
  chips: { id: string; rail: string; t: number; f: number; done: boolean }[];
}

/** These image blocks use the deterministic single-property entrance runtime. */
export function imageEntrance(el: HtmlElement): boolean {
  for (let p: HtmlElement | null = el; p; p = p.parent) {
    if (["figure", "device", "cta"].includes(getAttr(p, "data-block") ?? "")) return true;
  }
  return false;
}

function el(tag: string, attrs: Record<string, string>, parent: HtmlElement, children: HtmlNode[] = []): HtmlElement {
  const e: HtmlElement = { type: "element", tag, attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })), children, parent, line: parent.line };
  for (const c of children) c.parent = e;
  return e;
}

function raw(parent: HtmlElement, html: string): HtmlNode {
  return { type: "text", raw: html, parent, line: parent.line };
}

/** Is this a terminal prompt line? */
export function isTerminalPrompt(p: HtmlElement): boolean {
  return p.tag === "p" && hasAttr(p, "data-prompt") && !!p.parent && getAttr(p.parent, "data-block") === "terminal";
}

/**
 * Move a prompt line's text into `<span class="tr-typed">` so the prompt glyph stays visible
 * while only the text types in. Returns the span (the `type` target).
 */
export function wrapTyped(p: HtmlElement): HtmlElement {
  const span = el("span", { class: "tr-typed" }, p, p.children);
  p.children = [span];
  return span;
}

/** Add chrome, tracks, cursors, rails and lit layers; returns their plan entries. */
export function buildBlocks(tl: ResolvedTimeline, idFor: (e: HtmlElement) => string): BlocksPlan {
  const plan: BlocksPlan = { scrolls: [], grows: [], cursors: [], chips: [] };
  const figures = tl.targets.filter((t) => imageEntrance(t.el));
  if (figures.length) plan.figures = figures.map((t) => ({ id: idFor(t.el), anim: t.anim, t: r3(t.t), d: r3(t.duration), ...(t.chars !== undefined ? { n: t.chars } : {}) }));

  if (tl.devices?.length) plan.devices = tl.devices.map((d) => {
    const image = elementChildren(d.block).find((c) => c.tag === "img")!;
    const targets = elementChildren(d.block).filter((c) => hasAttr(c, "data-target"));
    for (const target of targets) {
      const [x, y, width, height] = targetRect(target);
      setAttr(target, "style", `left:${x}%;top:${y}%;width:${width}%;height:${height}%`);
    }
    setAttr(d.block, "style", `--tr-device-width:${d.width}px;--tr-device-height:${d.height}px`);
    const vp = el("div", { class: "tr-device-vp" }, d.block);
    // Paint at viewport resolution rather than letting Chrome cache a transformed <img>.
    // Round the backing store up; CSS keeps its pixels 1:1 and the viewport clips the excess.
    const raster = el("canvas", { class: "tr-device-raster", width: String(Math.ceil(d.width)), height: String(Math.ceil(d.height)), "aria-hidden": "true" }, vp);
    // Targets, cursor and halos move with the camera inside one unscaled composited layer above
    // the screenshot (theme.css): the camera's scale is painted into that layer, never applied to it.
    const overlay = el("div", { class: "tr-device-overlay" }, vp);
    const camera = el("div", { class: "tr-device-camera" }, overlay, [image, ...targets]);
    overlay.children = [camera];
    const initial: [number, number] = d.clicks[0]?.path[0] ?? [0, 0];
    const cursor = el("i", { class: "tr-agent-cursor", "aria-hidden": "true" }, camera);
    camera.children.push(cursor);
    vp.children = [raster, overlay];
    const clicks = d.clicks.map((c) => {
      const end = c.path[2]!;
      const halo = el("i", { class: "tr-click-halo", "aria-hidden": "true", style: `left:${end[0]}px;top:${end[1]}px` }, camera);
      camera.children.push(halo);
      return { target: idFor(c.target), halo: idFor(halo), t: r3(c.t), start: r3(c.start), path: c.path };
    });
    d.block.children = [vp];
    return { camera: idFor(camera), cursor: idFor(cursor), initial, raster: idFor(raster), width: d.width, height: d.height, zooms: d.zooms.map((z) => ({ t: r3(z.t), d: r3(z.d), from: z.from, to: z.to })), clicks };
  });

  const trackOf = new Map<HtmlElement, string>();
  const vpOf = new Map<HtmlElement, string>();
  const terminals = new Set<HtmlElement>();
  for (const t of tl.targets) {
    if (getAttr(t.el, "data-block") === "terminal") terminals.add(t.el);
    else if (t.el.parent && getAttr(t.el.parent, "data-block") === "terminal") terminals.add(t.el.parent);
  }
  for (const block of terminals) {
    const lines = block.children;
    const title = getAttr(block, "data-title");
    block.attrs.push({ name: "style", value: `--rows:${terminalRows(block)}` });
    // The block keeps its full height so the layout never moves; the window inside it grows.
    const win = el("div", { class: "tr-term-win" }, block);
    const vp = el("div", { class: "tr-term-vp" }, win);
    const track = el("div", { class: "tr-term-track" }, vp, lines);
    vp.children = [track];
    trackOf.set(block, idFor(track));
    vpOf.set(block, idFor(vp));
    const bar = raw(win, `<div class="tr-term-bar"><i></i><i></i><i></i>${title ? `<span>${escapeText(title)}</span>` : ""}</div>`);
    win.children = [bar, vp];
    block.children = [win];
  }
  for (const s of tl.scrolls) plan.scrolls.push({ id: trackOf.get(s.block)!, t: r3(s.t), y: s.y });
  for (const g of tl.grows) {
    const rowHeight = geometryFor(g.block).terminal.rowHeight;
    plan.grows.push({ id: vpOf.get(g.block)!, t: r3(g.t), h: g.rows * rowHeight + 2 * TERM_PAD_PX, h0: rowHeight + 2 * TERM_PAD_PX });
  }
  for (const c of tl.cursors) {
    const cursor = el("span", { class: "tr-cursor" }, c.line);
    c.line.children.push(cursor);
    plan.cursors.push({ id: idFor(cursor), show: r3(c.show), hide: r3(c.hide) });
  }

  const railOf = new Map<HtmlElement, string>();
  for (const c of tl.chips) {
    let rail = railOf.get(c.block);
    if (!rail) {
      const fill = el("i", { class: "tr-rail-fill" }, c.block);
      const track = el("div", { class: "tr-rail" }, c.block, [fill]);
      c.block.attrs.push({ name: "style", value: `--n:${tl.chips.filter((x) => x.block === c.block).length}` });
      c.block.children.unshift(track);
      rail = idFor(fill);
      railOf.set(c.block, rail);
    }
    const lit = el("span", { class: "tr-chip-lit", "aria-hidden": "true" }, c.chip, [raw(c.chip, escapeText(textContent(c.chip).trim()))]);
    c.chip.children.push(lit);
    plan.chips.push({ id: idFor(lit), rail, t: r3(c.t), f: r3(c.fraction), done: c.done });
  }
  return plan;
}
