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
