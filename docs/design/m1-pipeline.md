# talkreel M1: design

Status: draft for gate 1. The Windows feasibility spike (2026-10-21, CPU-only i7-1165G7) passed every component:

| Component | Result |
|---|---|
| Kokoro EN TTS | RTF 0.60 |
| Kokoro FR TTS | RTF 0.63 |
| faster-whisper `small` int8 word timestamps | 54 of 54 words matched, RTF 0.23 warm |
| HyperFrames 0.8.185 render, 1080p30 | about 3× realtime (64 s for a 22 s clip) |
| FFmpeg 9.0.2 mux | ok |

Raw notes are in `.spike/RESULTS.md`, which is not committed.

## Problem

Explaining a technical topic to a team as a video takes days of slide work, recording and editing. Paid AI video services need API keys and subscriptions. talkreel lets Claude Code turn a topic, docs or a repo into a narrated explainer video of about 10 minutes, made of animated slides and diagrams, with captions. Everything runs on the user's machine with free, open-source tools. The only thing the user pays for is their Claude Code subscription. The first real output (M1) is the maintainer's English talk "Software engineering with AI today, and how I work with the AI Engineering OS".

## Goals

- A **talk** is a folder of plain files. The pipeline builds it stage by stage, every stage resumes where it stopped, and the user can edit what any stage produced.
- Claude Code (through the `talkreel` skill) does the judgement work: research with citations, script, translation, scene design, and visual review.
- A `talkreel` CLI does the mechanical work: voice, alignment, composition, rendering and frame extraction. It runs deterministically and has tests.
- Narration comes from either a local TTS voice or the user's own recordings, one WAV per chapter.
- English and French are supported from one script (French is proven on a short sample in M1).
- Captions are synced word by word.
- On-screen citations come from `sources.json`.
- One chapter can be re-rendered without rebuilding the others.

EARS acceptance:
- WHEN the user runs the skill on a topic, the system SHALL produce `out/<slug>-en.mp4` of 9–11 minutes with narration, word-synced captions and one chapter per script section.
- WHEN a chapter's script, scene or audio changes, `talkreel render` SHALL re-render only that chapter and re-concatenate.
- WHEN `voice.mode` is `own`, the system SHALL use `audio/<lang>/NN.wav` as supplied and never synthesize.
- WHEN a scene shows a figure or quote, it SHALL show the source from `sources.json`. `talkreel check` SHALL fail on any `[s:id]` missing from `sources.json`, and on any stat or quote building block that has no source. Unmarked claims in free prose are caught by the script-stage instructions and by the maintainer's review, not by the check.
- WHEN a rendered frame has text overflowing its container or overlapping the captions, the review stage SHALL fix the scene and re-render, at most 3 rounds, then report what is left.

## Non-Goals (M1)

- Avatars, screen recordings, stock footage, background music.
- Voice cloning (Chatterbox, planned for M2).
- Full French videos (M2; M1 proves French on one chapter).
- npm publishing, plugin-marketplace listing, YouTube thumbnails and metadata, brand themes beyond one default theme.
- Rendering in CI.
- Any paid or hosted API.

## User Flow

1. `/talkreel new "Software engineering with AI today"` creates `talks/<slug>/talk.json`.
2. **Research.** The skill gathers sources into `sources.json`. Each entry has an id, URL, verbatim quote and date.
3. **Script.** The skill writes `script/en/NN-<chapter>.md` at about 150 words per minute, marking claims as `[s:id]`. The user edits it.
4. **Translate** (optional). The skill writes `script/fr/`.
5. **Scenes.** The skill writes `scenes/NN-<chapter>.html` from the theme's building blocks: title, definition card, diagram (Mermaid), code, stat with source, list.
6. **Voice.** `talkreel voice` synthesizes `audio/<lang>/NN.wav`. In own-voice mode, the user drops in their recordings instead.
7. **Align.** `talkreel align` writes `captions/<lang>/NN.json` with word timestamps. The text comes from the script and the timing from Whisper.
8. **Compose and render.** `talkreel render [--chapter NN] [--lang en]` renders each chapter, then concatenates them into `out/<slug>-<lang>.mp4`, plus `out/chapters.txt` and `out/transcript.md`.
9. **Review.** `talkreel frames` extracts key frames. The skill looks at them, fixes scenes and re-renders the chapters affected, with a cap of 3 rounds.

