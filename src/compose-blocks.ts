// Page structure for the terminal and pipeline blocks (scenes.md section 5a). The composer adds
// the window chrome, the scroll track, the cursors, the rail and the lit chip layers; every time
// was already resolved in compose-scene.ts, so this only writes nodes and plan entries.
import { escapeText, geometryFor, getAttr, hasAttr, textContent, type HtmlElement, type HtmlNode } from "./compose-html.js";
import { terminalRows, type ResolvedTimeline } from "./compose-scene.js";

/** Viewport padding above and below the rows (theme.css .tr-term-vp). */
const TERM_PAD_PX = 24;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface BlocksPlan {
  scrolls: { id: string; t: number; y: number }[];
  /** Viewport heights in px: `h0` before the first grow, then `h` from `t`. */
  grows: { id: string; t: number; h: number; h0: number }[];
  cursors: { id: string; show: number; hide: number }[];
  chips: { id: string; rail: string; t: number; f: number; done: boolean }[];
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
