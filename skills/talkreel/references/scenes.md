# Scenes: the authoring contract

This file is the specification for two readers:

- **the skill**, when it writes `scenes/NN-<chapter>.html`;
- **the composer** (`src/compose.ts`), which turns a scene, the captions and the
  audio into a HyperFrames page at `build/<lang>/NN/index.html`.

The block catalogue (markup, classes, text limits) is in
`${CLAUDE_PLUGIN_ROOT}/themes/default/blocks.md`, with one example scene per
block in `themes/default/examples/`. The rules below are normative: where this
file says "error", the composer stops with exit code 1 and a message naming the
scene file, the rule id and the offending element.

## 1. Files

- One scene per chapter: `talks/<slug>/scenes/NN-<name>.html`, where `NN-<name>`
  matches the script file `script/<lang>/NN-<name>.md`. Every language uses the
  same scene file.
- A scene is an HTML **fragment**: no `<!doctype>`, `<html>`, `<head>` or
  `<body>`.
- At the top level it contains only `<section data-beat>` elements, whitespace
  and HTML comments. Anything else is error `E_TOP_LEVEL`.

## 2. Beats

A beat is one full screen of content. Beats replace one another; only one is
on screen at a time, apart from the transition.

| Attribute | Required | Value | Meaning |
|---|---|---|---|
| `data-beat` | yes | `[a-z0-9][a-z0-9-]*`, unique in the file | Beat id (`E_BEAT_ID`) |
| `data-cue` | every beat except the first | a cue name | The beat starts at this cue |
| `data-camera` | no | `none` (default), `push-in`, `pan-left` | Slow camera move over the beat's life (`E_BAD_CAMERA`) |
| `data-align` | no | `center` | Centre the beat's children instead of left-aligning them |

- The **first** beat starts at 0 s and must not have `data-cue`
  (`E_FIRST_BEAT_CUE`). Every later beat must have one (`E_BEAT_NO_CUE`).
- Beat start times must strictly increase in document order (`E_CUE_ORDER`).

## 3. Cues: the only timing

Scenes never contain seconds. Time comes from cue markers in the script.

- In the script, `{#name}` sits between words, directly before the first word
  of the phrase where the picture should change: `… in minutes. {#doubt}But who
  checks it?` Names match `[a-z0-9][a-z0-9-]*` and are unique per script file
  (duplicate: `E_DUP_CUE`).
- In the scene, `data-cue="name"` on an element means "this element enters when
  the narration reaches `{#name}`".

**Cue resolution rule.** Let `words` be the caption words of the chapter
(`captions/<lang>/NN.json`, in order). The script parser that strips markers
before TTS also records, for each cue, `k` = the number of spoken words that
precede the marker; spoken words are the same whitespace-separated tokens that
become caption words, so word `k` of the script is `words[k]`.

```
time(cue) = words[k].start              if k < words.length
          = words[words.length-1].end   if the marker is after the last word
```

`words[k].start` is used even when `words[k].matched` is false (its time was
interpolated by the align stage). A `data-cue` that names no marker in the
script is `E_UNKNOWN_CUE`. A marker that no scene element uses is a warning.

## 4. Chapter timing

- `A` = audio duration (from the WAV); chapter duration `D = A + 0.6`.
- `TRANSITION = 0.3` s.
- Beat `i` starts at `start(i)` = 0 for the first beat, `time(data-cue)`
  otherwise. Its end is `end(i) = start(i+1)` for every beat but the last, and
  `D` for the last.
- **Transition.** At `start(i+1)` the outgoing beat fades out (opacity 1 to 0
  over `TRANSITION`, ease `power1.in`), so it stays mounted until
  `start(i+1) + TRANSITION`. The incoming beat's contents start entering only
  once the outgoing beat is gone (see the entry floor below), so two beats'
  text never overlap. The beat section itself has no entrance of its own.

## 5. Entrances

**Targets.** In each beat these elements get an entrance, in document order:

1. every direct child of the beat;
2. every descendant with `data-cue` or `data-anim`;
3. every `li` of a `list` block and every `[data-line]` of a `code` block.

`[data-step]` markers, `[data-mermaid]` sources and composer-inserted nodes
(`.tr-source`, `.tr-mermaid`) are never targets. A `.tr-source` enters with its
block.

