# Default theme: building blocks

Scenes are built from the twelve blocks below. Each block is an HTML fragment
with `data-block="<name>"`, placed inside a `<section data-beat>` (see
`skills/talkreel/references/scenes.md` for beats, cues and timing). The look
lives in `theme.css`; scene files never carry styles.

Every block has a working example in `examples/<block>.html`. Each example is a
complete, valid scene fragment, so the composer can use them as fixtures.

## Canvas and safe area

| Region | Box (px, on the 1920 x 1080 canvas) | Owner |
|---|---|---|
| Safe area (`.tr-stage`) | x 120..1800, y 72..872 (1680 x 800) | scene beats |
| Gap | y 872..920 | nothing |
| Caption band (`.tr-captions`) | y 920..1080 (full width, 160 high) | composer |

A beat fills the safe area; its children stack vertically, centred, left
aligned, with a 48 px gap (`data-align="center"` on the beat centres them). One
primary block per beat, optionally with one `<h2>` heading or one `<p>` line
directly in the beat. Camera moves may drift a beat up to 40 px past the left
and right edges of the safe area in landscape, never into the caption band.
Portrait camera travel is bounded by the 6% side safe zone, including full-width
content. Portrait captions fade at both edges above the bottom UI zone.

## Shared rules

- **Text limits** are hard limits for the default theme. The review stage
  checks frames against them; going over is the most common cause of overflow.
- **Sources.** `data-source="s:<id>"` names an entry in `sources.json`. The
  composer appends `<p class="tr-source">Source: …</p>` as the block's last
  child. Never write `.tr-source` by hand. Required on `stat` and `quote`;
  optional on `definition`; not allowed elsewhere.
- **Default entrance** for every block is `fade-up` unless the table says
  otherwise; any block may set `data-anim` (`fade-up`, `fade`, `pop`, `type`,
  `draw`, `slide`; `stream` is the terminal-row default).
- **Classes** listed below are the only ones the theme styles. `.c` and `<mark>`
  exist only inside `code`; `<em>` is accent-coloured only in the hook title.
- **Type floor.** No theme text renders under 28 px, so nothing is unreadable
  on a phone. Do not try to fit more by shrinking text; split the beat instead.

## Blocks

### `title`

The video title (chapter 01) and, with `data-variant="hook"`, the cold-open hook.

```html
<div data-block="title">
  <p class="kicker">A talk in seven chapters</p>          <!-- optional, ≤ 40 chars -->
  <h1>Software engineering with AI today</h1>              <!-- required, ≤ 50 chars -->
  <p class="subtitle">And how I work with …</p>           <!-- optional, ≤ 90 chars -->
</div>

<div data-block="title" data-variant="hook">
  <h1>Your AI assistant writes the code in minutes. <em>Who checks it?</em></h1>  <!-- ≤ 90 chars -->
</div>
```

Hook: only the `h1`; wrap the punch line in `<em>` (accent colour). Pairs well
with `data-camera="push-in"` on its beat.

### `chapter-card`

```html
<div data-block="chapter-card">
  <p class="number">03</p>                      <!-- required, two digits -->
  <h2 class="title">Verification beats vibes</h2>  <!-- required, ≤ 40 chars -->
</div>
```

Default entrance `pop` is recommended (`data-anim="pop"`).

### `definition`

```html
<div data-block="definition" data-source="s:id">   <!-- data-source optional -->
  <p class="term">Context engineering</p>          <!-- required, ≤ 30 chars -->
  <p class="text">Deciding what an AI model sees …</p>  <!-- required, ≤ 160 chars, one sentence -->
</div>
```

### `diagram`

A Mermaid diagram rendered in the page from a local bundle, with step-by-step
reveals.

```html
<figure data-block="diagram">
  <pre data-mermaid>flowchart LR
  S[Script] --> V[Voice]
  V --> A[Align]
  Q -->|fix| R</pre>                                          <!-- required, Mermaid source -->
  <i data-step data-nodes="V" data-edges="S-V" data-cue="voice"></i>   <!-- optional, 0..n -->
  <figcaption>Every stage writes plain files</figcaption>    <!-- optional, ≤ 60 chars -->
</figure>
```

