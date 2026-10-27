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
Type: HITL (nothing merges). On 2026-10-25 the maintainer chose to defer the listening verdict to a by-ear check before gate 2. Slice 0 records a delegated model ruling in the meantime.
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
  - a delegated model ruling, recorded as recommendations for gate 2. The maintainer's listening verdict is deferred, at the maintainer's choice on 2026-10-25, to a by-ear check before gate 2, and is added to the design doc then.
Verification: spike notes in the design doc. Sample WAVs are kept in the gitignored `.spike/m3-s0/`, not the repo.
Brief: Throwaway work, run via `uv run --with …` or a scratch venv. Do not touch `py/pyproject.toml`. The ship bar is RTF ≤ 15. Rollback: delete the notes section.

### Slice 1 — Geometry per resolution, portrait and square pages, safe-zone frames
Type: AFK
Dependencies: 0
Anchors: `src/compose.ts:composeChapter`, `src/geometry.ts:GEOMETRY` (formerly `TERM_MAX_CHARS` and `CAPTION_MAX_CHARS`), `src/compose-hyperframes.ts:renderArgs`, `src/stages.ts:currentRenderHash`, `src/commands/frames.ts`, `scripts/determinism.mjs`
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
Precondition: gate 2 starts only after the maintainer's by-ear check of 4 slice-0 clips (`chatterbox-ar-1.wav`, `chatterbox-fr-1.wav`, `lahgtna-sa-1t.wav`, `lahgtna-sa-3t.wav` in `.spike/m3-s0/samples/`). That listening verdict is recorded in the design doc's `## Spike results (slice 0)` first.
Review the portrait renders from slices 1–6 and the slice-0 numbers. Decide:
- whether slice 7 ships TTS engines or demotes Arabic to own-voice
- whether slices 9 (`<video>`) and 10 (count-up) are cut

**Ruling (2026-10-26, Fable 5.1; the maintainer delegated the listening verdict to astra, recorded in the design doc):**
- The proof reel became a 30–45 s French, own-voice, 9:16 ad for Shasama (door photos and clips). Slices 7–12 below are rewritten for it.
- Slice 7: Chatterbox V3 only, experimental and opt-in, with auditions. Lahgtna dropped. Recorded narration is primary for Arabic and male French. Slice 7 runs after slice 12.
- Slices 9 and 10: cut (see each).
- Slice 8: checklist ticks plus a full-bleed `figure[data-fit="cover"]`; `chat` deferred past the reel.
- Order: 8, 11, 12, then gate 3. On 2026-10-26 the maintainer moved slice 7 to a follow-up PR after M3.