**Time of a target**, computed in this order:

1. `own` = `time(data-cue)` if it has one, else the time of its nearest
   ancestor target, else the beat start.
2. Nesting: a target never enters before its nearest ancestor target:
   `t = max(own, ancestorTime)`.
3. Entry floor: `t = max(t, floor)`, where `floor = 0` for the first beat and
   `start(i) + TRANSITION` for every later beat.
4. An element cue earlier than its own beat's start is error
   `E_CUE_BEFORE_BEAT`, because it signals an authoring mistake.
5. Stagger: targets in the same beat whose `t` is equal after step 3 are
   ordered by document order; the n-th (n = 0, 1, …) is offset by `0.12 × n` s.
   Exception: consecutive `type` targets in the same `code` block chain
   instead, each starting when the previous one ends.

**Animation** (`data-anim`, default per table; unknown value: `E_BAD_ANIM`). All
are GSAP `fromTo` tweens at absolute position `t` on the chapter timeline:

| `data-anim` | From → to | Duration | Ease | Default for |
|---|---|---|---|---|
| `fade-up` | opacity 0, y 40 → opacity 1, y 0 | 0.6 | `power3.out` | everything not listed below |
| `fade` | opacity 0 → 1 | 0.6 | `power1.out` | `diagram` blocks, edge labels |
| `pop` | opacity 0, scale 0.85 → opacity 1, scale 1 | 0.5 | `back.out(1.7)` | diagram nodes |
| `type` | clipPath `inset(0 100% 0 0)` → `inset(0 0% 0 0)` | `clamp(0.035 × n, 0.3, 1.2)` | `steps(n)` | code `[data-line]` |
| `draw` | each SVG `path, line, polyline, polygon, rect, circle, ellipse` in or equal to the target: strokeDasharray = L, strokeDashoffset L → 0, with L = `getTotalLength()`; the target's opacity is set to 1 at `t` | 0.8 | `power2.inOut` | diagram edges |
| `stream` | opacity 0, y 6 → opacity 1, y 0 | 0.12 | `power1.out` | terminal rows other than prompts |
| `slide` | opacity 0, x 80 → opacity 1, x 0 | 0.6 | `power3.out` | none (opt in) |

`n` is the length of the target's trimmed `textContent` (minimum 1); an empty
code line has no tween and appears with its block. `draw` on an element with no
SVG geometry falls back to `fade`.

## 5a. Terminal and pipeline timing

These rules replace the stagger of section 5 for terminal rows and pipeline
chips. Every time is resolved in Node (`src/compose-scene.ts`); the page only
plays tweens, so check and render can never disagree.

**Terminal rows** (`<p>` children of `[data-block="terminal"]`) are targets.
Let `w` be the terminal's own entrance time and `prev` the row above:

| Row | Start |
|---|---|
| first row, no cue | `w + 0.3` |
| prompt (`data-prompt`), no cue | `prev.t + prev.duration + 0.4` |
| other row after a prompt, no cue | `prev.t + prev.duration + 0.25` |
| other row after a non-prompt, no cue | `prev.t + 0.07` |
| row with `data-cue` | `max(cue, beat floor)`; a cue earlier than the chained time warns, and the cue wins |

- A prompt types its text only (the `>` or `$` glyph appears with the row), with
  the `type` duration of section 5. Other rows `stream`.
- A cursor blinks (0.53 s on, 0.53 s off) from the end of a prompt's typing
  until the next row starts, or until the beat unmounts.
- The window opens one row tall. Row `i` (0-based) with `0 < i < rows`
  (`rows = data-rows`, default 13) grows the viewport to `(i + 1) * 40 + 48` px at
  the row's start; row `i >= rows` scrolls the content to
  `y = -(i - (rows - 1)) * 40` px instead (both 0.15 s tweens). The block keeps
  the final height, so the layout never moves.
- A row without a cue that ends after its beat ends warns.

**Pipeline chips** (`<li>` of `[data-block="pipeline"] > ol`) are never targets;
they are always on screen and light up. For the k-th of n chips (0-based) the
rail fraction is `k / (n - 1)`:

| Chip | Lights at |
|---|---|
| `data-done` | the pipeline's entrance, without a pop; the rail starts at the last done chip |
| `data-cue` | `max(cue, pipeline entrance)` |
| neither | the pipeline's entrance, staggered 0.12 s per such chip |

When a chip lights, its lit layer pops in (0.4 s) and the rail tweens to that
chip's fraction (0.5 s) if it is further than the rail already is.

## 6. Camera

On a beat with `data-camera`, one tween runs from `start(i)` to the moment the
beat unmounts (`end(i) + TRANSITION`, or `D` for the last beat), ease `none`,
`transform-origin` from the theme (centre of the safe area):

| Value | Tween |
|---|---|
| `push-in` | scale 1 → 1.04 |
| `pan-left` | x +24 → −24 px |
| `none` | no tween |

## 7. Diagram steps

- The composer inserts `<div class="tr-mermaid"></div>` right after the
  `[data-mermaid]` element and renders into it with
  `mermaid.render("tr-d-<beatIndex>-<n>", source)` after
  `await document.fonts.ready`. `mermaid.initialize()` gets the default export
  of `themes/default/mermaid.mjs` (it sets `deterministicIds`).
- Each `<i data-step>` resolves to a time like any target, except that steps
  are not staggered: every part of one step starts at the step's `t`.
- `data-nodes="A,B"`: node `A` is the `g.node` whose id matches
  `^<renderId>-flowchart-A-\d+$`. It enters with `pop`.
- `data-edges="A-B"`: every `path` whose `data-id` matches `^L_A_B_\d+$`. They
  enter with `draw`. Edge labels whose `[data-id]` matches the same pattern
  (inside `g.edgeLabel`) enter with `fade` at the same `t`.
- Parts named in any step are hidden (opacity 0) from 0 s until their step.
  Parts named in no step appear with the figure.
- Before rendering, the composer checks every node id in `data-nodes` and both
  ends of every `data-edges` pair against the Mermaid source text: an id must
  occur in it as a whole word, or it is `E_STEP_UNKNOWN`.
- Verified against `mermaid@12.2.0` (`flowchart`, `htmlLabels: false`): nodes
  `tr-diagram-0-flowchart-S-0`, edges `data-id="L_S_V_0"`, edge labels
  `data-id="L_Q_R_0"`. Pin that version; the selectors depend on it.

## 8. Sources

`data-source="s:<id>"` is allowed on `stat`, `quote` (both required, otherwise
`E_SOURCE_MISSING`) and `definition` (optional); anywhere else it is
`E_SOURCE_PLACE`. An id not in `sources.json` is `E_UNKNOWN_SOURCE`. The
composer appends to the block, as its last child:

```html
<p class="tr-source">Source: {title} · {host} · {year}</p>
```

`title` is the entry's title, `host` the URL hostname without a leading `www.`,
and `year` the first four characters of `date`. Missing parts are left out
together with their separator. Text is HTML-escaped.

## 9. Forbidden in scene files

These break HyperFrames' determinism or the theme. Each is `E_FORBIDDEN`:

- `<script>`, `<style>`, `<link>`, `<iframe>`, `<img>`, `<video>`, `<audio>`,
  `<object>`, `<embed>` (media in scenes is out of scope for M1);
- any `on*` event-handler attribute, and any `style` attribute (the look
  belongs to the theme);
- any `http:`, `https:` or protocol-relative `//` URL in an attribute;
- timing attributes: `data-start`, `data-duration`, `data-track-index`,
  `data-delay`, `data-at` (time comes only from cues);
- `class="clip"` and ids starting with `tr-` (both reserved for the composer).

The composer's generated page follows the same determinism rules: no
`Math.random`, no `Date.now` / `new Date()`, no `performance.now`, no network
URLs, no timers that drive animation. All motion is on the one paused timeline.

## 10. The generated page (composer output)

