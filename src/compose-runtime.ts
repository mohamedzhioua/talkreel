// The browser side of timeline.js. The composer writes the resolved plan (every time already
// computed in Node by src/scene.ts and src/captions.ts) as window.__trPlan, followed by this
// runtime, which only turns the plan into one paused GSAP timeline. No clocks, no randomness,
// no network: all motion is on the timeline.
//
// Plain ES5-style JavaScript in a string, so it runs as a classic script and is written to the
// build directory verbatim.
import { portraitCamera } from "./geometry.js";

/** Keep the legacy landscape runtime byte-for-byte; constrain only portrait camera travel. */
export function portraitRuntime(runtime: string): string {
  const push = portraitCamera("push-in"), pan = portraitCamera("pan-left");
  return runtime
    .replace('scale: 1.04, duration: b.unmount - b.start, ease: "none"', `scale: ${push.to}, duration: b.unmount - b.start, ease: "none", immediateRender: false`)
    .replace('{ x: 24 }, { x: -24, duration: b.unmount - b.start, ease: "none"', `{ x: ${pan.from} }, { x: ${pan.to}, duration: b.unmount - b.start, ease: "none", immediateRender: false`);
}

/** All geometry, path control points and previous values are resolved in Node. */
export function deviceRuntime(runtime: string): string {
  return runtime.replace("    P.targets.forEach(function (x) {", `    function property(el, prop, from, to, t, d, ease) {
      var a = {}, b = { duration: d, ease: ease, immediateRender: false };
      a[prop] = from;
      b[prop] = to;
      tl.fromTo(el, a, b, t);
    }
    P.devices.forEach(function (device) {
      var camera = byId(device.camera), cursor = byId(device.cursor);
      // Apply each initial value synchronously; no initialization waits for a ticker frame.
      function initial(el, prop, value) {
        var state = { immediateRender: false, paused: true };
        state[prop] = value;
        window.gsap.set(el, state).progress(1).kill();
      }
      ["x", "y", "scale"].forEach(function (prop) {
        var value = prop === "scale" ? 1 : 0;
        initial(camera, prop, value);
      });
      ["x", "y", "opacity"].forEach(function (prop, axis) {
        var value = axis < 2 ? device.initial[axis] : 0;
        initial(cursor, prop, value);
      });
      device.zooms.forEach(function (z) {
        ["x", "y", "scale"].forEach(function (prop) {
          property(camera, prop, z.from[prop], z.to[prop], z.t, z.d, "power2.inOut");
        });
      });
      if (device.clicks.length) property(cursor, "opacity", 0, 1, device.clicks[0].start, 0.001, "none");
      device.clicks.forEach(function (c) {
        ["x", "y"].forEach(function (prop, axis) {
          var a = c.path[0][axis], control = c.path[1][axis], end = c.path[2][axis];
          // A unit span also handles paths whose endpoint equals their starting coordinate.
          var span = end - a || 1;
          property(cursor, prop, a, a + span, c.start, c.t - c.start, function (p) {
            var q = 1 - p;
            return (q * q * a + 2 * q * p * control + p * p * end - a) / span;
          });
        });
        var halo = byId(c.halo), target = byId(c.target);
        property(halo, "opacity", 0, 0.85, c.t, 0.001, "none");
        property(halo, "opacity", 0.85, 0, c.t + 0.001, 0.399, "power1.out");
        property(halo, "scale", 0.5, 1.6, c.t, 0.4, "power2.out");
        property(target, "opacity", 0, 1, c.t, 0.001, "none");
        property(target, "opacity", 1, 0, c.t + 0.12, 0.12, "power1.out");
        property(target, "scale", 1, 0.96, c.t, 0.08, "power2.out");
        property(target, "scale", 0.96, 1, c.t + 0.08, 0.16, "power2.out");
      });
    });

    P.targets.forEach(function (x) {`);
}

/** Only RTL pages receive the mirrored runtime; LTR output remains byte-identical. */
export function mirrorSlides(runtime: string): string {
  return runtime
    .replace("{ opacity: 0, x: 80 }", "{ opacity: 0, x: -80 }")
    .replace('tween("x", 80, 0,', 'tween("x", -80, 0,');
}

