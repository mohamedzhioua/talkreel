# M3 reels — slices

Source: `docs/design/m3-reels.md` (gate 1). Execution: zhioua-os `execute-slices`, `claude` mode, branch `m3-reels`, one commit per slice, one push when the plan is finished.

## Source Boundary

In scope: the design doc's Goals, EARS acceptance, Technical Plan and Test Plan.

Out of scope: its Non-Goals:
- HTML5 ads, avatars
- GPU or non-commercial models
- a diacritizer
- a music or SFX library, beat sync, auto-reframe
- a HyperFrames bump (unless slice 0 forces it)
- vendoring registry items

## Context Read

Project files:
- CLAUDE.md invariants
- `docs/design/m1-pipeline.md`, `docs/design/m2-motion.md`
- `themes/default/blocks.md`
- `skills/talkreel/references/scenes.md`

There is no CONTEXT.md or ADR directory. The repo's glossary is "talk, chapter, beat, cue, block, entrance".

Session inputs, not committed: Sol's review of the reference video and the web research report.

## Target Outcome

A maintainer can make a 30–45 s 9:16 promo reel in Arabic (Saudi), English or French. It shows their own screenshots with cursor clicks, chat and checklists, uses RTL-correct captions, and has a ducked music bed. Existing talks render identical frames after a single re-render.

## Slices

### Slice 0 — Spike: portrait render and Arabic voice/alignment benchmark
Type: HITL (the maintainer listens to the samples; nothing merges)
Dependencies: none
Anchors: `src/compose-hyperframes.ts:renderArgs`, `py/talkreel_audio/tts.py:synthesize`, `py/talkreel_audio/align.py:transcribe_words`
Acceptance Criteria:
- A scratch portrait composition (1080×1920) renders on HyperFrames 0.8.185 with `--resolution portrait`, and its frames show no letterboxing. On failure, record the error and insert a bump slice before slice 1.
- CPU real-time factor is measured for Chatterbox Multilingual V3 (ar, fr) and Lahgtna (sa). The test set is three Arabic sentences and one French sentence, and each measurement records wall time and audio length.
- `ctc-forced-aligner` with the explicit `jonatasgrosman/wav2vec2-large-xlsr-53-arabic` model aligns one sample. Its word timings are checked against the audio.
- Under `## Spike results (slice 0)` in the design doc, append:
  - the numbers
  - the sample paths
  - each model's licence-card text, licence field and the revision used
  - the maintainer's listening verdict
Verification: spike notes in the design doc. Sample WAVs are kept in the scratchpad, not the repo.
Brief: Throwaway work, run via `uv run --with …` or a scratch venv. Do not touch `py/pyproject.toml`. The ship bar is RTF ≤ 15. Rollback: delete the notes section.

### Slice 1 — Geometry per resolution, portrait and square pages, safe-zone frames
Type: AFK
Dependencies: 0
Anchors: `src/compose.ts:composeChapter`, `src/compose-scene.ts:TERM_MAX_CHARS`, `src/compose-captions.ts:CAPTION_MAX_CHARS`, `src/compose-hyperframes.ts:renderArgs`, `src/stages.ts:currentRenderHash`, `src/commands/frames.ts`, `scripts/determinism.mjs`
Acceptance Criteria:
- `src/geometry.ts` holds one table keyed by `landscape|portrait|square`:
  - canvas size and padding
  - caption band, `CAPTION_MAX_CHARS` and `CAPTION_ABSORB_MAX_CHARS`
  - `TERM_MAX_CHARS`, row height and the row maximum
  - safe zones

  Compose code reads these values from the table only.
- The portrait/square guard is removed, and `renderArgs` passes the talk's resolution.
- Landscape `index.html` and `timeline.js` for the existing test fixtures are byte-identical to before. Portrait and square get a compose-version suffix in the render hash.
- `theme.css` has `[data-resolution]` rules, and portrait captions sit above the 35 % bottom zone.
- `frames --safe-zones` overlays the 14/35/6 % zones on portrait talks. On other resolutions it warns and extracts frames without an overlay.
- `scripts/determinism.mjs` can compare three M2 frames rendered before and after the theme change.
- Unit tests cover the table, the per-resolution limits (`E_TERM_LINE` at the portrait limit) and the guard removal.
Verification: `npm run build && npm run typecheck && npm test`. Local: a portrait draft render of the `themes/default/examples/` scenes with frames inspected, plus the M2 before/after frame compare.
Brief: The composer throws on non-landscape resolutions today, and `renderArgs` hard-codes landscape. Rollback: revert.
Review focus: caption band vs safe zones; ambient layer and chapter tag positions in portrait; landscape page bytes

