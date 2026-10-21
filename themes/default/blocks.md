# Default theme: building blocks

Scenes are built from the nine blocks below. Each block is an HTML fragment
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
and right edges of the safe area, never into the caption band.

## Shared rules

- **Text limits** are hard limits for the default theme. The review stage
  checks frames against them; going over is the most common cause of overflow.
- **Sources.** `data-source="s:<id>"` names an entry in `sources.json`. The
  composer appends `<p class="tr-source">Source: …</p>` as the block's last
  child. Never write `.tr-source` by hand. Required on `stat` and `quote`;
  optional on `definition`; not allowed elsewhere.
- **Default entrance** for every block is `fade-up` unless the table says
  otherwise; any block may set `data-anim` (`fade-up`, `fade`, `pop`, `type`,
  `draw`).
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
`chapter-card`, `diagram` or `split`.

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
