// A small HTML fragment parser and serializer for scene files (no dependency).
//
// Scenes are hand-written, well-formed fragments, so this parser is deliberately simple: tags,
// attributes, text, comments and declarations, with void elements and raw-text elements
// (script, style) handled. Text is kept raw so serializing an unchanged tree gives back the
// same markup; attribute values are stored decoded and re-escaped on output.

export interface HtmlAttr {
  name: string;
  /** Decoded value, or null for a bare attribute (`<i data-step>`). */
  value: string | null;
}

export interface HtmlElement {
  type: "element";
  tag: string;
  attrs: HtmlAttr[];
  children: HtmlNode[];
  parent: HtmlElement | null;
  /** 1-based line of the opening tag. */
  line: number;
}

export interface HtmlText {
  type: "text";
  raw: string;
  parent: HtmlElement | null;
  line: number;
}

export interface HtmlComment {
  type: "comment" | "decl";
  raw: string;
  parent: HtmlElement | null;
  line: number;
}

export type HtmlNode = HtmlElement | HtmlText | HtmlComment;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body] ?? m;
  });
}

export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Parse a fragment. The returned root is a synthetic element with tag "#root". */
export function parseFragment(src: string): HtmlElement {
  const root: HtmlElement = { type: "element", tag: "#root", attrs: [], children: [], parent: null, line: 1 };
  const stack: HtmlElement[] = [root];
  let i = 0;
  let line = 1;
  const top = () => stack[stack.length - 1]!;
  const advance = (to: number) => {
    for (let k = i; k < to; k++) if (src.charCodeAt(k) === 10) line++;
    i = to;
  };
  const add = (n: HtmlNode) => {
    n.parent = top();
    top().children.push(n);
  };

  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end < 0 ? src.length : end + 3;
      const node: HtmlComment = { type: "comment", raw: src.slice(i, stop), parent: null, line };
      add(node);
      advance(stop);
      continue;
    }
    if (src.startsWith("<!", i) || src.startsWith("<?", i)) {
      const end = src.indexOf(">", i);
      const stop = end < 0 ? src.length : end + 1;
      add({ type: "decl", raw: src.slice(i, stop), parent: null, line });
      advance(stop);
      continue;
    }
    if (src.startsWith("</", i)) {
      const m = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>/.exec(src.slice(i));
      if (m) {
        const tag = m[1]!.toLowerCase();
        const at = stack.map((e) => e.tag).lastIndexOf(tag);
        if (at > 0) stack.length = at;
        advance(i + m[0].length);
        continue;
      }
    }
    if (src[i] === "<" && /[A-Za-z]/.test(src[i + 1] ?? "")) {
      const startLine = line;
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9-]/.test(src[j]!)) j++;
      const tag = src.slice(i + 1, j).toLowerCase();
      const attrs: HtmlAttr[] = [];
      let selfClose = false;
      for (;;) {
        while (j < src.length && /\s/.test(src[j]!)) j++;
        if (j >= src.length) break;
        if (src[j] === ">") {
          j++;
          break;
        }
        if (src.startsWith("/>", j)) {
          selfClose = true;
          j += 2;
          break;
        }
        if (src[j] === "/") {
          j++;
          continue;
        }
        let k = j;
        while (k < src.length && !/[\s"'>/=]/.test(src[k]!)) k++;
        if (k === j) k++; // a stray quote: skip one char so the loop advances
        const name = src.slice(j, k).toLowerCase();
        j = k;
        while (j < src.length && /\s/.test(src[j]!)) j++;
        let value: string | null = null;
        if (src[j] === "=") {
          j++;
          while (j < src.length && /\s/.test(src[j]!)) j++;
          const q = src[j];
          if (q === '"' || q === "'") {
            const end = src.indexOf(q, j + 1);
            const stop = end < 0 ? src.length : end;
            value = decodeEntities(src.slice(j + 1, stop));
            j = stop + 1;
          } else {
            let e = j;
            while (e < src.length && !/[\s>]/.test(src[e]!)) e++;
            value = decodeEntities(src.slice(j, e));
            j = e;
          }
        }
        if (name && /^[^"'<]/.test(name)) attrs.push({ name, value });
      }
      const el: HtmlElement = { type: "element", tag, attrs, children: [], parent: null, line: startLine };
      add(el);
      advance(Math.min(j, src.length));
      if (RAW_TEXT.has(tag) && !selfClose) {
        const close = src.toLowerCase().indexOf(`</${tag}`, i);
        const stop = close < 0 ? src.length : close;
        if (stop > i) {
          const t: HtmlText = { type: "text", raw: src.slice(i, stop), parent: el, line };
          el.children.push(t);
        }
        advance(stop);
        const m = /^<\/[A-Za-z0-9-]+\s*>/.exec(src.slice(i));
        if (m) advance(i + m[0].length);
        continue;
      }
      if (!selfClose && !VOID.has(tag)) stack.push(el);
      continue;
    }
    // Text up to the next tag-like "<".
    let next = src.indexOf("<", i + 1);
    while (next >= 0 && !/[A-Za-z!/?]/.test(src[next + 1] ?? "")) next = src.indexOf("<", next + 1);
    const stop = next < 0 ? src.length : next;
    add({ type: "text", raw: src.slice(i, stop), parent: null, line });
    advance(stop);
  }
  return root;
}

export function getAttr(el: HtmlElement, name: string): string | null | undefined {
  const a = el.attrs.find((x) => x.name === name);
  return a === undefined ? undefined : a.value;
}

export function hasAttr(el: HtmlElement, name: string): boolean {
  return el.attrs.some((x) => x.name === name);
}

export function setAttr(el: HtmlElement, name: string, value: string | null): void {
  const a = el.attrs.find((x) => x.name === name);
  if (a) a.value = value;
  else el.attrs.push({ name, value });
}

export function classList(el: HtmlElement): string[] {
  return (getAttr(el, "class") ?? "").split(/\s+/).filter(Boolean);
}

export function elementChildren(el: HtmlElement): HtmlElement[] {
  return el.children.filter((c): c is HtmlElement => c.type === "element");
}

/** Every descendant element in document order (not including `el`). */
export function descendants(el: HtmlElement): HtmlElement[] {
  const out: HtmlElement[] = [];
  const walk = (e: HtmlElement) => {
    for (const c of e.children) {
      if (c.type !== "element") continue;
      out.push(c);
      walk(c);
    }
  };
  walk(el);
  return out;
}

export function textContent(n: HtmlNode): string {
  if (n.type === "text") return n.parent && RAW_TEXT.has(n.parent.tag) ? n.raw : decodeEntities(n.raw);
  if (n.type !== "element") return "";
  return n.children.map(textContent).join("");
}

export function serialize(n: HtmlNode): string {
  if (n.type !== "element") return n.raw;
  const inner = n.children.map(serialize).join("");
  if (n.tag === "#root") return inner;
  const attrs = n.attrs.map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${escapeAttr(a.value)}"`)).join("");
  if (VOID.has(n.tag)) return `<${n.tag}${attrs}>`;
  return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}

/** Short description of an element for error messages: `<div data-block="stat">`. */
export function describe(el: HtmlElement): string {
  const keys = ["data-beat", "data-block", "data-cue", "data-anim", "data-step", "id", "class"];
  const shown = el.attrs.filter((a) => keys.includes(a.name));
  const attrs = shown.map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${a.value}"`)).join("");
  return `<${el.tag}${attrs}>`;
}