`talkreel status` shows which stages are stale. `talkreel doctor` checks Node, FFmpeg, Python/uv and the models.

## Technical Plan

- **CLI**: TypeScript on Node 22+.
  - Uses the built-in `node:util` `parseArgs`, so no argument-parsing dependency.
  - Commands: `new`, `status`, `doctor`, `check`, `voice`, `align`, `render`, `frames`.
- **State**: `talk.state.json` records a content hash of each stage's inputs. A stage is stale when its input hash changes. This is what makes per-chapter re-rendering work.
- **Audio helper**: a small Python package under `py/`, run through `uv run` (Python 3.11) as a **separate process** that prints JSON on stdout. Commands:
  - `tts`: kokoro-onnx, voices `af_heart` (EN) and `ff_siwis` (FR, `lang="fr-fr"`). kokoro-onnx bundles espeak-ng, so no system install is needed on Windows.
  - `align`: faster-whisper `small`, CPU, int8, `word_timestamps=True`.
  - Models download on first use; `talkreel doctor` reports whether they are present.
- **Alignment**: Whisper words are matched to the script words by sequence alignment. Captions show the script's spelling with Whisper's timings, so a misheard word never reaches the screen.
- **Composition**: one HyperFrames project per chapter (`build/<lang>/NN/`), generated from the scene HTML plus the audio and the caption track. Spike-proven contract with HyperFrames pinned at `0.8.185`:
  - the root element is `data-composition-id`
  - narration is `<audio src data-start data-duration data-track-index data-volume>`
  - animation is a paused GSAP timeline registered on `window.__timelines[<id>]`
  - output comes from `hyperframes render --fps 30 --resolution landscape --quality standard`, with `hyperframes check` run before every render
  - chapter duration = audio duration + 0.6 s padding
- **Privacy and offline**:
  - The CLI sets `HYPERFRAMES_NO_TELEMETRY=1` and `HYPERFRAMES_SKIP_SKILLS=1` by default; `--telemetry` opts back in.
  - GSAP is installed from npm and fonts come from `@fontsource/*` (OFL). Both are copied into each build directory at compose time, so renders need no network and no third-party file is committed.
- **Concatenation**: FFmpeg concat demuxer over chapter MP4s with the same codec parameters.
- **Plugin**:
  - `.claude-plugin/plugin.json` plus one skill, `skills/talkreel/SKILL.md`, as the orchestrator, with one reference file per stage (research, script, translate, scenes, review).
  - One skill, not five, so a user only has to discover one entry point.
- **Example talk**: `talks/ai-engineering-today/` is committed as the showcase. It is the maintainer's M1 talk and the source of the README demo video.

### Builder decisions (from the builder check, 2026-10-21)

- **Timeline ownership.** The composer owns the root composition, the duration, the audio, the captions and the `__timelines` registration.
  - Scenes never hard-code seconds. They declare beats anchored to cue words, written `{#cue-name}` in the script and `data-cue="cue-name"` in scene HTML.
  - The composer resolves each cue to a time from the captions, so a chapter whose audio length changes stays in sync.
- **Script parsing.** One file is one chapter. Before TTS and alignment, headings, markdown, `[s:id]` and `{#cue}` markers are stripped. Hashes cover only the spoken text, so editing a citation does not re-voice the chapter.
- **Caption JSON:** `{lang, words:[{text, start, end, matched}]}`. Lines are grouped at compose time.
- **Alignment.**
  - Global sequence alignment over normalised tokens: lowercase, no punctuation, hyphens split.
  - It also allows many-to-one matches for numbers, acronyms and identifiers.
  - Script words that Whisper missed get times interpolated from their neighbours; extra Whisper words are dropped.
  - Fewer than 80% matched fails the stage. This catches an own-voice recording that drifts from the script.
