# talkreel M2a: terminal views, motion, and the 5-minute talk

Status: approved at gate 1 (2026-10-22). The ruling came from Fable 5.1 at max effort, after gpt-6-astra and Fable 5.1 had both advised at high effort.

## Problem

The maintainer watched the M1 talk (9 min 38 s) and judged it boring. In their words, the 10 minutes "are very boring", the talk did not cover the zhioua OS or how they work with it, and they want 5 minutes "with animation, terminal view, anything an expert would want to see". The audience is engineers: their team and their boss.

The M1 theme only shows static cards that fade in (title, list, quote, stat, code, Mermaid). It has no terminal, no stage-by-stage motion, and its background never moves. Its captions also spell out abbreviations ("M C P").

## Goals

- **A new talk.** `talks/how-i-ship-with-ai/` shows how the maintainer works with the zhioua OS. It follows one thread, the build of this very tool:
  1. the request
  2. the ambiguity
  3. the corrected spec
  4. a failed attempt, then fixed
  5. guardrails
  6. the verified ship

  It runs 285–315 s, in English.
- **Everything on screen is real.** Commands, outputs, hook messages and numbers come from the OS source or from the session that built talkreel. Lines may be cut short with "…", but nothing is invented. A hook message that did not fire in the build is shown as "what the hook prints", never as an event.
- **New theme features.** All of them are deterministic (seek-driven GSAP, no clocks):
  1. **`terminal` block:**
     - window chrome with a title
     - prompts typed in, either Claude `❯` or shell `$`
     - output lines streamed in
     - Claude Code-style tool calls and results
     - diff lines
     - tones: `ok`, `err` (a full-row tint), `warn`, `dim`, `accent`
     - a blinking cursor
     - auto-scroll past 13 rows
  2. **`pipeline` block:** a row of stage chips joined by a rail that fills up to the current chip. It is the talk's recurring motif.
  3. **`slide` entrance:** content slides in from the right.
  4. **Opt-in ambient layer** (`talk.json` `ambient: true`): a slow gradient drift and a faint grid over the whole chapter, plus a chapter tag (`03 · Spec`) above the safe area.
  5. **Display forms in captions:** the script writes `[[MCP|M C P]]`. The voice says the second form; the captions show the first.
  6. **`voice.speed`** in talk.json, from 0.8 to 1.3, default 1.
- **The M1 talk stays.** It remains in the repo, unchanged, as the long-form example. Its composed output is unchanged too, because ambient is off by default.

EARS acceptance:
- WHEN the new talk is rendered, the system SHALL produce `out/how-i-ship-with-ai-en.mp4` of 285–315 s, and `talkreel check` SHALL pass.
- WHEN a terminal line has `data-cue`, it SHALL start at max(cue, beat floor). Uncued lines SHALL chain (exact pauses in `scenes.md` section 5a):
  - a prompt starts 0.4 s after the previous line ends, and types at 0.035 s per character, clamped to 0.3–1.2 s
  - an output line starts 0.07 s after the previous output line starts, or 0.25 s after a prompt finishes typing
- WHEN line i (0-based) of a terminal enters, the terminal content SHALL be scrolled by `−max(0, i−(rows−1))·40` px, where rows is `data-rows` (2–13, default 13). That offset is resolved in Node, not measured in the browser.
- WHEN a terminal line is longer than 72 characters, has an unknown role, or the block has a child other than `<p>`, compose SHALL fail with `E_TERM_LINE`.
- WHEN a caption word group has a display form, the caption SHALL show that form once, from the group's first start to its last end. Cue resolution, the captions JSON and the align hash SHALL be unchanged.
- WHEN `ambient` is absent or false, the composed page SHALL contain no ambient or tag nodes.
- WHEN a display form or a chapter tag changes, the chapter's render hash SHALL change.
- WHEN the same frame time is rendered fresh, after a sequential seek, after a shuffled seek, or with `--workers 1` versus N, the PNGs SHALL be byte-identical.

## Non-Goals

- Count-up numbers and word-by-word kinetic text (cut at gate 1).
- Images in scenes, cue re-emphasis of a line, reading holds.
- Screen recordings, avatars, voice cloning, full French (M2b/M3).
- Background music and sound effects.
- Syntax highlighting in the terminal (tones only).
- A cross-chapter progress bar.