### Slice 2 — Local image assets and the `figure` block
Type: AFK
Dependencies: 1
Anchors: `src/compose-scene.ts:FORBIDDEN_TAGS`, `src/compose.ts:sceneInputHash`, `src/compose.ts:composeChapter`
Acceptance Criteria:
- `<img src="assets/…" alt="…">` is accepted in `figure` (new) and in later slot blocks (`device`, `cta`).
- `E_ASSET` is raised for:
  - absolute paths, `..` and URLs
  - missing files and an empty `alt`
  - extensions other than png/jpg/jpeg/webp/svg
  - an SVG that references anything outside itself
- Images are copied into the chapter build. `sceneInputHash` includes sorted `path:sha256`, and scenes without images keep their hash.
- `figure` is in `blocks.md` and has an example.
Verification: `npm test` covering each `E_ASSET` case, the copy and the hash. A local render of `figure`.
Brief: SVG is loaded only via `<img>`, never inlined. Rollback: revert.

### Slice 3 — RTL text path for Arabic
Type: AFK
Dependencies: 1
Anchors: `src/compose.ts:FONT_FILES`, `src/compose-html.ts`, `src/compose-captions.ts:CAPTION_FUNCTION_WORDS`, `src/compose-runtime.ts` (`type` and `slide`), `src/script.ts:parseScriptFile`, `src/text.ts:normToken`
Acceptance Criteria:
- `@fontsource/ibm-plex-sans-arabic` (OFL; arabic subset; 400/600/800) is added and copied into the build.
- Direction table: `ar` → rtl. RTL pages carry `dir="rtl"`, and LTR pages carry no `dir`. `.tr-word` has `unicode-bidi: isolate`. Terminal and code blocks are `dir="ltr"`.
- Caption breaking:
  - `، ؛ ؟` count as clause or sentence ends
  - the pinned `ARABIC_FUNCTION_WORDS` list never ends a line
  - for `ar`, harakat (U+064B–U+065F, U+0670) are removed on NFC text. Hamza and madda letters are kept, and cue resolution and the captions JSON are unchanged.
- `E_RTL_TYPE` is raised for a `type` entrance on RTL text. `type` is still allowed in terminal and code blocks. `slide` enters from the left in RTL.
- An Arabic script parses into the expected words (with tashkeel and tatweel cases).
- The CLAUDE.md caption invariant gains the harakat clarification.
Verification: `npm test`, including a hand-written Arabic captions fixture and composed-HTML asserts. Local golden frames of one Arabic caption page and one title.
Brief: Arabic also works in landscape. Digits are shown as written. Rollback: revert.
Review focus: mixed Arabic and Latin brand names in one caption line; أ/إ/آ survive the strip; punctuation attached to RTL words

### Slice 4 — Arabic CTC forced alignment
Type: AFK
Dependencies: 0, 3
Anchors: `py/talkreel_audio/__main__.py:build_parser`, `src/audio-helper.ts:runHelper`, `src/commands/align.ts`, `src/stages.ts:currentAlignHash`, `src/schema.ts:WhisperResult`
Acceptance Criteria:
- `py/pyproject.toml` gains an `arabic` dependency group with `ctc-forced-aligner` (pinned by commit). The default `uv sync --project py` is unchanged, and CI never installs the group.
- The helper command `ctc-align --wav --text-file --lang ar` returns the `WhisperResult` shape, with `model: "ctc:<revision>"`. The model is passed explicitly and pinned by revision. The library default (MMS, CC-BY-NC) is never used.
- Digit tokens are left unaligned, so `align-map.ts` interpolates them.
- `align` uses CTC for `ar` when the group is present. Otherwise it uses Whisper and prints the documented hint. Whisper align hashes are unchanged.
- `doctor` reports the optional group.
Verification: `uv run --project py pytest`, with model tests skipped when the group or model is absent. `npm test` for engine selection and hashes. One local run on the slice-0 sample.
Brief: Rollback: revert; the group is opt-in.

