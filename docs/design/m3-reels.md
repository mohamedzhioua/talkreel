# talkreel M3: reels — portrait, Arabic, product motion, music

Status: draft for gate 1 (2026-10-24). The product calls came from Fable 5.1 (read-only advisor), which the maintainer delegated the decisions to. Inputs: a GPT Sol 6.1 review of a reference promo (a 158 s Saudi-dialect product video for a recruiting SaaS) and a licence-checked web survey (Sonnet 5.5). Execution runs in zhioua-os `claude` mode, as the maintainer asked.

## Problem

The maintainer wants talkreel to be something people rely on to make Instagram Reels, TikTok and Shorts videos, product promos and sponsored ads. These need motion that shows a product being used, and selectable Arabic, English and French voices.

Today talkreel makes 16:9 explainers only:
- The composer rejects any other resolution (`src/compose.ts:306`), and the render argument is hard-coded to `--resolution landscape` (`src/compose-hyperframes.ts:75`).
- Scenes may not contain `<img>` or `<video>` (`src/compose-scene.ts:88`), so a promo cannot show the user's own product.
- The TTS helper speaks only English and French (Kokoro, `py/talkreel_audio/tts.py:14`). The bundled fonts are Latin-only (`src/compose.ts:51`). The page never sets `dir`. The `type` entrance reveals left to right (`src/compose-runtime.ts:34`). The caption breaker knows only Latin punctuation and English function words (`src/compose-captions.ts:22-30`).
- There is no music bed, and concat copies streams (`src/compose-concat.ts:82`).
- Layout limits are fixed for a 1920 px canvas: `TERM_MAX_CHARS` 72 at 30 px mono is 1296 px wide (`src/compose-scene.ts:23`), and `CAPTION_MAX_CHARS` 48 assumes a 1600 px band (`src/compose-captions.ts:5`). Neither fits a 1080 px portrait canvas.

## Goals

A talk can be 9:16 or 1:1. It can:
- show the user's own screenshots inside a device frame, with cursor clicks, chat, checklists, a count-up and a CTA end card
- speak Arabic (MSA or dialect), English or French, with word-timed captions that read correctly right to left
- carry a user-supplied music bed, ducked under the voice and normalised in loudness

Everything stays cue-timed, offline and deterministic. Arabic and the new blocks also work in landscape talks.

M1 and M2 talks render identically, but they re-render once. M3 CSS lives in the one `theme.css`, and `themeHash` covers all of it (`src/compose.ts:344`), so every existing talk goes stale one time. A conditional stylesheet was rejected: it would make `stages.ts` repeat the composer's "does this page need it" logic, a second source of truth. `scripts/determinism.mjs` compares three M2 frames rendered before and after the theme change, byte for byte.

EARS acceptance:
- WHEN `resolution` is `portrait` or `square`, compose SHALL produce a 1080×1920 or 1080×1080 page, and render SHALL pass the same resolution to HyperFrames. WHEN it is `landscape`, the composed page SHALL be byte-identical to M2.
- WHEN a scene has `<img src="assets/…">` (in `figure`, `device` or `cta` only), compose SHALL copy the file into `build/`, add its sha256 to `sceneInputHash`, and reject with `E_ASSET`: absolute paths, `..`, URLs, missing files, an empty `alt`, extensions other than png/jpg/jpeg/webp/svg, and an SVG that references anything outside itself.
- WHEN a talk language is `ar`:
  - the page SHALL carry `dir="rtl"` and the Arabic font. Pages in LTR languages SHALL carry no `dir` attribute, so they stay byte-identical.
  - each caption word SHALL be bidi-isolated
  - a caption line SHALL NOT end on a word from `ARABIC_FUNCTION_WORDS`, a list pinned in `src/compose-captions.ts` and its test. `، ؛ ؟` SHALL count as clause and sentence ends.
  - captions SHALL show the script's text with harakat removed (U+064B–U+065F and U+0670, on NFC text). Hamza and madda letters (أ إ آ ؤ ئ) SHALL be kept.
- WHEN an RTL text element uses the `type` entrance, compose SHALL fail with `E_RTL_TYPE`. Terminal and code blocks SHALL render `dir="ltr"` and may still use `type`.
- WHEN `align` runs for `ar` and the `arabic` group is installed, it SHALL use CTC forced alignment of the script. Otherwise it SHALL fall back to Whisper and print `install the arabic group for script-level Arabic alignment`. The align hash's existing `model` field SHALL read `ctc:<revision>` for CTC; Whisper hashes stay unchanged. Installing the group later makes existing `ar` align stages stale, and this is intended.
- WHEN a voice id has an engine prefix (`chatterbox:…`, `lahgtna:…`), `voice` SHALL synthesize with that engine through the `arabic` group. Bare ids SHALL stay Kokoro, and their voice hashes SHALL not change. WHEN `ar` has a bare (Kokoro) id and `mode` is `ai`, validation SHALL fail and point to `chatterbox:`, `lahgtna:` or `mode: "own"`.
- WHEN `voice --audition` runs, it SHALL write `build/audition-<lang>.wav` from the first paragraph of the selected chapter (default 01), print its path, and record no stage.
- WHEN talk.json has `music`:
  - a `mix` stage SHALL duck the music under the narration (`sidechaincompress`) and normalise with two-pass `loudnorm` (I=-14, TP=-1.5)
  - the smoke check SHALL measure −14 ± 1 LUFS integrated with `ebur128`
  - the video stream SHALL be copied
  - `out/credits.txt` SHALL list the music file, credit and licence, the voice engine per language (with the watermark note for Chatterbox/Lahgtna) and the fonts
  - the concat hash SHALL gain `music: true`

  WHEN `music` is absent, concat, its hash and `out/<slug>-<lang>.mp4` SHALL be exactly as in M2.