## User Flow

The pipeline is unchanged: script → scenes → `talkreel voice` → `align` → `render` → `frames` → review. Authors get the new blocks in `blocks.md` and `scenes.md`, each with an example in `themes/default/examples/`.

## Technical Plan

**Terminal** (`data-block="terminal"`, optional `data-title`). The children are `<p>` lines, each with one role:

| Role | Default entrance | Look |
|---|---|---|
| `data-prompt` (Claude) or `data-prompt="sh"` | `type` | `❯` or `$` drawn by CSS |
| `data-out` | `stream` | plain |
| `data-tool` | `stream` | tool dot drawn by CSS |
| `data-result` | `stream` | `⎿` indent drawn by CSS |
| `data-diff="add"` or `data-diff="del"` | `stream` | `+` or `−`, ok or err tone |

- Each line takes an optional `data-tone`.
- Rows are a fixed 30 px mono at a 40 px line height with `white-space: pre`, so a row is always one line high. Over 72 chars is an error.
- `data-rows` (2–13, default 13) is the window's final height. The window opens one row tall and grows a row as each row arrives (heights computed in Node), while the block reserves the final height so the slide never shifts. This came from the frame review: a full-height window with one row looked empty.
- `compose-scene.ts` resolves every line's start time and its scroll offset. The runtime only plays tweens.
  - The scroll is one `tl.to(track, {y})` per line that needs it, all on the same property, with `immediateRender: false`.
  - The cursor is one element after the last prompt, with a finite yoyo blink sized to the beat.
- Timing precedence:
  - A cue that falls before the chain end produces a warning, and the cue wins.
  - A chain that ends after its beat produces a warning.

**Pipeline** (`data-block="pipeline"`):
- An `<ol>` of 3–8 `<li>` chips, each ≤ 14 chars.
- Chips have `flex: 1 1 0`, so all chips have equal width and the rail fraction for the k-th lit chip (0-based) is `k/(n−1)`. Node computes it.
- `data-done` chips are lit when the beat opens. A chip with `data-cue` lights at its cue. An uncued, undone chip lights with the block.
- Lighting is a `pop` of the chip's lit layer plus a `scaleX` tween of the rail.
- A pipeline beat holds only the pipeline (one primary block per beat).

**`slide`:** `x 80 → 0` and opacity 0 → 1 over 0.6 s.

**Ambient** (`talk.json` `ambient: true`):
- Composer-owned nodes outside the stage: two gradient blobs and a grid. Each gets one tween over D (`ease: none`).
- The chapter tag sits at y 24..60. It reads `NN · <tag>`, where the tag comes from the script heading's `{tag: X}`, falling back to the heading itself. A tag longer than 14 chars produces a warning.

**Display forms:**
- `script.ts` parses `[[display|spoken]]` into `displays: {first, count, text}`. The punctuation around the marker is kept on the display text.
- `buildPage` merges each group into one shown caption word.
- `sceneInputHash` includes the display groups and the resolved tag.

**`voice.speed`:**
- It is validated in `schema.ts`; the voice-id loop exempts `speed`.
- It is passed to `synthesize(speed=…)`.
- It joins the voice hash only when it is not 1, so M1 audio stays fresh.

**Loudness:** measure the final mix with `ffmpeg -af ebur128`. Only if the result is outside −20…−14 LUFS, add `loudnorm I=-16` to concat in this PR.

`COMPOSE_VERSION` becomes "6" (5 was the first M2a build; 6 adds growing terminals).

## Files Likely Touched

- `src/compose-scene.ts`, `src/compose-runtime.ts`, `src/compose.ts`, `src/compose-captions.ts`, `src/script.ts`, `src/schema.ts`, `src/stages.ts`, `src/state.ts`, `src/audio-helper.ts`, `src/commands/voice.ts`
- `themes/default/theme.css`, `blocks.md`, `examples/terminal.html`, `examples/pipeline.html`
- `skills/talkreel/references/scenes.md` and `script.md`
- `test/*`, including a disclosure test
- `talks/how-i-ship-with-ai/**`
- `README.md`