- Default entrance `fade`.
- The render area is 1680 x 560; the SVG scales to fit it, keeping its aspect.
  Prefer `flowchart LR` with at most 8 nodes and labels of at most 16 chars; a
  tall `TD` chart renders small.
- **Steps** (`<i data-step>`) are invisible markers. Each lists Mermaid node ids
  in `data-nodes` and edges as `FROM-TO` in `data-edges` (comma separated, no
  spaces). At the step's cue the nodes `pop` in and the edges `draw` in, edge
  labels with them. Anything not listed in any step appears with the figure.
- Step reveals work for `flowchart` / `graph` only. Other Mermaid types render,
  but take no `data-step`.
- Node ids: letters and digits only (`[A-Za-z0-9]+`), so `FROM-TO` stays
  unambiguous.
- Do not write `.tr-mermaid`; the composer inserts it.

### `figure`

A single local image, optionally captioned. The image keeps its aspect ratio and
fits the safe area in landscape, portrait and square.

```html
<figure data-block="figure">
  <img src="assets/screens/product.png" alt="The product's chapter dashboard">
  <figcaption>One place for every chapter</figcaption> <!-- optional, <= 60 chars -->
</figure>
```

- Exactly one direct `<img>` child; its `alt` must contain meaningful text.
- Paths resolve from the talk folder. Use `assets/<path>` with png, jpg, jpeg,
  webp or svg (case-insensitive). No URLs, schemes, absolute paths, dot segments,
  URL escapes, query strings, fragments or alternate `srcset` images.
- SVGs load through `<img>` only. They must be standalone: no external references,
  embedded images, scripts or foreignObject. Internal `#id` references are allowed.
- Default entrance `fade`; a cue or `data-anim` on the block uses the existing
  cue timeline. Images add no independent clock or camera motion.
- Copy the image named in `examples/figure.html` into the talk's `assets/` before
  using that example. Compose copies referenced assets into the chapter build.

### `device`

A phone or browser frame around one local screenshot. Give it its own beat;
the viewport is computed in Node to fit the safe area, excluding frame chrome.
Phone screenshots use a 9:16 viewport; browser screenshots use 16:10. Prepare
the image at that aspect ratio so its percentage coordinates match the display.

```html
<div data-block="device" data-frame="browser">
  <img src="assets/screens/product.png" alt="The product's chapter dashboard">
  <i data-target="publish" data-x="60%" data-y="20%"
     data-width="20%" data-height="10%"
     data-zoom="70,25,2" data-cue="focus"></i>
  <i data-click="publish" data-cue="publish"></i>
</div>
```

- `data-frame` is required: `phone` or `browser`. Exactly one direct `<img>`
  child follows all the local image, alt-text and SVG rules of `figure`.
- Targets are empty direct children. `data-target` is unique within the device
  and uses lowercase letters, digits and hyphens, starting with a letter or digit.
  `data-x`, `data-y`, `data-width`, `data-height` are percentage strings such as
  `12.5%`; the rectangle must fit inside 0..100%. These are physical screenshot
  coordinates, including on RTL pages.
- `data-zoom="x,y,scale"` on a target needs `data-cue`. x/y are percentages
  written as numbers (0..100); scale is 1..8. The composer centres that point
  in the viewport at the requested scale. The zoom starts at the cue and reaches
  its transform after the target's entrance duration (default 0.6 s; `pop` 0.5 s,
  `draw` 0.8 s). The target is a marker, with no independent text entrance.
- An empty direct child with `data-click="target-name"` and `data-cue` moves
  the cursor over up to 0.6 s **before** the cue. It starts from its previous
  screenshot position. For the first click, or when that position is off-screen,
  it enters at the screenshot point shown at 10%,85% of the viewport under the
  camera at the path's start (a zoom already running uses its end camera; a zoom
  starting at or after that time does not apply), kept at least 32 px inside the
  screenshot's right and bottom edges. It follows a quadratic curve and starts
  the click halo and pressed highlight at the cue. The cursor and halo follow the screenshot
  camera. A click may share a target's zoom marker and cue.
- Actions must follow the device entrance. Zooms must not overlap. Clicks must
  allow the preceding 0.24 s pressed state to finish; the first path is shortened
  if the device has only just appeared. An unknown target in the same device
  fails with `E_CLICK_TARGET`; invalid device geometry/timing uses `E_DEVICE`.