```html
<!doctype html>
<html lang="{lang}" data-resolution="landscape">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080">
  <link rel="stylesheet" href="theme.css">
  <script src="vendor/gsap.min.js"></script>
  <script src="vendor/mermaid.min.js"></script>  <!-- only when the scene has a diagram -->
</head>
<body>
  <div id="tr-root" class="tr-root" data-composition-id="main"
       data-start="0" data-duration="{D}" data-width="1920" data-height="1080">
    <div class="tr-stage">
      <!-- each beat, with its markup unchanged, plus: -->
      <section data-beat="…" id="tr-beat-{i}" class="clip"
               data-start="{start(i)}" data-duration="{mounted length}" data-track-index="1">…</section>
    </div>
    <div class="tr-captions clip" data-start="0" data-duration="{D}" data-track-index="2">
      <div class="tr-cap-line" id="tr-cap-{j}"><span class="tr-word" id="tr-w-{k}">An</span> …</div>
    </div>
    <audio id="tr-narration" src="assets/narration.wav" data-start="0"
           data-duration="{A}" data-track-index="3" data-volume="1"></audio>
  </div>
  <script src="timeline.js"></script>
</body>
</html>
```

`timeline.js` sets `window.__hfTimelinesBuilding = true` synchronously, awaits
fonts and any Mermaid renders, builds one `gsap.timeline({ paused: true })` with
every tween above, adds `tl.set({}, {}, D)`, registers
`window.__timelines["main"] = tl`, then sets
`window.__hfTimelinesBuilding = false` and dispatches
`window.dispatchEvent(new Event("hf-timelines-built"))`. HyperFrames 0.8.185
waits for that event before capturing (verified in the theme preview).
Numbers are written with at most 3 decimals.

**Captions** (composer-owned, styled by the theme):

- Lines: at most 48 characters (spaces included); always break after a word
  ending in `.`, `?` or `!`, and before a word that starts more than 0.6 s
  after the previous word ended. Inside each such segment the breaks are the
  cheapest under a fixed cost (`src/compose-captions.ts`): fill lines, prefer
  breaking after `,` `;` or `:`, never end a line on a function word (a, an,
  the, to, of, and, or, toward, for, with, in, on, this, that, its, it, what,
  while, their, our, your, my, is, are, be, by, from, as, at, into, than),
  never split a hyphenated compound at its hyphen, avoid a short fragment
  (under 14 characters, e.g. "My rule:") and a lone last word. A line may
  reach 54 characters only to absorb a lone word that cannot be balanced.
- A line shows (opacity 0 → 1 over 0.1 s) at its first word's `start − 0.05`
  and hides (opacity 0 over 0.08 s) at its last word's `end + 0.3`, or 0.08 s
  before the next line's show time if that comes first, so the outgoing line
  is gone before the next one fades in.
- Word state is the `data-state` attribute, driven by
  `tl.set(word, { attr: { "data-state": "current" } }, w.start)` and
  `tl.set(word, { attr: { "data-state": "spoken" } }, w.end)`. No attribute
  means upcoming (dimmed). The text is the caption word's `text` (script
  spelling).

## 11. Worked example

Script `script/en/02-verification.md` (heading and markers are not spoken):

```markdown
# Verification beats vibes

An assistant can draft a feature in minutes. {#doubt}But who checks it?
{#stat}In one survey, 46% of developers said they distrust the accuracy of AI
tools. [s:example-survey] {#loop}So I work in a loop. {#spec}Write the spec,
{#tests}run the tests, {#review}and let a fresh model review the diff.
```

Spoken words are numbered from 0: `An`(0) … `minutes.`(7), `But`(8) …
`it?`(11), `In`(12) … `tools.`(25), `So`(26) … `loop.`(31), `Write`(32) …
`spec,`(34), `run`(35) … `tests,`(37), `and`(38) … `diff.`(45). So the cue word
indices are doubt 8, stat 12, loop 26, spec 32, tests 35, review 38.

Scene `scenes/02-verification.html`:

```html
<section data-beat="open" data-camera="push-in">
  <div data-block="chapter-card" data-anim="pop">
    <p class="number">02</p>
    <h2 class="title">Verification beats vibes</h2>
  </div>
  <p data-cue="doubt">But who checks it?</p>
</section>

<section data-beat="stat" data-cue="stat">
  <div data-block="stat" data-source="s:example-survey">
    <p class="value">46%</p>
    <p class="label">of developers distrust the accuracy of AI tools</p>
  </div>
</section>

<section data-beat="loop" data-cue="loop">
  <figure data-block="diagram">
    <pre data-mermaid>flowchart LR
  S[Spec] --> T[Tests]
  T --> R[Review]
  R -->|next slice| S</pre>
    <i data-step data-nodes="S" data-cue="spec"></i>
    <i data-step data-nodes="T" data-edges="S-T" data-cue="tests"></i>
    <i data-step data-nodes="R" data-edges="T-R,R-S" data-cue="review"></i>
    <figcaption>One slice at a time</figcaption>
  </figure>
</section>
```