- WHEN the same frame time of a mid-cursor-path, mid-count-up or mid-zoom beat is rendered fresh, after a sequential seek, after a shuffled seek, or at `--workers 1` versus `--workers 4`, the PNGs SHALL be byte-identical (`scripts/determinism.mjs`, local).
- WHEN `talkreel frames --safe-zones` runs on a portrait talk, each extracted frame SHALL carry an overlay of the reel UI zones: 14 % top, 35 % bottom, 6 % sides. On other resolutions it SHALL warn and extract frames without an overlay.
- WHEN a `device` target has `data-zoom` and a cue, the camera SHALL reach the Node-computed transform at the cue plus the entrance duration. WHEN a `data-click` names no `data-target` in the same `device`, compose SHALL fail with `E_CLICK_TARGET`.
- WHEN a `chat` bubble has a cue, it SHALL start at max(cue, beat floor). Uncued bubbles SHALL chain by the terminal rules, and an agent bubble SHALL be preceded by a typing indicator.
- WHEN a `cta` block's hold before the chapter end is under 1.5 s, compose SHALL warn.
- WHEN `talkreel new <slug> --reel` runs, it SHALL write a talk.json with `resolution: "portrait"`, an `assets/` folder, and a script and scene skeleton with hook, proof and CTA beats.
- WHEN `status` runs on a portrait talk whose voiced length is over 90 s, it SHALL warn "long for a reel". Over 180 s it SHALL warn "over the Shorts limit". The thresholds come from one table.

## Non-Goals

- Interactive or playable HTML5 ads. A clock-driven runtime breaks seek determinism.
- Presenter avatars, and GPU-only TTS lanes (qwen3-TTS-KSA). Any model with non-commercial weights (OmniVoice, F5/Habibi, XTTS, MMS defaults, Voxtral, Fish).
- A diacritizer. The script author writes tashkeel where the TTS needs it.
- A bundled music or SFX library, beat sync, auto-reframe, screen capture.
- A brand kit beyond colour tokens and a logo. Per-platform encode profiles.
- Vendoring HyperFrames registry items or fetching them at build time. `hyperframes add` pulls unpinned `main`, and registry items carry their own JS timing, which scenes forbid.
- A HyperFrames bump, unless the portrait spike fails on 0.8.185.

## User Flow

1. `talkreel new my-reel --reel`. This scaffolds `resolution: "portrait"`, an `assets/` folder and the reel pacing notes. Or set `resolution` by hand.
2. The skill (`skills/talkreel/references/reel.md`) writes a 15–60 s script:
   - a 3 s hook
   - proof beats on the product
   - a CTA close
   - tashkeel where the Arabic voice needs it
3. The user drops screenshots into `assets/`. Optionally they add `music: {file, credit, license, gainDb}` to talk.json and a reference WAV for cloning.
4. `voice --audition` speaks one paragraph so the user can judge the voice. Then run `voice`, `align`, `render`, then `mix` (automatic when `music` is set).
5. `frames --safe-zones` produces review frames. The user posts `out/<slug>-<lang>.mp4`, with `out/credits.txt` for attribution.

## Technical Plan

**Geometry** (`src/geometry.ts`, new). One table keyed by resolution holds:
- canvas size and stage padding
- caption band (width, bottom offset, font size) and `CAPTION_MAX_CHARS`
- `TERM_MAX_CHARS`, row height and maximum rows
- safe zones

`compose-scene.ts`, `compose-captions.ts`, `compose-html.ts` and `renderArgs` read from it instead of module constants. Landscape values equal today's constants. Portrait and square get their own `theme.css` blocks under `[data-resolution]`. Portrait captions sit above the 35 % bottom zone, and their size is set so a line holds at least 4 Arabic words. Square follows the same pattern and gets no separate frame review in this milestone.

**Assets.** `<img>` leaves `FORBIDDEN_TAGS`:
- An image is valid only as `<img src="assets/<path>" alt="…">` inside a block that has an image slot: `device`, `cta` (the logo), or the new `figure` single-image block.
- Compose resolves the path against the talk folder, rejects `..`, absolute paths, URLs and other extensions, copies the file to `build/<lang>/<NN>/assets/`, and adds `path:sha256` pairs, sorted, to `sceneInputHash`.
- `<video>` is slice 9 and a cut candidate:
  - muted, H.264, local only
  - starts at a cue
  - `data-from` / `data-to` trim the asset, never the timeline
  - it ships only if the determinism script shows identical frames at a mid-clip time

**RTL.**
- The language direction comes from a table (`ar` → rtl).
- Adds `@fontsource/ibm-plex-sans-arabic` (OFL; arabic subset; 400/600/800) to `FONT_FILES`, used through the CSS font stack when `lang=ar`.
- The page root gets `dir="rtl"` only for RTL languages; LTR pages get no attribute. Each `.tr-word` gets `unicode-bidi: isolate`. Terminal and code blocks force `dir="ltr"`.
- `compose-captions.ts`:
  - adds `، ؛ ؟` to its punctuation sets
  - adds a pinned `ARABIC_FUNCTION_WORDS` list (في، من، على، إلى، عن، مع، أن، إن، لا، ما، هذا، هذه، التي، الذي) to its "do not end a line on" check, matched after the harakat strip
  - removes harakat (U+064B–U+065F, U+0670) from caption display text for `ar`, on NFC text, never by stripping `\p{M}` after NFD, which would split أ/إ/آ. The "script spelling" invariant now reads: letters are the script's, and vowel marks are not shown.