- Default entrance `fade`. Frame and action timing comes solely from cues; no
  clocks or layout measurements are used. Run `node scripts/determinism.mjs
  build/en/01` locally to automatically include mid-cursor, mid-zoom and
  after-zoom (0.2 s after each zoom settles) frames, comparing
  fresh/sequential/shuffled seeks and workers 1/4. The seek check uses
  installed HyperFrames dependencies and an existing browser (set
  `HYPERFRAMES_BROWSER_PATH` if needed); it never downloads one.
  It also compares every decoded MP4 frame with framemd5, including chunk
  boundaries and zoom-outs; a match at the sampled times alone is insufficient.

### `cta`

A closing card with a local logo, one headline, one action line and an optional
display URL. URL text is not a fetched resource or link; omit the scheme.

```html
<div data-block="cta">
  <img src="assets/logo.svg" alt="Product logo">
  <h2>Make your next reel</h2>
  <p class="action">Start a chapter today</p>
  <p class="url">example.org</p> <!-- optional -->
</div>
```

- Exactly one direct logo `<img>`, following the same local asset rules as `figure`.
- One non-empty `<h2>`, one non-empty `<p class="action">`, at most one
  non-empty `<p class="url">`. Other direct elements fail with `E_CTA`.
- Default entrance `fade`. Hold the fully entered card for at least **1.5 s**
  before the chapter ends. Compose warns below that boundary, including delayed
  child entrances or a beat that leaves early. Put the closing card in the final
  beat and leave enough narration for the hold.

### `code`

Plain monospace, no highlighter. One `[data-line]` per source line.

```html
<div data-block="code" data-lang="ts">              <!-- data-lang optional, informational -->
  <p class="filename">src/state.ts</p>               <!-- optional, ≤ 50 chars -->
  <pre><code>
    <span data-line><span class="c">// a comment</span></span>
    <span data-line data-emph>  const hash = sha256(x);</span>   <!-- data-emph: highlighted row -->
    <span data-line>  return a !== <mark>hash</mark>;</span>      <!-- mark: accent token -->
  </code></pre>
</div>
```

- At most 12 lines and 64 chars per line (8 lines and 36 chars inside `split`).
- Escape `<`, `>` and `&` as `&lt;`, `&gt;`, `&amp;`. Indent with spaces inside
  the line span; whitespace between line spans is ignored.
- Lines enter with `type` by default, one after another. A line with its own
  `data-cue` types in at that cue instead.
- An empty line is `<span data-line></span>`.

### `stat`

```html
<div data-block="stat" data-source="s:id">     <!-- data-source REQUIRED -->
  <p class="value">84%</p>                      <!-- required, ≤ 6 chars -->
  <p class="label">of respondents use …</p>     <!-- required, ≤ 90 chars -->
</div>
```

The number must appear verbatim (or as an exact unit conversion) in the
source's quote. `pop` is a good entrance.

### `quote`

```html
<figure data-block="quote" data-source="s:id">   <!-- data-source REQUIRED -->
  <blockquote>Verbatim text from the source.</blockquote>   <!-- required, ≤ 140 chars -->
  <figcaption>Speaker name, role</figcaption>              <!-- optional, ≤ 60 chars -->
</figure>
```

The text must be the source's verbatim quote or an exact excerpt of it. Do not
add quotation marks; the theme draws one.

### `list`

```html
<div data-block="list">
  <h3 class="heading">How I keep the AI honest</h3>   <!-- optional, ≤ 40 chars -->
  <ul>                                                <!-- or <ol> -->
    <li>Write the spec before any code</li>           <!-- 2..5 items, ≤ 50 chars, one line each -->
    <li data-cue="tests">Run the tests</li>
  </ul>
</div>
```

Items enter one by one: an item with `data-cue` at its cue, an item without one
with the block (staggered).

### `split`

Two columns, 800 px each with an 80 px gutter.

```html
<div data-block="split">
  <div class="col">                       <!-- exactly two .col children -->
    <h3>Prompt and hope</h3>              <!-- optional, ≤ 30 chars -->
    <p>One long chat, no spec, …</p>      <!-- optional, ≤ 120 chars -->
  </div>
  <div class="col" data-cue="after">
    <div data-block="stat" data-source="s:id">…</div>   <!-- or one nested block -->
  </div>
</div>
```