### Slice 7 — Chatterbox experimental TTS and auditions (moved to a follow-up PR after M3)
Type: AFK (its merge waits on the maintainer's licence sign-off at gate 3)
Dependencies: 0, 4, Gate 2; not part of the M3 release
Anchors: `py/talkreel_audio/tts.py:synthesize`, `src/stages.ts:currentVoiceHash`, `src/state.ts:voiceInputHash`, `src/commands/voice.ts:cmdVoice`, `src/schema.ts:VoiceConfig`, `src/compose-mix.ts:voiceCredit`
Acceptance Criteria (reduced at gate 2: Chatterbox only, experimental, opt-in):
- The `arabic` group gains `chatterbox-tts` at git `resemble-ai/chatterbox@5de7a54aa4e5e2baadb0182dde554908b48b85c2`. Weights come only from `ResembleAI/chatterbox@5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`, fetched by revision, never `main`. The default `uv sync --project py` is unchanged and CI never installs the group.
- `tts_chatterbox.py` serves `chatterbox:<name>` (ar/en/fr). `<name>` is `default` or `assets/voices/<name>.wav` (a clone reference). No `lahgtna:` prefix, adapter or Saudi claim anywhere.
- Voice hashes:
  - bare ids stay Kokoro, with unchanged hashes
  - prefixed ids hash the engine, both revisions and the reference WAV's sha256
- Validation:
  - unknown prefixes are rejected
  - a bare id for `ar` in `ai` mode errors and points to `chatterbox:<name>` or to own-voice
- `voice --audition [--chapter NN]` writes `build/audition-<lang>.wav`, prints the path and records no stage; it works for Kokoro ids too.
- `voiceCredit` names Chatterbox Multilingual V3 (MIT) and the Resemble PerTh watermark for prefixed ids.
- README: experimental, GPU recommended, CPU ship bar not established, PerTh watermark, own voice is the unwatermarked path. THIRD_PARTY lists Chatterbox code and weights. The design doc drops Lahgtna from its EARS lines and Decisions; its licence-evidence rows stay as history, marked "dropped at gate 2".
Verification: `npm test` for the grammar, hashes and validation. `uv run --project py pytest`, with model tests skipped when absent. One local audition each for `ar` and `fr`.
Brief: The Supertonic / MOSS-Nano spike is not part of M3. Gate 3 gates the `arabic` group's merge, not the reel. Rollback: revert.

### Slice 8 — Checklist ticks and full-bleed cover figure
Type: AFK
Dependencies: 6
Anchors: `src/compose.ts` (page skeleton), `src/compose-scene.ts`, `src/compose-runtime.ts`, `themes/default/blocks.md`
Acceptance Criteria (re-scoped at gate 2):
- `list` items with `data-check` tick at their cue.
- `figure[data-fit="cover"]` puts its image full-bleed in a composer-owned `.tr-backdrop` layer between `.tr-ambient` and `.tr-stage` (object-fit cover, fixed scrim). It fades in at the figure's cue with no transform; the figcaption stays in the stage.
- Pages without these features compose to identical bytes. Asset validation, copy and `sceneInputHash` are unchanged.
- `blocks.md`, `examples/figure-cover.html` and a `data-check` example are updated.
Verification: `npm test`, local `node scripts/determinism.mjs` (mid-fade and mid-tick frames), and a portrait draft render.
Brief: `chat` is deferred past the Shasama reel (slice 8b below). Rollback: revert.

### Slice 8b — Chat (deferred at gate 2)
`chat` bubbles (`data-from="user|agent"`, cued or chained by the terminal rules, typing indicator) stay an M3 design goal but run after the Shasama reel, if at all in M3.

### Slice 9 — Video clips in device frames (cut at gate 2)
Cut. The Shasama clips are 1024×576 landscape: in 9:16 a contained clip is the same band a still gives in a `figure`, and a cover crop keeps 32 % of the width at 3.3× upscale. Seeking `<video>` frame-exactly across render workers is the highest determinism risk left. Revisit after M3 only with a pre-transcode step (ffmpeg to all-intra or a frame sequence) so seeks are frame-exact.

### Slice 10 — Count-up stat (cut at gate 2)
Cut. The static `stat` reads well in portrait, `stat` needs a sourced figure, and per-frame text relayout is a new determinism surface for little value.

### Slice 11 — Reel authoring: skill, `new --reel`, length lint, docs, CI fixture
Type: AFK
Dependencies: 1, 3, 5, 6, 8
Anchors: `src/commands/new.ts`, `src/commands/status.ts`, `skills/talkreel/SKILL.md`, `skills/talkreel/references/scenes.md`
Acceptance Criteria:
- `new --reel` scaffolds `resolution: "portrait"`, `assets/`, and hook, proof and CTA script and scene skeletons.
- `skills/talkreel/references/reel.md` covers:
  - hook, pacing, UI crops, CTA and safe zones
  - photos and clips: prefer the largest photos, cover figures for product shots, stills taken from clips with the author's own tool (1024×576 clips are landscape material)
  - Arabic tashkeel, spelled numbers and display forms
  - voice choice: own voice primary for male French and all Arabic, Kokoro `am_michael` as the EN default candidate, auditions "when slice 7 lands"
- The `status` length lint (warn only, one table) warns over 90 s ("long for a reel") and over 180 s ("over the Shorts limit").
- Docs:
  - README gets sections on reels, Arabic, music, the voice catalogue and the loudness note
  - THIRD_PARTY lists fonts, models and the watermark
  - CLAUDE.md Architecture lists the new files
- `test/fixtures/m3-portrait-rtl/` composed-HTML tests run in CI.
Verification: `npm run build && npm run typecheck && npm test`, plus `uv run --project py pytest`.
Brief: Rollback: revert.

### Slice 12 — Shasama French ad reel and frame review
Type: HITL (the maintainer's recording, music licence, the final watch)
Dependencies: 8, 11
Anchors: `scripts/smoke.mjs`, `skills/talkreel/references/review.md`
Acceptance Criteria (rewritten at gate 2):
- `talks/shasama-reel/` (gitignored, private): `languages: ["fr"]`, `resolution: "portrait"`, `voice: {mode: "own"}`, one chapter, 30–45 s, the maintainer's recording at `audio/fr/01.wav`. Media rights confirmed by the maintainer.
- Blocks in order: a French `title` hook (push-in); 3–4 cued `figure data-fit="cover"` beats; one `list` with 3 `data-check` items; a `cta` with the Shasama logo, headline, action and `shasama.fr`, held at least 1.5 s. Optional: one `device` beat on a shasama.fr screenshot; a `stat` only with a real sourced number. Clips appear only as stills.
- `music` is set with a bed the maintainer holds a licence for, so `mix` normalises the recording. `out/credits.txt` lists the bed, own voice and fonts.
- `frames --safe-zones` review, at most 3 rounds.
- `npm run smoke` gains one portrait chapter with mix on, voiced by Kokoro.
- AR and EN versions are not required for M3.
Verification: `npm run smoke`, `node scripts/determinism.mjs` on the reel chapter (mid-fade, mid-tick, workers 1 vs 4), the frame-review notes and the maintainer's watch.
Brief: Nothing from `talks/` is committed.
Outcome (2026-10-27): rendered with Kokoro `ff_siwis` (no own recording, no music yet): 35.3 s, 1080×1920, the safe-zone review was clean. The maintainer rejected it as an ad. The reference is a competitor's 39 s vertical short: a 3D brand mascot, a trending-music remix, fast cuts of real job-site video, bright white brand screens and a phone-number pill. The engine work in M3 stands. The ad bar moves to the next milestone (below), and slice 12 closes on the pipeline proof (smoke, determinism) rather than on the Shasama ad.

## Next Milestone Candidate — ad-grade reels

Scope set by the maintainer's feedback on slice 12. Each needs its own design and gate:
- **Video B-roll:** full-bleed clips as backgrounds, with a pre-transcode step (all-intra or frame sequence) so seeks stay frame-exact. This revives slice 9's cut.
- **Music-led cutting:** beats cut on the music instead of only on narration cues (M3 rejected beat sync as a non-goal). Narration becomes optional.
- **Brand theme:** a light, high-contrast theme with brand colours and a large logo, beside the dark default.
- **Character or mascot:** an animated brand asset (image sequence, video with alpha, or Lottie), supplied by the maintainer. talkreel places and times it; it does not generate it.
- **Punchy captions:** big kinetic word-by-word captions and a phone or contact pill CTA.
- **Rights:** music and any voice or likeness of a real person must be licensed. A remix of a public figure's voice is not usable without clearance.

## Confirm Gates

- **Gate 1:** this plan and the design doc.
- **Gate 2:** after slice 6. It starts only after the maintainer's by-ear check of the 4 slice-0 clips, and that listening verdict is recorded in the design doc first. The slice-0 verdict is read there.
- **Gate 3:** model licence sign-off before the `arabic` group merges; push, PR, merge, tag and release, all by the maintainer.

## Deferred / Rejected Slices

- **HyperFrames bump:** deferred. Open question: does portrait render on 0.8.185? Slice 0 answers it.
- **Conditional `reel.css`:** rejected. It would duplicate the composer's logic in `stages.ts`.
- **Vendoring registry components:** rejected. They pull unpinned `main`, carry their own JS timing, and some are brand-named.
- **Rejected for M3 as non-goals:** diacritizer, GPU TTS lane, beat sync, auto-reframe, SFX library, HTML5 ads.

## Next Step

Gate 1: the maintainer says go. Then `execute-slices` (claude mode) starts with slice 0.