- `CAPTION_ABSORB_MAX_CHARS` and the terminal row maximum move into the Geometry table.
- `type` on RTL text fails with `E_RTL_TYPE`, because the clip-path reveal is LTR. Authors use `fade`, `fade-up` or `pop`. LTR islands such as terminal and code may still use `type`.
- Digits are shown as the script writes them; there is no Eastern-Arabic conversion.
- The `slide` entrance mirrors (from the left) in RTL.

**Arabic alignment** (`py/talkreel_audio/ctc_align.py`, new; `arabic` dependency group).
- `ctc-forced-aligner`, pinned by commit, with `jonatasgrosman/wav2vec2-large-xlsr-53-arabic`, pinned by Hugging Face revision. The code passes the model explicitly and never falls back to the library's CC-BY-NC MMS default.
- Digit tokens are not in the CTC vocabulary. The helper treats them as unalignable and leaves them for `align-map.ts` to interpolate, the same way it handles words Whisper missed. The reel skill tells Arabic authors to spell spoken numbers out, and to use a display form (`[[٩٠٪|تسعين بالمية]]`) when a figure must appear on screen.
- Input: the canonical WAV plus the spoken text with tashkeel stripped. Output: the existing `WhisperResult` JSON shape, with `model: "ctc:<rev>"`, so `align-map.ts` and the TypeScript side do not change.
- The `align` command picks CTC when `lang=ar` and the group is installed, otherwise Whisper. `alignInputHash` already includes `model` (`src/stages.ts:44`). CTC writes `ctc:<revision>` there, so the engines are separated without a new field, and Whisper hashes stay as they are.

**Arabic TTS** (`py/talkreel_audio/tts_chatterbox.py`, new; `arabic` dependency group).
- Voice id grammar: `chatterbox:<name>` (Chatterbox Multilingual V3; ar, en, fr) and `lahgtna:<dialect>` (`sa`, `eg`, `iq`, `ma`). `<name>` is `default` or the stem of a reference WAV in `assets/voices/<name>.wav`, which is used for cloning.
- `voiceInputHash` gains `engine` (already present as `TTS_ENGINE`, now per-id) and the reference WAV's hash. Bare ids keep today's hash.
- `audio-helper.ts` adds `--group arabic` to the `uv run` call only for prefixed ids and for CTC alignment. `uv sync --project py` stays Kokoro and faster-whisper only, and CI never installs the group.
- `doctor` reports the group and models as optional.
- `voice --audition [--chapter NN]` speaks the first paragraph to `build/audition.wav`, prints its path and records nothing.
- README and THIRD_PARTY document that Chatterbox outputs carry a PerTh watermark, and that own-voice is the unwatermarked path.
- **Licence evidence:** for each model (Chatterbox Multilingual V3, Lahgtna, wav2vec2-xlsr-53-arabic) the implementer records the model-card licence text, the licence field and the pinned revision hash in this doc, under `## Licence evidence`. The maintainer signs that evidence off before the `arabic` group merges (gate 3).
- **Ship bar from the slice-0 spike:** CPU real-time factor ≤ 15 (a 45 s reel voiced in ≤ 12 min) on the maintainer's laptop. Otherwise the docs say "GPU recommended" and present own-voice plus CTC alignment as the primary Arabic path.

**Blocks**, written in the existing pattern: theme CSS, a Node-resolved plan in `compose-scene.ts`, and single-property tweens in `compose-runtime.ts` with `immediateRender: false`. Registry items serve only as visual reference, with CSS ideas credited in THIRD_PARTY.
- `device`: phone or browser chrome around one `<img>` slot. Has an optional `data-zoom="x,y,scale"` on a child `data-target` that is triggered by a cue. Node computes the camera transform (target rect from authored percentages, not measured).
- `cursor` action: `data-click="<target>"` on an element inside a `device`. The cursor travels along a Node-computed quadratic path from its previous position, then plays a click halo (`pop`) and a pressed state on the target, all at the cue.
- `chat`: bubbles with `data-from="user|agent"`, an optional avatar initial and a typing indicator before agent bubbles. Built on the terminal chain timing rules (a cue wins; uncued bubbles chain).
- `list` gains `data-check` items, which tick at their cue (fade of a lit layer, like pipeline chips).
- `stat` gains `data-count` (count-up, a cut candidate): one tween of a proxy number, written via `onUpdate` to text with fixed decimals. The text is a pure function of time. Western digits only in M3.
- `cta`: logo `<img>`, a headline, an action line and an optional URL. Held at least 1.5 s before the chapter end (warn otherwise).

**Mix stage.**
- talk.json `music: {file: "assets/music/x.mp3", credit, license, gainDb?: -18}`.
- `StageName` gains `"mix"`.
- With `music`, concat writes `build/<lang>/concat.mp4`, and `mix` writes `out/<slug>-<lang>.mp4`:
  - `-c:v copy`
  - music looped or trimmed to the duration, faded out over 1.5 s, at `gainDb`, ducked with `sidechaincompress` keyed by the narration
  - pass 1 measures, pass 2 applies `loudnorm` (I=-14, TP=-1.5, LRA=11), AAC 192k at 48 kHz
- The mix hash is the concat MP4 hash, the music sha256 and the params, so music changes never re-render chapters.
- `out/credits.txt` lists the music credit and licence, the voice engine (with the watermark note) and the fonts.
- Loudness is normalised only when `music` is set, so M2 output stays byte-identical. A talk without music is not normalised, and the README says so. `mix` treats `music` as optional internally, so a later `--normalize` flag needs no refactor.

