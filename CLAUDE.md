# CLAUDE.md

Guide for AI agents working on talkreel itself. Using talkreel to make a talk is `skills/talkreel/SKILL.md`. Design: `docs/design/m1-pipeline.md`.

## Architecture

- `src/cli.ts`: argument parsing, dispatch. `src/commands/`: one file per command (new, status, doctor, check, voice, align, render, frames).
- `src/talk.ts`, `src/schema.ts`: talk folder paths and loading; hand-written validators (no validator dependency).
- `src/script.ts`: script parsing, spoken text, `[s:id]` and `{#cue}` markers. `src/check.ts`: `talkreel check` rules.
- `src/state.ts`, `src/stages.ts`, `src/hash.ts`: input hashes and stale/fresh per chapter and stage.
- `src/align-map.ts`, `src/cues.ts`: map Whisper words onto script words; resolve cues to times.
- `src/compose*.ts`: build one HyperFrames project per chapter (html, captions, scene, runtime, concat).
- `src/ffmpeg.ts`, `src/proc.ts`, `src/audio-helper.ts`, `src/wav.ts`: tool and process spawning (arrays, never `shell:true`).
- `py/talkreel_audio/`: Kokoro TTS and faster-whisper; JSON on stdout, run via `uv run --project py`.
- `themes/default/`: CSS, `blocks.md` (block markup), Mermaid config. `skills/`, `.claude-plugin/`: the plugin.

## Invariants

- Scenes are timed only by cues, never by seconds. The composer owns the timeline, duration, audio and captions.
- Captions use the script's spelling; Whisper supplies timing only.
- Never bundle or vendor GPL code. The Python helper stays behind a process boundary.
- Renders work offline: GSAP, fonts and Mermaid are copied into `build/`.
- HyperFrames is pinned at 0.8.185. Telemetry is off by default (`--telemetry` opts in).
- No new dependencies without discussion.

## Verify

`npm run build`, `npm run typecheck`, `npm test`, then `uv run --project py pytest`. For pipeline changes, run `npm run smoke` locally (renders; not in CI).