- **Caption band.** The theme reserves a fixed bottom band for captions, and scene building blocks lay out above it. The review loop catches what slips through.
- **Stale inputs.**

  | Stage | Inputs |
  |---|---|
  | voice | spoken text, voice id, engine version |
  | align | WAV hash, spoken text, model |
  | render | scene, captions, WAV, theme, HyperFrames version, compose version, quality |
  | concat | ordered chapter MP4 hashes |

  In own-voice mode the WAV is the root input. A changed chapter always triggers a rebuild of the concat, `chapters.txt` and `transcript.md`, because later offsets move.
- **Audio normalisation.** Own-voice WAVs are resampled to one canonical format in `build/`, and the original file is never touched. Concat refuses a mix of draft and standard renders.
- **Windows spawning.**
  - Never `shell:true` and never `npx.cmd`.
  - HyperFrames runs through `process.execPath` plus its JS entry; Python runs through `uv run --project <abs>/py`.
  - Arguments are passed as arrays.
- **Skill to CLI handoff.** The skill runs `node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js …` and reads `talkreel status --json`. Talks resolve relative to the user's working directory. Setup is `npm install && npm run build && uv sync --project py`.
- **Mermaid** renders in the page from a bundle copied into the build directory. The timeline starts after the SVG exists.
- **Models.** The helper downloads Kokoro model files, pinned by SHA-256, into a user cache directory; `doctor` checks that cache. faster-whisper uses the Hugging Face cache.
- **Fixtures.**
  - vitest uses recorded Whisper JSON and needs no model.
  - pytest uses a committed 1 s WAV and skips when the models are missing.
  - `npm run smoke` runs locally only, never in CI.
- **Validation.** Hand-written type guards in `src/schema.ts`, with no validator dependency.

## Files Likely Touched (all new)

- `package.json`, `tsconfig.json`, `src/cli.ts`, `src/commands/*.ts`, `src/state.ts`, `src/compose.ts`, `src/align-map.ts`, `src/ffmpeg.ts`
- `py/pyproject.toml`, `py/talkreel_audio/{tts,align}.py`
- `themes/default/` (CSS + scene building blocks)
- `.claude-plugin/plugin.json`, `skills/talkreel/SKILL.md`, `skills/talkreel/references/*.md`
- `talks/ai-engineering-today/**`
- `test/**`, `py/tests/**`
- `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` (short contributor guide), `THIRD_PARTY.md`, `.gitignore` (`.spike/`, `talks/*/build/`, `talks/*/out/`, `.venv/`), `.github/workflows/ci.yml`
- `docs/research/2026-10-21-landscape.md`: sourced findings that M2 and M3 build on (voices, avatar, cinematic, licences)

## Data Model/API Changes

- **New file formats**, each with a schema in `src/schema.ts`: `talk.json`, `sources.json`, `talk.state.json`, `captions/*.json`.
- **CLI exit codes**: 0 means ok, 1 means a stage failed, and 2 means a tool is missing (`doctor`).

## Risks

| Risk | Mitigation |
|---|---|
| A free tool fails on Windows without a GPU | Retired by the 2026-10-21 spike (all components passed) |
| Kokoro's French is weak (single B- voice) | Accepted for the M1 French sample; full French videos and voice cloning (Chatterbox, MIT) move to M2 |
| GPL-3.0 in the audio chain (kokoro-onnx pulls `phonemizer` and a bundled espeak-ng) | Repo stays MIT. talkreel never bundles or vendors GPL code: the user's `uv sync` installs it, and the TS CLI talks to the helper only through a process boundary. `THIRD_PARTY.md` names it. Not legal advice. |
| Full 10-minute render takes about 30 min on CPU (3× realtime) | Per-chapter render plus cache, so only stale chapters re-render; `--quality draft` while iterating |
| HyperFrames API churn (young project) | Pin the exact version; isolate it in `src/compose.ts` |
| Whisper mishears technical terms | Script text is the caption truth; Whisper supplies only the timing |
| Agent-written scenes look broken | Visual review loop on extracted frames, capped at 3 rounds |
| Fabricated figures in the talk | `talkreel check` fails any `[s:id]` missing from `sources.json`; numbers only from verified sources |
| GitHub Actions minutes are limited | CI on Linux only, typecheck and unit tests, no models or rendering |

## Alternatives