Caption words (excerpt of `captions/en/02.json`): `words[8].start = 3.62`,
`words[12].start = 5.66`, `words[26].start = 11.50`, `words[32].start = 14.12`,
`words[35].start = 15.40`, `words[38].start = 16.64`; audio `A = 19.70`, so
`D = 20.30`.

Resolved timeline:

| Beat | start | mounted until | `data-start` / `data-duration` | Fade-out | Camera |
|---|---|---|---|---|---|
| open | 0.00 | 5.96 | 0 / 5.96 | 5.66 → 5.96 | scale 1 → 1.04, 0.00 → 5.96 |
| stat | 5.66 | 11.80 | 5.66 / 6.14 | 11.50 → 11.80 | none |
| loop | 11.50 | 20.30 | 11.50 / 8.80 | none (last) | none |

| Target | Rule | t | Animation |
|---|---|---|---|
| open › chapter-card | direct child, no cue, first beat (floor 0) | 0.00 | pop 0.5 |
| open › p[data-cue=doubt] | cue doubt | 3.62 | fade-up 0.6 |
| stat › stat block (+ its `.tr-source`) | direct child, beat start 5.66, floor 5.96 | 5.96 | fade-up 0.6 |
| loop › diagram figure | direct child, floor 11.80 | 11.80 | fade 0.6 |
| step 1: node S | cue spec | 14.12 | pop 0.5 |
| step 2: node T, edge `L_S_T_*` | cue tests | 15.40 | pop 0.5, draw 0.8 |
| step 3: node R, edges `L_T_R_*`, `L_R_S_*`, label of `L_R_S_0` | cue review | 16.64 | pop 0.5, draw 0.8, fade 0.6 |

Nodes S, T, R and the three edges are hidden from 0 s until their step, so
between 11.80 and 14.12 the figure shows only its caption, "One slice at a
time"; the diagram builds on the narration from there. The stat block receives
`<p class="tr-source">Source: … · … · 2025</p>` from the `example-survey` entry.

## 12. Before writing a scene: brief and beat grid

Write these at the top of your working notes for the chapter (not into the scene
file), and only then write the HTML.

1. **Four-part brief.**
   - **Output:** what the viewer must understand after this chapter, in one sentence.
   - **Technical route:** which blocks and which camera, from `blocks.md`.
   - **Creative seed:** one visual idea that ties the chapter together.
   - **Signature:** the one moment the viewer should remember.
2. **Beat grid.** One row per cue: `cue | message | focal action | reaction`.
   - The **focal action** is the single thing that moves or appears.
   - The **reaction** is what the viewer should notice or feel.
   - Use only the script's existing cue names and the theme's tokens.
3. **Storyboard rules.**
   - One focal action at a time: never two competing primary reads in one beat.
   - No decorative effect that doesn't serve the message: no stray particles, spins or bounces.
   - Keep the fade-then-enter rule from section 2.
   - The talk's final beat visually echoes its opening beat.

Design ideas adapted from lemo-opuscar (MIT), mg-styles-15 (MIT),
ClaudeAnimationBase (MIT) and opus-video-prompts (ideas only). No code or assets
were copied.

## 13. Authoring checklist for the skill

- One idea per beat; one primary block per beat. A new beat at each `{#cue}`
  where the narration turns to a new idea; element cues for builds inside one.
- Every figure or quote on screen comes from `sources.json` and carries
  `data-source`; its numbers match the source's quote.
- A quote block always carries a figcaption naming the speaker and role; the source label under it names the work, host and year, never the speaker.
- Respect the text limits in `blocks.md`. Too much text: split the beat.
- Give each beat several seconds of narration. A beat shorter than about 2.5 s
  reads as a flash.
- Use the camera sparingly: `push-in` for the hook and big numbers, `pan-left`
  for a definition or quote; `none` elsewhere.
- Run `talkreel check` after writing scenes; it catches unknown sources and
  missing `data-source`.