**Reel tooling.**
- `new --reel`.
- `references/reel.md`: hook in 3 s, one beat every 2–4 s, readable UI crops, CTA close, safe zones.
- A length lint in `status`, warn only, from one table: portrait over 90 s says "long for a reel", over 180 s says "over the Shorts limit".
- `frames --safe-zones` draws the zones with an ffmpeg `drawbox` on the extracted PNGs, for review only.

`COMPOSE_VERSION` is "8" today (`src/compose.ts:20`). It stays "8" for landscape LTR pages. Portrait, square and RTL pages get a suffix in the render hash, the same way `ambient` does today (`src/stages.ts:83`).

The slices, their order and the gate-2 cut line are in `docs/roadmap/m3-reels-tasks.md`.

## Files Likely Touched

- `src/geometry.ts` (new), `compose.ts`, `compose-scene.ts`, `compose-runtime.ts`, `compose-captions.ts`, `compose-html.ts`, `compose-hyperframes.ts`, `compose-concat.ts`, `compose-mix.ts` (new), `schema.ts`, `stages.ts`, `state.ts`, `audio-helper.ts`, `script.ts` (only if Arabic tokenising needs it), `commands/{new,voice,align,render,frames,status,doctor}.ts`, `cli.ts`
- `py/pyproject.toml` (`arabic` group), `py/talkreel_audio/{__main__,ctc_align,tts_chatterbox,models}.py`, `py/tests/*`
- `themes/default/theme.css`, `blocks.md`, `examples/{device,chat,cta,portrait}.html`
- `skills/talkreel/SKILL.md`, `references/{reel,scenes,script}.md`
- `test/*`, `test/fixtures/m3-portrait-rtl/`, `scripts/smoke.mjs`, `scripts/determinism.mjs`
- `README.md`, `CLAUDE.md` (invariant wording on tashkeel; new files in Architecture), `THIRD_PARTY.md` (new or extended), `package.json` (one font dependency)

## Data Model/API Changes

- talk.json: `resolution` now honoured for `portrait` and `square`. New `music?`. Voice ids may carry an engine prefix.
- Scenes:
  - `<img>` (in `device`/`figure`/`cta` only)
  - blocks `device`, `chat`, `cta`, `figure`
  - attributes `data-click`, `data-zoom`, `data-target`, `data-check`, `data-count`
  - `<video>` (slice 9, gated)
- New errors: `E_ASSET`, `E_RTL_TYPE`, `E_CLICK_TARGET`.
- Hashes. Each change is additive, so existing talks stay fresh:
  - `sceneInputHash` + asset hashes
  - `alignInputHash` + engine when not Whisper
  - voice hash + engine/ref for prefixed ids
  - new `mix` stage hash
- New dependencies:
  - npm: `@fontsource/ibm-plex-sans-arabic` (OFL)
  - Python `arabic` group only: `chatterbox-tts` (MIT; brings torch), `ctc-forced-aligner` (BSD-2; commit pin)
  - models: Chatterbox Multilingual V3 (MIT), Lahgtna (MIT), wav2vec2-xlsr-53-arabic (Apache-2.0)

## Risks