## Data Model/API Changes

- talk.json gains `voice.speed?` and `ambient?`.
- Scripts gain `[[display|spoken]]` and the heading `{tag: X}`.
- Scenes gain two blocks, one entrance (`slide`) and five terminal roles. Every change is additive.
- Hash inputs:
  - `sceneInputHash` adds the display groups and the tag
  - the voice hash adds speed when it is not 1
  - the align hash is unchanged

## Risks

| Risk | Mitigation |
|---|---|
| Seek order changes a frame: several tweens on one property, or the start values recorded lazily | Every non-first tween of a property uses `tl.to()` or `immediateRender: false`. A determinism test renders three frames (mid-scroll, mid-rail, mid-slide) fresh, sequentially, shuffled, and at `--workers 1` versus 3, and compares PNG bytes. A spike on 2026-10-22 got identical hashes at `--workers 1` and `--workers 3` for scroll and drift |
| Browser layout disagrees with the Node geometry | Fixed row height and `white-space: pre`, a 72-char error, equal-width chips. The frame review checks scroll at a cue |
| Terminal text is too small on a phone | 30 px mono floor and 13 rows; split beats rather than shrink |
| The content feels fake | Only strings from the verified inventory; the title bar on chapter 1 says "replayed from the real session" |
| The public repo exposes the private OS | The whole talk folder is committed, but research packets and session logs are not. STORYBOARD cites categories ("OS hook message", "build session"), never paths. A committed test fails on `C:\Users`, `.ai-os`, email addresses and `your-ai-engineering-os/` under `talks/` |

## Alternatives

- **Record the real terminal (asciinema → GIF):** real, but it fixes the timing and clashes with the theme, and screen recording is a non-goal.
- **Shorten the M1 talk:** its structure starts with definitions, while the complaint is about focus as much as length.
- **Count-up numbers and kinetic words:** they decorate without explaining the OS, so they were cut at gate 1.

## Decisions

| Decision | Class | Call | Reversible? |
|---|---|---|---|
| New talk folder; keep M1 as is | Taste | New folder | yes |
| Commit the new talk to the public repo | User-Challenge, ruled by Fable max | Commit the folder, plus the disclosure test. No research packets, logs or OS paths | partly |
| Music | User-Challenge, ruled | None. Loudness is measured, and `loudnorm` is added only if the mix is outside −20…−14 LUFS | yes |
| Terminal look | Taste | Claude Code TUI (`❯`, tool dot, `⎿`) plus `$` for shell lines; `err` is a full-row tint | yes |
| Voice | Taste | `af_heart` at speed 1.08, fixed. Tune the length with words only; voice chapter 01 first to calibrate | yes |
| Chapter tag syntax | Taste, ruled | `# Title {tag: X}`, not an HTML comment | yes |
| Ambient and tag default | Taste, ruled | Opt-in (`ambient: true`), so M1 is unchanged | yes |
| Count-up and kinetic words | Taste, ruled | Cut | yes |
| Script writer | Mechanical (the maintainer's earlier order) | An Opus 5.5 subagent at xhigh, given the verified-strings inventory; any number outside it is forbidden | — |
| Model and vendor names in the talk | Taste, ruled | None. Two sentences only: "two advisor models rule the open calls; I confirm the spec", and "the reviewer is a fresh context on another model" | yes |

## Test Plan

- Unit tests:
  - chain times: clamp, gap, cue reset, both warnings
  - `E_TERM_LINE` for an unknown child, an unknown role, and a 73-char line
  - scroll offsets
  - rail fractions for 3–8 chips, with `data-done`
  - display parsing and the compose-time merge: line breaks count the display text, and cue resolution is unchanged
  - `voice.speed` range and the voice hash
  - `sceneInputHash` changes when the tag or a display form changes
  - with `ambient` off, the page has no ambient or tag nodes
  - the disclosure grep
- A determinism smoke test: three frames compared byte for byte, as described in Risks.
- The existing suite stays green. Full render at 285–315 s, then a frames review of at most 3 rounds.

## Rollout/Rollback

One branch, `m2-motion`, and one PR. CI runs typecheck and tests. Rollback is reverting the PR. Every change is additive and off by default.