### Slice 5 — Mix stage: music bed, ducking, loudness, credits
Type: AFK
Dependencies: 1
Anchors: `src/compose-concat.ts`, `src/state.ts:concatInputHash`, `src/schema.ts:StageName`, `src/commands/render.ts`, `src/ffmpeg.ts`
Acceptance Criteria:
- talk.json `music: {file, credit, license, gainDb?}` is validated, and the file must be under `assets/`.
- With `music`:
  - concat writes to `build/<lang>/concat.mp4`, and its hash gains `music: true`
  - `mix` writes `out/<slug>-<lang>.mp4`: `-c:v copy`; the bed looped or trimmed, with a 1.5 s fade-out; `sidechaincompress` keyed by the narration; two-pass `loudnorm` (I=-14, TP=-1.5, LRA=11); AAC 48 kHz
  - the mix hash is the concat MP4, the music sha256 and the params
  - `out/credits.txt` lists music, voice engines (with the watermark note) and fonts
- Without `music`, concat, its hash and the outputs match M2.
Verification: `npm test` for the args, the hashes and the no-music path. Local `npm run smoke` with music and `ebur128` at −14 ± 1 LUFS.
Brief: `music` is optional inside `mix`, so a later `--normalize` flag needs no refactor. README documents that a talk without music is not normalised. Rollback: revert.

### Slice 6 — Device frame, zoom-to-target, cursor click, CTA card
Type: AFK
Dependencies: 2
Anchors: `src/compose-scene.ts` (block plans), `src/compose-runtime.ts`, `themes/default/blocks.md`, `scripts/determinism.mjs`
Acceptance Criteria:
- `device` (`data-frame="phone|browser"`) holds one `<img>` slot and `data-target` children positioned in percentages.
- `data-zoom` on a cued target reaches the Node-computed camera transform at the cue plus the entrance duration.
- `data-click="<target>"` moves the cursor along a Node-computed quadratic path, then plays a halo and a pressed state at the cue. An unknown target raises `E_CLICK_TARGET`.
- `cta` holds a logo `<img>`, a headline, an action and an optional URL. A hold under 1.5 s before the chapter end produces a warning.
- Every tween is single-property with `immediateRender:false`.
- Determinism covers mid-cursor and mid-zoom frames, byte-identical fresh, sequential, shuffled and at `--workers 1` vs `--workers 4`.
- `blocks.md`, `examples/device.html` and `examples/cta.html` are updated.
Verification: `npm test`, local `node scripts/determinism.mjs`, and a portrait draft render.
Brief: The HyperFrames registry (`device-frame-stage`, `agent-cursor`, `cursor-zoom-follow`, `cta-close`) is visual reference only. Copy no JS; credit CSS ideas in THIRD_PARTY. Rollback: revert.

### Gate 2 — scope cut after slice 6
Type: HITL (delegated to Fable 5.1 by the maintainer)
Review the portrait renders from slices 1–6 and the slice-0 numbers. Decide:
- whether slice 7 ships TTS engines or demotes Arabic to own-voice
- whether slices 9 (`<video>`) and 10 (count-up) are cut