export const TIMELINE_RUNTIME = `(function () {
  "use strict";
  var P = window.__trPlan;
  var GEOM = "path,line,polyline,polygon,rect,circle,ellipse";

  function byId(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error("talkreel timeline: missing element #" + id);
    return el;
  }

  function geometry(el) {
    var out = el.matches && el.matches(GEOM) ? [el] : [];
    return out.concat(Array.prototype.slice.call(el.querySelectorAll(GEOM)));
  }

  function enter(tl, el, anim, t, duration, chars) {
    if (anim === "fade") {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" }, t);
    } else if (anim === "pop") {
      tl.fromTo(el, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, t);
    } else if (anim === "stream") {
      tl.fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.12, ease: "power1.out" }, t);
    } else if (anim === "slide") {
      tl.fromTo(el, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, t);
    } else if (anim === "type") {
      tl.fromTo(el, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: duration, ease: "steps(" + chars + ")" }, t);
    } else if (anim === "draw") {
      var parts = geometry(el);
      if (!parts.length) return enter(tl, el, "fade", t);
      parts.forEach(function (p) {
        var len = typeof p.getTotalLength === "function" ? p.getTotalLength() : 0;
        tl.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, t);
      });
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.001 }, t);
    } else {
      tl.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, t);
    }
  }

  function matching(root, selector, re) {
    return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
      return re.test(el.getAttribute("id") || "") || re.test(el.getAttribute("data-id") || "");
    });
  }

  async function renderDiagrams() {
    if (!P.diagrams.length) return;
    var cfg = (await import("./mermaid.mjs")).default;
    window.mermaid.initialize(cfg);
    for (var i = 0; i < P.diagrams.length; i++) {
      var d = P.diagrams[i];
      var host = byId(d.host);
      var source = host.previousElementSibling ? host.previousElementSibling.textContent : "";
      var out = await window.mermaid.render(d.renderId, source);
      host.innerHTML = out.svg;
    }
  }

  async function build() {
    await document.fonts.ready;
    await renderDiagrams();
    var tl = window.gsap.timeline({ paused: true });

    P.targets.forEach(function (x) {
      enter(tl, byId(x.id), x.anim, x.t, x.d, x.n);
    });

    P.steps.forEach(function (s) {
      var svg = byId(s.host).querySelector("svg");
      if (!svg) return;
      s.nodes.forEach(function (id) {
        var re = new RegExp("^" + s.renderId + "-flowchart-" + id + "-[0-9]+$");
        matching(svg, "g.node", re).forEach(function (g) { enter(tl, g, "pop", s.t); });
      });
      s.edges.forEach(function (e) {
        var re = new RegExp("^L_" + e[0] + "_" + e[1] + "_[0-9]+$");
        Array.prototype.slice.call(svg.querySelectorAll("path[data-id]")).forEach(function (p) {
          if (re.test(p.getAttribute("data-id")) && !p.closest("g.edgeLabel")) enter(tl, p, "draw", s.t);
        });
        Array.prototype.slice.call(svg.querySelectorAll("g.edgeLabel [data-id]")).forEach(function (l) {
          if (re.test(l.getAttribute("data-id"))) enter(tl, l.closest("g.edgeLabel") || l, "fade", s.t);
        });
      });
    });

    P.beats.forEach(function (b) {
      var el = byId(b.id);
      if (b.fadeAt !== null) tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in" }, b.fadeAt);
      if (b.camera === "push-in") tl.fromTo(el, { scale: 1 }, { scale: 1.04, duration: b.unmount - b.start, ease: "none" }, b.start);
      if (b.camera === "pan-left") tl.fromTo(el, { x: 24 }, { x: -24, duration: b.unmount - b.start, ease: "none" }, b.start);
    });

    P.lines.forEach(function (l) {
      var el = byId(l.id);
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.1 }, l.show);
      tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 0.08, immediateRender: false }, l.hide);
    });
    P.words.forEach(function (w) {
      var el = byId(w.id);
      tl.set(el, { attr: { "data-state": "current" } }, w.start);
      tl.set(el, { attr: { "data-state": "spoken" } }, w.end);
    });

    // Terminal scroll and pipeline rail: several tweens on one property, so each starts from the
    // explicit previous value and never renders early (seek order must not change a frame).
    var at = {};
    P.scrolls.forEach(function (s) {
      var el = byId(s.id);
      if (!(s.id in at)) { at[s.id] = 0; window.gsap.set(el, { y: 0 }); }
      tl.fromTo(el, { y: at[s.id] }, { y: s.y, duration: 0.15, ease: "power2.out", immediateRender: false }, s.t);
      at[s.id] = s.y;
    });
    var tall = {};
    P.grows.forEach(function (g) {
      var el = byId(g.id);
      if (!(g.id in tall)) { tall[g.id] = g.h0; window.gsap.set(el, { height: g.h0 }); }
      tl.fromTo(el, { height: tall[g.id] }, { height: g.h, duration: 0.15, ease: "power2.out", immediateRender: false }, g.t);
      tall[g.id] = g.h;
    });
    var rails = {};
    P.chips.forEach(function (c) { (rails[c.rail] = rails[c.rail] || []).push(c); });
    Object.keys(rails).forEach(function (id) {
      var el = byId(id);
      var list = rails[id].slice().sort(function (a, b) { return a.t - b.t || a.f - b.f; });
      var f = 0;
      list.forEach(function (c) { if (c.done) f = Math.max(f, c.f); });
      window.gsap.set(el, { scaleX: f });
      list.forEach(function (c) {
        var lit = byId(c.id);
        if (c.done) { window.gsap.set(lit, { opacity: 1 }); return; }
        tl.fromTo(lit, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out" }, c.t);
        if (c.f > f) {
          tl.fromTo(el, { scaleX: f }, { scaleX: c.f, duration: 0.5, ease: "power2.inOut", immediateRender: false }, c.t);
          f = c.f;
        }
      });
    });
    // A cursor is one tween from show to hide whose ease is a square wave: on, off, ... off.
    P.cursors.forEach(function (c) {
      var span = c.hide - c.show;
      if (span <= 0) return;
      tl.fromTo(byId(c.id), { opacity: 0 }, { opacity: 1, duration: span, ease: function (p) {
        if (p >= 1) return 0;
        return Math.floor((p * span) / 0.53) % 2 === 0 ? 1 : 0;
      } }, c.show);
    });
    if (P.ambient) {
      tl.fromTo("#tr-blob-a", { x: 0, y: 0, scale: 1 }, { x: -260, y: 140, scale: 1.15, duration: P.D, ease: "none" }, 0);
      tl.fromTo("#tr-blob-b", { x: 0, y: 0, scale: 1 }, { x: 240, y: -100, scale: 1.1, duration: P.D, ease: "none" }, 0);
      tl.fromTo("#tr-grid", { y: 0 }, { y: -Math.min(120, 4 * P.D), duration: P.D, ease: "none" }, 0);
      // The tag hides while a title beat is on screen (plan.tag, resolved in Node).
      window.gsap.set("#tr-tag", { opacity: 0 });
      P.tag.forEach(function (f, i) {
        var to = f.to === 1 && i === 0 ? { opacity: 1, x: 0 } : { opacity: f.to };
        var from = f.to === 1 && i === 0 ? { opacity: 0, x: -12 } : { opacity: f.from };
        tl.fromTo("#tr-tag", from, Object.assign(to, { duration: f.d, ease: "power2.out", immediateRender: false }), f.t);
      });
    }

    tl.set({}, {}, P.D);
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = tl;
    tl.seek(0);
    window.__hfTimelinesBuilding = false;
    window.dispatchEvent(new Event("hf-timelines-built"));
  }

  build().catch(function (e) {
    console.error("talkreel timeline failed: " + (e && e.stack ? e.stack : e));
  });
})();
`;

// Extend only figure pages: the image-free runtime remains byte-identical to M2.
// All figure entrance values and times come from the Node plan. Each tween owns one property.
export const FIGURE_TIMELINE_RUNTIME = TIMELINE_RUNTIME.replace("    P.targets.forEach(function (x) {", `    P.figures.forEach(function (x) {
      var el = byId(x.id);
      tl.set(el, { opacity: 0 }, 0);
      function tween(prop, from, to, ease) {
        var a = {}, b = { duration: x.d, ease: ease, immediateRender: false };
        a[prop] = from;
        b[prop] = to;
        tl.fromTo(el, a, b, x.t);
      }
      tween("opacity", 0, 1, "power1.out");
      if (x.anim === "fade-up" || x.anim === "stream") tween("y", x.anim === "stream" ? 6 : 40, 0, "power3.out");
      if (x.anim === "slide") tween("x", 80, 0, "power3.out");
      if (x.anim === "pop") tween("scale", 0.85, 1, "back.out(1.7)");
      if (x.anim === "type") tween("clipPath", "inset(0 100% 0 0)", "inset(0 0% 0 0)", "steps(" + x.n + ")");
    });

    P.targets.forEach(function (x) {`);
