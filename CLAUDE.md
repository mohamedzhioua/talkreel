# CLAUDE.md

Guide for AI agents working on talkreel itself. Using talkreel to make a talk is `skills/talkreel/SKILL.md`. Design: `docs/design/m1-pipeline.md`.

## Architecture

- `src/cli.ts`: argument parsing, dispatch. `src/commands/`: one file per command (new, status, doctor, check, voice, align, render, frames).
- `src/talk.ts`, `src/schema.ts`: talk folder paths and loading; hand-written validators (no validator dependency).
- `src/script.ts`: script parsing, spoken text, `[s:id]` and `{#cue}` markers. `src/check.ts`: `talkreel check` rules.
- `src/state.ts`, `src/stages.ts`, `src/hash.ts`: input hashes and stale/fresh per chapter and stage.
- `src/align-map.ts`, `src/cues.ts`: map Whisper/CTC words onto script words; resolve cues to times.
- `src/geometry.ts`: landscape, portrait and square canvas/stage/caption limits, safe zones, device viewport and camera/cursor geometry.
- `src/compose.ts`: prepare scenes, hash and copy local assets, build one HyperFrames project per chapter.
- `src/compose-html.ts`, `src/compose-scene.ts`: HTML parsing and validation, local image slots, RTL/LTR direction, cue timeline.
- `src/compose-captions.ts`: caption breaking and display, including Arabic harakat stripping.
- `src/compose-blocks.ts`, `src/compose-runtime.ts`: device/CTA and terminal/pipeline motion plans; paused timeline playback, device raster repainting.
- `src/compose-hyperframes.ts`, `src/compose-concat.ts`: resolution-aware rendering, joins and output metadata.
- `src/compose-mix.ts`: music ducking, two-pass loudness normalisation, mix hashes' parameters and credits; automatic only with music.
- `src/ffmpeg.ts`, `src/proc.ts`, `src/audio-helper.ts`, `src/wav.ts`: tool and process spawning (arrays, never `shell:true`).
- `py/talkreel_audio/tts.py`, `align.py`, `models.py`, `__main__.py`: Kokoro TTS, faster-whisper, pinned model cache/probes and helper dispatch; JSON on stdout, run via `uv run --project py`.
- `py/talkreel_audio/ctc_align.py`: optional `ctc-align` with revision-pinned Arabic wav2vec2 weights and vocabulary filtering; `py/pyproject.toml` keeps the `arabic` group opt-in.
- `src/commands/new.ts`, `status.ts`: portrait `new --reel` skeleton and warn-only portrait length table (fresh narration durations, script estimate fallback). `test/fixtures/m3-portrait-rtl/` and `test/arabic.test.ts`: composed portrait RTL coverage in `npm test`.
- `themes/default/`: CSS, `blocks.md` (block markup), Mermaid config. `skills/`, `.claude-plugin/`: the plugin.

## Invariants

- Scenes are timed only by cues, never by seconds. The composer owns the timeline, duration, audio and captions.
- Caption letters use the script's spelling; Arabic vowel marks (harakat) are not shown. Whisper supplies timing only.
- Never bundle or vendor GPL code. The Python helper stays behind a process boundary.
- Renders work offline: GSAP, fonts and Mermaid are copied into `build/`.
- HyperFrames is pinned at 0.8.185. Telemetry is off by default (`--telemetry` opts in).
- No new dependencies without discussion.

## Verify

`npm run build`, `npm run typecheck`, `npm test`, then `uv run --project py pytest`. For pipeline changes, run `npm run smoke` locally (renders; not in CI).