### Slice 7 — Arabic and multilingual TTS engines, auditions, licence evidence
Type: AFK (its merge waits on the maintainer's licence sign-off at gate 3)
Dependencies: 0, 4, Gate 2
Anchors: `py/talkreel_audio/tts.py:synthesize`, `src/stages.ts:currentVoiceHash`, `src/state.ts:voiceInputHash`, `src/commands/voice.ts:cmdVoice`, `src/schema.ts:VoiceConfig`
Acceptance Criteria:
- The `arabic` group gains `chatterbox-tts` (pinned).
- `tts_chatterbox.py` serves `chatterbox:<name>` (ar/en/fr) and `lahgtna:<dialect>` (sa, eg, iq, ma). `<name>` is `default` or `assets/voices/<name>.wav` (a clone reference).
- Voice hashes:
  - bare ids stay Kokoro, with unchanged hashes
  - prefixed ids hash the engine, the revision and the reference WAV's sha256
- Validation:
  - unknown prefixes and dialects are rejected
  - a bare id for `ar` in `ai` mode errors and points to the prefixes or to own-voice
- `voice --audition` writes `build/audition-<lang>.wav` and records no stage.
- `## Licence evidence` in the design doc lists the card text, the licence field and the revision for every model.
- README and THIRD_PARTY document the watermark and the licences.
Verification: `npm test` for the grammar, hashes and validation. `uv run --project py pytest`, with model tests skipped when absent. One local audition per engine.
Brief: If gate 2 demotes TTS, ship only the docs path ("GPU recommended", own-voice primary). Rollback: revert.

### Slice 8 — Chat and checklist ticks
Type: AFK
Dependencies: 6
Anchors: `src/compose-scene.ts` (terminal chain timing), `src/compose-runtime.ts`, `themes/default/blocks.md`
Acceptance Criteria:
- `chat` bubbles (`data-from="user|agent"`) work as follows: a cued bubble starts at max(cue, beat floor); uncued bubbles chain by the terminal rules; an agent bubble is preceded by a typing indicator.
- `list` items with `data-check` tick at their cue.
- `blocks.md` and `examples/chat.html` are updated.
Verification: `npm test`, local `node scripts/determinism.mjs`, and a portrait draft render.
Brief: Rollback: revert.

### Slice 9 — Video clips in device frames (cut candidate)
Type: AFK
Dependencies: 6, Gate 2
Anchors: `src/compose-scene.ts:FORBIDDEN_TAGS`, the `device` block
Acceptance Criteria:
- `<video src="assets/…">` is allowed only in a `device` slot. It is muted, H.264 and local, starts at a cue, and is trimmed by `data-from`/`data-to` on the asset.
- A mid-clip determinism frame is byte-identical across seek orders and worker counts. If it is not, the slice is cut and recorded.
Verification: `npm test`, plus local `node scripts/determinism.mjs`.
Brief: Rollback: revert, or cut.

### Slice 10 — Count-up stat (cut candidate)
Type: AFK
Dependencies: 6, Gate 2
Anchors: `src/compose-runtime.ts`, the `stat` block in `themes/default/blocks.md`
Acceptance Criteria:
- `stat[data-count]` text is a pure function of time, with fixed decimals and Western digits.
- A mid-count determinism frame is byte-identical.
Verification: `npm test`, plus local `node scripts/determinism.mjs`.
Brief: Rollback: revert, or cut.

### Slice 11 — Reel authoring: skill, `new --reel`, length lint, docs, CI fixture
Type: AFK
Dependencies: 1, 3, 5, 6, 7, 8
Anchors: `src/commands/new.ts`, `src/commands/status.ts`, `skills/talkreel/SKILL.md`, `skills/talkreel/references/scenes.md`
Acceptance Criteria:
- `new --reel` scaffolds `resolution: "portrait"`, `assets/`, and hook, proof and CTA script and scene skeletons.
- `skills/talkreel/references/reel.md` covers:
  - hook, pacing, UI crops, CTA and safe zones
  - Arabic tashkeel, spelled numbers and display forms
  - voice choice and auditions
- The `status` length lint (warn only, one table) warns over 90 s ("long for a reel") and over 180 s ("over the Shorts limit").
- Docs:
  - README gets sections on reels, Arabic, music, the voice catalogue and the loudness note
  - THIRD_PARTY lists fonts, models and the watermark
  - CLAUDE.md Architecture lists the new files
- `test/fixtures/m3-portrait-rtl/` composed-HTML tests run in CI.
Verification: `npm run build && npm run typecheck && npm test`, plus `uv run --project py pytest`.
Brief: Rollback: revert.

### Slice 12 — Proof reel and frame review
Type: HITL (screenshot rights, a listening verdict, the final watch)
Dependencies: 11
Anchors: `scripts/smoke.mjs`, `skills/talkreel/references/review.md`
Acceptance Criteria:
- `talks/talkreel-promo/` (gitignored, private): 30–45 s, 9:16, in AR (Saudi) plus EN and FR.
- The reel uses talkreel's own screenshots, a device frame, cursor clicks, chat, a checklist, a CTA and music.
- `frames --safe-zones` review, at most 3 rounds.
- `npm run smoke` gains one portrait Arabic chapter with mix on.
Verification: `npm run smoke`, `node scripts/determinism.mjs`, the frame-review notes and the maintainer's watch.
Brief: Nothing from `talks/` is committed.

## Confirm Gates

- **Gate 1:** this plan and the design doc.
- **Gate 2:** after slice 6. The slice-0 verdict is read there.
- **Gate 3:** model licence sign-off before the `arabic` group merges; push, PR, merge, tag and release, all by the maintainer.

## Deferred / Rejected Slices

- **HyperFrames bump:** deferred. Open question: does portrait render on 0.8.185? Slice 0 answers it.
- **Conditional `reel.css`:** rejected. It would duplicate the composer's logic in `stages.ts`.
- **Vendoring registry components:** rejected. They pull unpinned `main`, carry their own JS timing, and some are brand-named.
- **Rejected for M3 as non-goals:** diacritizer, GPU TTS lane, beat sync, auto-reframe, SFX library, HTML5 ads.

## Next Step

Gate 1: the maintainer says go. Then `execute-slices` (claude mode) starts with slice 0.