- **Remotion**: rejected. Companies with more than 3 employees need a paid license, which breaks "free for anyone".
- **Slidev + screen recorder**: rejected. No timeline control, so captions and audio sync are fragile.
- **Manim**: rejected for M1. Great for math animation, but too heavy for slides and diagrams.
- **Five separate skills**: rejected in favour of one skill with references, so there is a single entry point.
- **Pure Python CLI**: rejected. HyperFrames is Node, so TypeScript keeps the render path in one runtime.

## Decisions

| Decision | Class | Call / Recommendation | Reversible? |
|---|---|---|---|
| Render engine HyperFrames | Mechanical | Free-only constraint excludes Remotion | yes |
| TypeScript CLI + Python audio helper via uv | Taste | Decided; brief assumption accepted | yes |
| Per-chapter render + FFmpeg concat | Taste | Decided; enables re-render one chapter | yes |
| Caption text from script, timing from Whisper | Taste | Decided | yes |
| One plugin skill with stage references | Taste | Decided | yes |
| JSON config, no YAML dependency | Taste | Decided | yes |
| Kokoro for EN and FR; Piper dropped from M1 | Taste | Decided. Piper is GPL-3.0 and its French voice's base licence is unverified; one engine is simpler | yes |
| HyperFrames telemetry off by default | Taste | Decided: privacy-first for an OSS tool | yes |
| Licence posture: MIT repo, GPL deps installed by user, process boundary, `THIRD_PARTY.md` | User-Challenge | Recommend as written | yes |
| New dependencies. npm: `hyperframes@0.8.185`, `gsap`, `@fontsource/inter`, `@fontsource/jetbrains-mono`, `mermaid` (diagram SVG), `typescript`, `vitest`. py: `kokoro-onnx`, `faster-whisper`, `pytest` | User-Challenge | Approve the list at gate 1 | yes |
| "Cinematic-lite" in M1: cold open plus chapter cards, slow camera push-in, diagrams that build step by step | User-Challenge | Recommend include: cheap CSS/GSAP only, and it lifts the talk | yes |
| M1 talk narrator | User-Challenge | Kokoro AI voice. The own-voice path is built and smoke-tested with a supplied WAV | yes |
| What is committed for the example talk | User-Challenge | Script, scenes, sources, captions, `talk.json`. WAV and MP4 are gitignored and regenerable; the demo MP4 is a GitHub release asset embedded in the README | yes |
| Talk content origin | User-Challenge | Claude drafts from `docs/research/` plus the agreed outline; the maintainer edits the script before voicing | yes |
| `talkreel check` scope | User-Challenge | Unknown `[s:id]` plus stat and quote blocks without a source; free prose is covered by maintainer review | yes |
| M1 acceptance | User-Challenge | ffprobe gives 9–11 min on `out/<slug>-en.mp4`; a one-chapter French sample at `out/<slug>-fr-ch01.mp4`; maintainer watches and approves | yes |

All User-Challenge rows above were confirmed by the maintainer on 2026-10-21 ("do everything recommended").
| Commit the M1 talk as the example | Taste | Decided; it doubles as the README demo | yes |
| Branch `m1`, one PR at milestone end, maintainer merges | Mechanical | Per agreed GitHub workflow | yes |

## Test Plan

- **Unit tests (vitest)**:
  - state hashing and stale detection
  - script-to-Whisper word mapping, including insertions, deletions and a misheard term
  - chapter timeline math
  - `talkreel check` failing on an unknown `[s:id]`
  - `chapters.txt` format
  - concat list generation
- **Python (pytest)**: TTS and align helpers return a valid JSON schema on a 1-second fixture. These run only locally, because they need models.
- **Local end-to-end smoke**: a two-chapter 15-second talk goes through voice, align, render and concat, then ffprobe asserts the duration and the audio and video streams. This runs before the PR.
- **Acceptance**: the M1 talk renders at 9–11 minutes, frames are reviewed, and the maintainer watches it and approves.

## Rollout/Rollback

- **Rollout**: work happens on branch `m1`. It is pushed once at milestone end, then a PR is opened, CI runs, and the maintainer merges.
- **Rollback**: revert the merge. It is a new repo, so there are no users yet.