| Risk | Mitigation |
|---|---|
| Over-scope (about 5 features; M2a's two blocks took three frame-review rounds) | Gate 2 after slice 6. Anything the proof reel does not need is cut there (`<video>` and count-up first) |
| Arabic TTS unusable (CPU speed, word repetition, dialect quality) | Slice 0 measures RTF, and the maintainer listens to samples. Own-voice plus CTC alignment is the guaranteed Arabic path and does not depend on TTS. `voice --audition` before a full run |
| New motion is not deterministic (cursor path, count-up, zoom, video seek) | Single-property tweens with `immediateRender: false`, as in M2. `scripts/determinism.mjs` gains mid-cursor, mid-count and mid-zoom frames. `<video>` is cut on its first failure |
| RTL bugs invisible to unit tests | HTML-level asserts in CI (`dir`, isolation, LTR islands, tashkeel strip). Local golden frames of one Arabic caption page. `type` is forbidden on RTL |
| Hidden geometry coupling to 1920 px | One `Geometry` table, unit-tested per resolution. Landscape is asserted byte-identical to M2 compose output |
| Licence leakage (NC weights, GPL) | Explicit model ids and revisions, no library defaults. `arabic` group is opt-in. THIRD_PARTY lists every model and font with its licence |
| HyperFrames portrait rendering is broken on 0.8.185 | Slice 0 spike. If it fails, a separate bump slice to an exact version, gated by `npm run smoke` and `scripts/determinism.mjs` |

## Alternatives

- **Vendor HyperFrames registry components:** fastest visually, but they pull unpinned `main`, ship their own JS timing (forbidden in scenes), and some are brand-named. Rejected; used as design reference only.
- **Bump HyperFrames to 0.8.193 now:** nothing needed is in 0.8.186–193, and it re-renders every talk (`hyperframesVersion` is in the render hash, `src/stages.ts:81`). Deferred unless the spike forces it.
- **Remotion:** company licence above 3 employees. Rejected for an MIT tool whose users make commercial ads.
- **OmniVoice for dialects:** best Najdi/Gulf coverage, but CC-BY-NC weights. Rejected.
- **A `template`/`aspect` field:** `resolution` already exists (`src/schema.ts:24`). `new --reel` and the skill carry pacing instead.
- **HTML5 interactive ad export:** out of scope (non-goal); the MP4 simulates interaction.

## Decisions

| Decision | Class | Call | Reversible? |
|---|---|---|---|
| Milestone scope | User-Challenge, ruled by Fable | Core: portrait, `<img>`, Arabic path, mix, product blocks, reel skill. `<video>` and count-up are cut candidates at gate 2 | yes |
| Interactive ads | User-Challenge, ruled | Simulated in MP4; no HTML5 export | yes |
| HyperFrames version | Taste, ruled | Stay on 0.8.185; bump only if the spike fails | yes |
| Registry components | Taste, ruled | Write our own blocks; registry is reference only; no brand-named items | yes |
| `<img>` in scenes | User-Challenge, ruled | Yes, local `assets/` only, hashed and copied | yes |
| Arabic TTS engine | User-Challenge, ruled | Chatterbox Multilingual V3 + Lahgtna in an opt-in `arabic` group; Kokoro stays default; watermark accepted and documented | yes |
| Arabic alignment | Taste, ruled | CTC forced alignment with an explicit Apache-2.0 model; Whisper fallback | yes |
| Diacritizer | Taste, ruled | None; captions strip tashkeel | yes |
| Arabic font | Taste, ruled | IBM Plex Sans Arabic only; Cairo only if the frame review finds hook titles weak | yes |
| GPU lane / NC models | User-Challenge, ruled | No | yes |
| Music | Taste, ruled | User-supplied only, `music` in talk.json, credits file | yes |
| Vocabulary | Taste, ruled | Keep "talk"; no `aspect`/`template` field; `new --reel` | yes |
| Proof reel subject | User-Challenge, recommendation | A talkreel promo using talkreel's own screenshots (rights held), AR (Saudi) + EN + FR, kept private in `talks/` | yes |
| Theme CSS and freshness | User-Challenge, ruled by Fable (builder check) | One `theme.css`; accept a one-time re-render of M1/M2; prove identical frames with determinism | yes |
| Arabic and new blocks in landscape | Taste, ruled | Allowed | yes |
| Loudness without music | Taste, ruled | Normalise only with `music`; document it; keep `mix` ready for a later `--normalize` | yes |
| Slice order | User-Challenge, ruled | Builder order, with Arabic TTS first after gate 2 (the reel's audio sets every cue time) | yes |
| Model licence evidence | User-Challenge, ruled | Implementer records card text, licence field and revision; maintainer signs off before the `arabic` group merges | — |
| Digits in Arabic | Taste, ruled | As written; CTC interpolates digit tokens; display forms for figures; count-up Western only | yes |
| Execution models | Mechanical (maintainer's order) | zhioua-os `claude` mode: Opus 5.5 high implements and reviews; Sonnet 5.5 verifies and writes docs | — |

## Test Plan

- **Unit tests (CI):**
  - Geometry per resolution; landscape compose output byte-identical to M2 fixtures.
  - `E_ASSET` cases. Asset copy and hash. `sceneInputHash` changes when an asset's bytes change.
  - RTL page: `dir`, isolation, LTR islands. Arabic caption breaks with `، ؛ ؟` and function words. Tashkeel strip. `E_RTL_TYPE`. Slide mirror.
  - Cursor path and click plan. Zoom transform. Chat chain times. Check ticks. Count-up text at sample times. CTA hold warning.
  - Mix ffmpeg args. Mix hash. No-music path unchanged.
  - Voice id grammar and hashes (bare ids unchanged). Align hash with engine.
  - Length lint table. `new --reel` scaffold.
  - `test/fixtures/m3-portrait-rtl/` composed-HTML asserts.
- **pytest:** CTC helper on a 3 s Arabic WAV, and Chatterbox voice-id parsing. Model-backed tests are skipped when the `arabic` group or models are absent.
- **Local only:**
  - `npm run smoke` extended with one portrait Arabic chapter, mix on, `ebur128` within −14 ± 1 LUFS.
  - `scripts/determinism.mjs` extended with three mid-motion frames.
  - Golden frames of one Arabic caption page.
- **Proof:** the private reel, frame review at most 3 rounds, with the `--safe-zones` overlay.

## Rollout/Rollback

One branch, `m3-reels`, committed per slice and pushed once when the plan is finished. One PR. The maintainer merges, tags and releases. CI runs typecheck and tests only. Every change is additive. Landscape LTR talks without `music` compose to identical `index.html` and timelines and render identical frames. Because `theme.css` changes, they re-render once. Rollback is reverting the PR. The `arabic` group can be dropped without touching the default install.

## Spike results (slice 0)

Slice 0 wrote this section and `## Licence evidence` below it. Rolling slice 0 back deletes both. Slice 7 extends `## Licence evidence` rather than starting it.

Date: 2026-10-25. Machine: Intel Core i7-1165G7 (4 cores, 8 threads, 2.8 GHz), 31.7 GB RAM, Windows 11, CPU only. The laptop ran on battery for the whole spike, with VS Code and Chrome open. Torch used 4 threads. Scratch root (not in the repo): `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-Desktop-github-talkreel\03d31557-6cc5-453e-8ad9-b031b1af97b7\scratchpad\s0\` (below: `<s0>`).

**Portrait render: pass on HyperFrames 0.8.185.** A 3 s, 1080×1920 scratch composition rendered with talkreel's `renderArgs` shape and `--resolution portrait` (telemetry off, same env as `hyperframesEnv`). HyperFrames logged `width 1080, height 1920`. `ffprobe`: h264, 1080×1920, SAR 1:1, DAR 9:16, 3.000 s. In frames at 0.1 s and 2.5 s, each 20 px edge band (red top, green bottom, blue left, yellow right) measures exactly 20 px at the frame edge. The white corner squares sit at (0,0) and (1079,1919). The page's magenta background shows on 0 pixels. So there is no letterboxing, pillarboxing or scaling. Inter text is sharp. No bump slice is needed. Frames: `<s0>\portrait\frame-0.1.png`, `<s0>\portrait\frame-2.5.png`. Video: `<s0>\portrait\portrait.mp4`. Render time was 59.9 s, of which 24.8 s was setup.

**Arabic TTS on CPU.** Both engines use the built-in voice (`conds.pt`), seed 0, and default settings. Lahgtna also uses `repetition_penalty=2.0`, as its demo notebook does. Output is 24 kHz and repeats exactly across runs, so only the timings vary.
- Chatterbox Multilingual V3: `chatterbox-tts` from git `resemble-ai/chatterbox@5de7a54aa4e5e2baadb0182dde554908b48b85c2`, because PyPI 0.1.7 (2026-03-26) predates V3. It is loaded as `ChatterboxMultilingualTTS.from_local(snapshot, "cpu", t3_model="v3")` from `ResembleAI/chatterbox@5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`, with `t3_mtl23ls_v3.safetensors` and `s3gen.pt`. Env: Python 3.11.4, torch 2.6.0+cpu, transformers 5.2.0.
- Lahgtna: the model card's code (`Oddadmix/lahgtna-chatterbox@433cb74200b55457bffa8ee6965a02ecab546a1c`, a fork of the chatterbox source), dialect `sa`. The fork maps `sa` to the `sv` token and applies a Saudi text normaliser. Its loader takes `t3_mtl23ls_v2.safetensors` and `conds.pt` from `oddadmix/lahgtna-chatterbox-v1@6b37e50d1952f07306dc9ff3f3d4ff4ddaf32541`. It takes `ve.pt`, `s3gen.pt` and the tokenizer from `ResembleAI/chatterbox`, which the fork leaves unpinned (`main`). The spike pinned it at the revision above. Env: Python 3.11.4, torch 2.6.0+cpu, transformers 4.46.3.
- Model load from the warm cache took 16–57 s (Chatterbox) and 15–32 s (Lahgtna). The first download took about 15 min for Chatterbox (3.0 GB) and 30 min for Lahgtna (2.3 GB).

Wall time in seconds, audio length in seconds, RTF = wall / audio. Runs 1–3 use the same code, so the spread comes from the machine. In the same code, T3 sampling ran at 1.8 to 6.2 tokens/s. `t` marks the version with tashkeel.

| Engine | Utt. | Audio s | Wall s (run 1 / 2 / 3) | RTF (run 1 / 2 / 3) |
|---|---|---|---|---|
| Chatterbox V3 `ar` | ar1 | 4.08 | 111.1 / 106.8 / 73.9 | 27.2 / 26.2 / 18.1 |
| Chatterbox V3 `ar` | ar2 | 3.96 | 95.4 / 80.8 / 81.8 | 24.1 / 20.4 / 20.7 |
| Chatterbox V3 `ar` | ar3 | 2.72 | 51.7 / 66.9 / 62.7 | 19.0 / 24.6 / 23.1 |
| Chatterbox V3 `fr` | fr1 | 3.96 | 49.0 / 80.8 / 73.8 | 12.4 / 20.4 / 18.6 |
| Chatterbox V3 `ar` | ar1t / ar2t / ar3t | 4.12 / 3.76 / 2.76 | 46.7 / 41.2 / 33.4 | 11.3 / 11.0 / 12.1 |
| Lahgtna `sa` | ar1 | 4.32 | 90.8 / 44.9 | 21.0 / 10.4 |
| Lahgtna `sa` | ar2 | 4.28 | 108.9 / 43.7 | 25.4 / 10.2 |
| Lahgtna `sa` | ar3 | 7.76 | 135.0 / 70.6 | 17.4 / 9.1 |
| Lahgtna `sa` | ar1t / ar2t / ar3t | 3.72 / 3.92 / 3.40 | 47.3 / 52.6 / 45.6 | 12.7 / 13.4 / 13.4 |

**Ship bar (CPU RTF ≤ 15).**
- Chatterbox V3 fails. Its Arabic median RTF is 20.5 pooled (range 11.0–27.2, n = 12), so a 45 s reel takes about 15 min. Split by input: plain text 23.1 (n = 9), tashkeel 11.3 (n = 3). Its French median is 18.6 (n = 3).
- Lahgtna is borderline. Its median RTF is 13.4 pooled (range 9.1–25.4, n = 9), so a 45 s reel takes about 10 min. Split by input: plain text 13.9 (n = 6, 3 of them above 15), tashkeel 13.4 (n = 3).
- Both models are the same 0.5B Chatterbox design, so they should run at about the same speed. The gap here comes mostly from machine state, and possibly from the transformers version (5.2.0 against 4.46.3), which the spike did not isolate.
- Per the plan, the docs say "GPU recommended", and own-voice plus CTC alignment is the primary Arabic path. A re-measure on mains power may come out lower.

**What faster-whisper `large-v3-turbo` heard.** This is an ASR read-back, not a listening test.
- Chatterbox V3: no repetition or truncation. Without tashkeel, some letters drift: السكربت → "السكرفت", وتختار → "وتهتار", بنفسك → "بنستك", كامل → "كامي". With tashkeel the drift remains: ar1t is heard with "المنص" and "كامي", ar2t with السكربت → "السيكريبات", and ar3t as "ده ربو يوم … الفرقه". The French sample is close: talkreel → "Tollcreen" (voix → "voie" is a homophone, not a fault).
- Lahgtna: five of six samples repeat words, add words or run past the text. Without tashkeel:
  - sa-1 reads يحوّل النص حقك as "يحاول أن نصحك" and adds "واحدة" at the end
  - sa-2 repeats "وتختار الصوت"
  - sa-3 runs on past the text ("وانت عارف انه …") for 7.76 s, and the model's own alignment analyzer logged `forcing EOS token … alignment_repetition=True`

  With tashkeel, sa-1t is clean, sa-2t repeats "والباقي علينا" and sa-3t repeats "وشوف الفرق بنفسك".

**CTC alignment: works with the explicit model.** `ctc-forced-aligner` comes from git `MahmoudAshraf97/ctc-forced-aligner@64293cc6d711e57666c4a8b098e9fd93b381fd88`, with torch 2.14.1, transformers 5.20.2 and torchcodec 0.17.0.
- `load_alignment_model(model_path=...)` takes a local `snapshot_download("jonatasgrosman/wav2vec2-large-xlsr-53-arabic", revision="af46c2d8531b8dcbb5e23b952f739b372c2e5d2d")` path. The function has no revision argument, so pinning goes through the snapshot path. The MMS default was never downloaded. Use `romanize=False`. All letters were in the model's vocabulary after the harakat strip.
- Sample: `chatterbox-ar-1.wav` (4.08 s). Alignment took 5.8 s on CPU, after the model load.

| Word | CTC start–end | Whisper start–end | Δ start / Δ end |
|---|---|---|---|
| هذا | 0.12–0.28 | 0.00–0.30 | +0.12 / −0.02 |
| تولكريل | 0.36–0.86 | 0.30–0.92 ("تول كليل") | +0.06 / −0.06 |
| يحول | 1.16–1.52 | 0.92–1.52 | +0.24 / 0.00 |
| النص | 1.58–1.80 | 1.52–1.86 | +0.06 / −0.06 |
| حقك | 1.96–2.24 | 1.86–2.26 | +0.10 / −0.02 |
| إلى | 2.32–2.46 | 2.26–2.44 | +0.06 / +0.02 |
| فيديو | 2.54–2.76 | 2.44–2.78 | +0.10 / −0.02 |
| كامل | 2.84–3.06 | 2.78–3.12 | +0.06 / −0.06 |
| في | 3.12–3.20 | 3.12–3.18 | 0.00 / +0.02 |
| دقايق | 3.26–4.06 | 3.18–3.68 | +0.08 / +0.38 |

- The largest differences between CTC and Whisper are 0.24 s at a start and 0.38 s at an end. The mean absolute difference is 0.08 s.
- The audio energy shows that the two big differences come from silence:
  - 0.00–0.12 s is −72 dB, so CTC's later start for هذا is right.
  - The comma pause at 0.86–1.16 s is −40 dB. CTC leaves it out, while Whisper gives it to يحول.
  - Speech ends at about 3.6 s, and 3.68–4.08 s is −75 dB. CTC's 4.06 end comes from the library's `get_spans`, which pads the last word to the end of the trailing blank.
- Without those cases, CTC and Whisper agree within 0.12 s. The slice-4 helper should cut each word's end at its last non-blank frame, or at least the last word's.

**Install notes (Windows, Python 3.11).**
- The first `ctc-forced-aligner` build failed while compiling the pybind11 extension: `error: Unable to find a compatible Visual Studio installation.` setuptools picked the incomplete VS Build Tools 2026 install (`isComplete: 0`). The build passed on the next try, run inside `vcvars64.bat` from VS Build Tools 2019 with `DISTUTILS_USE_SDK=1`. So the `arabic` group needs MSVC Build Tools on Windows, unless a wheel is published or vendored.
- Python's `-I` flag ignores `PYTHONIOENCODING`, so a cp1252 console fails on Arabic output. The helper must write UTF-8 itself.
- The HF cache warns that symlinks are unsupported (no Developer Mode) and copies files instead.
- Chatterbox downloads `spacy_ontonotes.zip` to `~/.pkuseg` on first use.

**Other notes.**
- The repo also ships `s3gen_v3.pt`, but neither the package at `5de7a54` nor the official V3 Space loads it. Both pair the V3 T3 with `s3gen.pt`.
- The V3 Space runs its own copy of the chatterbox code, with a `text_preproc` tokenizer option that the package does not have.
- The built-in voice of both engines was not checked against the "male voice" preference. The maintainer judges that by ear.

**Samples** (all under `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-Desktop-github-talkreel\03d31557-6cc5-453e-8ad9-b031b1af97b7\scratchpad\s0\samples\`):
- Chatterbox V3: `chatterbox-ar-1.wav`, `chatterbox-ar-2.wav`, `chatterbox-ar-3.wav`, `chatterbox-fr-1.wav`. With tashkeel: `chatterbox-ar-1t.wav`, `chatterbox-ar-2t.wav`, `chatterbox-ar-3t.wav`.
- Lahgtna: `lahgtna-sa-1.wav`, `lahgtna-sa-2.wav`, `lahgtna-sa-3.wav`. With tashkeel: `lahgtna-sa-1t.wav`, `lahgtna-sa-2t.wav`, `lahgtna-sa-3t.wav`.
- `run2\` and `run3\` hold the timing reruns. Their audio is the same.
- Tashkeel text used: ar1t هَذَا تُولْكْرِيل، يِحَوِّل النَّص حَقَّك إِلَى فِيدْيُو كَامِل فِي دَقَايِق. ar2t تِكْتِب السِّكْرِبْت، وِتِخْتَار الصَّوْت، وَالْبَاقِي عَلَيْنَا. ar3t جَرِّبْه الْيَوْم، وِشُوف الْفَرْق بِنَفْسَك.

**Verdict (2026-10-25).** The maintainer delegated the listening verdict: "call astra to choose and decide". `gpt-6-astra` (xhigh, read-only) ruled from the numbers, the Whisper read-backs and the licence evidence. It could not listen, so this is not a listening verdict.
- Chatterbox V3 `ar` and `fr`: ship as experimental, opt-in, "GPU recommended". The CPU median RTF (20.5 and 18.6) misses the bar.
- Lahgtna `sa`: drop from M3. Repeated phrases, added text and the forced-EOS warning are too unreliable for scripted ads. Reviving it later needs pinned downloads and a note that its fork disables the watermark.
- Proof reel (slice 12): own voice plus CTC, with a male Saudi narrator. Kokoro stays the default for EN and FR. GPU speed was not measured.
- Slice 4: keep, with explicit pinned Apache-2.0 weights and no MMS fallback. End each word at its last non-blank frame, and test on recorded narration, not only on a synthetic sample. The library's BSD-2 LICENSE versus CC-BY-NC metadata conflict must be resolved (upstream clarification or a commercial-safe replacement) before the `arabic` group merges. Gate 3 applies.
- Slice 7: narrow to Chatterbox only, keeping auditions; remove the Lahgtna adapters and dialect promises. Pin the git commit and all model files, and document the watermark. Gate 2 makes the final scope call.
- Still to check by ear, before gate 2 reads this verdict: male voice, naturalness, pacing and Saudi delivery; brand and CTA wording. The finished reel's captions against the recording are checked at slice 12.

## Licence evidence

All facts were fetched on 2026-10-25. "Licence field" is `cardData.license` and the `license:` tag from `https://huggingface.co/api/models/<id>`.

| Item | Licence field | Pinned revision | Source |
|---|---|---|---|
| Chatterbox Multilingual V3 (`ResembleAI/chatterbox`, file `t3_mtl23ls_v3.safetensors`) | `mit` (tag `license:mit`) | `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18` | https://huggingface.co/ResembleAI/chatterbox |
| Lahgtna (`oddadmix/lahgtna-chatterbox-v1`) | `mit` (tag `license:mit`); `base_model: ResembleAI/chatterbox` | `6b37e50d1952f07306dc9ff3f3d4ff4ddaf32541` | https://huggingface.co/oddadmix/lahgtna-chatterbox-v1 |
| `jonatasgrosman/wav2vec2-large-xlsr-53-arabic` | `apache-2.0` (tag `license:apache-2.0`) | `af46c2d8531b8dcbb5e23b952f739b372c2e5d2d` | https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-arabic |
| `ctc-forced-aligner` (library) | GitHub SPDX `BSD-2-Clause` | `64293cc6d711e57666c4a8b098e9fd93b381fd88` | https://github.com/MahmoudAshraf97/ctc-forced-aligner |
| Lahgtna inference code (`Oddadmix/lahgtna-chatterbox`) | GitHub SPDX `MIT` | `433cb74200b55457bffa8ee6965a02ecab546a1c` | https://github.com/Oddadmix/lahgtna-chatterbox |
| `chatterbox-tts` code (`resemble-ai/chatterbox`) | GitHub SPDX `MIT` | `5de7a54aa4e5e2baadb0182dde554908b48b85c2` | https://github.com/resemble-ai/chatterbox |

Verbatim excerpts:
- Chatterbox card: front matter `license: mit`. Body: "Licensed under MIT, Chatterbox has been benchmarked against leading closed-source systems like ElevenLabs". The package LICENSE begins "MIT License / Copyright (c) 2025 Resemble AI / Permission is hereby granted, free of charge, to any person obtaining a copy…"
- Chatterbox watermark (card): "Every audio file generated by Chatterbox includes [Resemble AI's Perth (Perceptual Threshold) Watermarker](https://github.com/resemble-ai/perth) - imperceptible neural watermarks that survive MP3 compression, audio editing, and common manipulations while maintaining nearly 100% detection accuracy." In code, `mtl_tts.py` calls `self.watermarker.apply_watermark(wav, sample_rate=self.sr)` on every output. The Lahgtna fork at `433cb74` has that line commented out (`# wav = self.watermarker.apply_watermark(...)`, `src/chatterbox/mtl_tts.py:373`), so the Lahgtna samples here carry no watermark. Perth (`resemble-ai/Perth`) is MIT on GitHub.
- Lahgtna card: front matter `license: mit`, `base_model: - ResembleAI/chatterbox`. The card body has no other licence statement. It states: "In some cases, the model may generate **repeated words or phrases during speech generation**." Its code repo LICENSE is "MIT License / Copyright (c) 2025 Resemble AI", inherited from the fork.
- wav2vec2 Arabic card: front matter `license: apache-2.0`. Body: "Fine-tuned [facebook/wav2vec2-large-xlsr-53](https://huggingface.co/facebook/wav2vec2-large-xlsr-53) on Arabic using the train and validation splits of [Common Voice 6.1](https://huggingface.co/datasets/common_voice) and [Arabic Speech Corpus](https://huggingface.co/datasets/arabic_speech_corpus)."
- ctc-forced-aligner README: "This project is licensed under the BSD 2 Clause License, note that the default model has CC-BY-NC 4.0 License, so make sure to use a different model for commercial usage." The LICENSE file reads "BSD 2-Clause License / Copyright (c) 2026, Mahmoud Ashraf".
  - **Discrepancy:** at the same commit, `pyproject.toml` still declares `license = { text = "CC-BY-NC 4.0" }`, so the built wheel's metadata says CC-BY-NC.
  - The library's default `model_path` is `MahmoudAshraf/mms-300m-1130-forced-aligner` (CC-BY-NC). The spike never loaded it.
