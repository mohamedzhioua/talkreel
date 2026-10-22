// The browser side of timeline.js. The composer writes the resolved plan (every time already
// computed in Node by src/scene.ts and src/captions.ts) as window.__trPlan, followed by this
// runtime, which only turns the plan into one paused GSAP timeline. No clocks, no randomness,
// no network: all motion is on the timeline.
//
// Plain ES5-style JavaScript in a string, so it runs as a classic script and is written to the
// build directory verbatim.
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