A column holds either `h3` + `p`, or exactly one nested block of type `stat`,
`list`, `code`, `definition` or `quote`. Nested blocks render at 0.7 scale, so
their own text limits shrink by the same factor. Never nest `title`,
`chapter-card`, `diagram`, `split`, `terminal` or `pipeline`.

### `terminal`

A terminal window: typed prompts, streamed output, Claude Code tool calls and
results, diffs.

```html
<div data-block="terminal" data-title="claude · talkreel" data-rows="6">  <!-- title optional, ≤ 50 chars; rows 2..13, default 13 -->
  <p data-prompt>run the tests</p>                  <!-- Claude prompt, ">" drawn by the theme; types in -->
  <p data-prompt="sh">gh pr checks 1</p>            <!-- shell prompt, "$" -->
  <p data-tool>Bash(npm test)</p>                   <!-- tool call, green dot -->
  <p data-result data-cue="tests">9 passed</p>      <!-- indented result under the call -->
  <p data-out data-tone="ok">all green</p>          <!-- plain output -->
  <p data-diff="del">  return step();</p>           <!-- "-" row, red tint -->
  <p data-diff="add">  return retry(step);</p>      <!-- "+" row, green tint -->
</div>
```

- One `<p>` per row and exactly one role per row (`E_TERM_LINE`). Plain text
  only, at most **72 characters**; rows never wrap. To continue a long line, add
  an indented `data-out` row.
- `data-tone`: `ok`, `err` (full-row red tint, for a block or failure), `warn`,
  `dim`, `accent`.
- **Timing.** Rows without a cue chain: the first appears 0.3 s after the
  window, a prompt types (0.035 s per character, 0.3–1.2 s) 0.4 s after the row
  above, output streams 0.07 s apart, 0.25 s after a prompt. A row with
  `data-cue` starts at its cue, and the rows after it chain from there. A cursor
  blinks after the last typed prompt until the next row.
- **Growing and scrolling.** The window opens one row tall and grows by a row
  as each row arrives, up to `data-rows`; the block reserves that final height,
  so nothing else on the slide moves. Each row past `data-rows` scrolls the
  content up by one row.
- Default entrance `fade`; with a `<h2>` or `<p>` above it, keep `data-rows` ≤ 11.

### `pipeline`

A row of stage chips joined by a rail that fills as chips light up. Good as a
recurring "where are we" motif.

```html
<div data-block="pipeline">
  <ol>                                  <!-- 3..8 chips (E_PIPELINE) -->
    <li data-done>Idea</li>             <!-- lit when the beat opens -->
    <li data-done>Spec</li>
    <li data-cue="review">Review</li>   <!-- lights at its cue -->
    <li>Ship</li>                       <!-- lights with the block -->
  </ol>
</div>
```

- Chips are plain text, at most 14 characters, all the same width.
- The rail fills from the first chip to the last lit one. Give the pipeline its
  own beat, optionally with one `<h2>`, centred (`data-align="center"`).

### `slide` entrance

`data-anim="slide"` on any target: it slides in 80 px from the right while it
fades in (0.6 s).

## Ambient layer and chapter tag

With `"ambient": true` in talk.json, the composer adds a slow background drift
(two soft gradients and a faint grid) and a chapter tag `NN · Tag` above the
safe area (y 16..56). The tag comes from `{tag: …}` in the script heading. Off by
default. The tag fades out while a beat whose primary block is `title` is on
screen, and back in with the next beat.

## Theme files the composer uses

| File | Use |
|---|---|
| `theme.css` | Linked from every chapter page. References fonts at relative `fonts/…woff2` URLs |
| `mermaid.mjs` | Default export is the object passed to `mermaid.initialize()` |
| `blocks.md`, `examples/` | Authoring reference and composer fixtures |

Fonts, copied by the composer from npm into `build/<lang>/NN/fonts/`:

- `@fontsource/inter/files/inter-latin-{400,600,800}-normal.woff2`
- `@fontsource/inter/files/inter-latin-ext-{400,600,800}-normal.woff2`
- `@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,600}-normal.woff2`
- `@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-{400,600}-normal.woff2`

No `.json` file may live under `themes/`: Claude Code scans a plugin's
`themes/` directory for its own UI theme JSON files.
