# talkreel

Turn any repo, doc or idea into a narrated explainer video. Free, local, bilingual (EN/FR), built by AI agents.

## Demo

<!-- demo: the first talk rendered by talkreel; added with the first release -->

Two talks made by talkreel ship as examples:

- `talks/how-i-ship-with-ai/`: a 5-minute tour of how its maintainer works with an AI engineering OS, told through the build of talkreel itself, with terminal views and a stage pipeline.
- `talks/ai-engineering-today/`: the first, 10-minute talk, "Software engineering with AI today".

## Why it exists

- **Free.** No paid APIs and no API keys. The only thing you pay for is your Claude Code subscription. Voice, captions and rendering run on open-source tools.
- **Local and agent-native.** Everything runs on your machine, and renders work offline. Claude Code drives the pipeline through a skill, and every stage reads and writes plain files, so you can edit anything and resume.
- **Honest sources.** Every figure and quote carries an `[s:id]` marker that points into `sources.json`. `talkreel check` fails on an unknown id and on a stat or quote block with no source.

## How it works

Claude does the judgment work (research, script, translation, scenes, visual review). The `talkreel` CLI does the mechanics (voice, align, render, frames).

```mermaid
flowchart LR
  new --> research --> script --> translate --> scenes --> voice --> align --> render --> review
  review -. fix and re-render .-> render
```

| Stage | Who | Output |
|---|---|---|
| new | CLI | `talks/<slug>/talk.json` |
| research | Claude | `sources.json` (URL, verbatim quote, date) |
| script | Claude | `script/en/NN-<chapter>.md` |
| translate (optional) | Claude | `script/fr/` |
| scenes | Claude | `scenes/NN-<chapter>.html`, then `talkreel check` |
| voice | CLI | `audio/<lang>/NN.wav` (Kokoro, or your own recordings) |
| align | CLI | `captions/<lang>/NN.json` (script spelling, Whisper timing) |
| render | CLI | `out/<slug>-<lang>.mp4` (HyperFrames, FFmpeg) |
| review | Claude | frames checked and fixed, at most 3 rounds |

Scenes never contain seconds. They anchor to cue words (`{#cue}` in the script, `data-cue` in the scene), so a chapter stays in sync when its audio length changes.

Scenes are built from the default theme's blocks (`themes/default/blocks.md`). They include titles, lists, quotes, stats, code, Mermaid diagrams with step-by-step reveals, and:

- a terminal with typed prompts, streamed output, tool calls, diffs and auto-scroll
- a stage pipeline whose rail fills as stages light up

Every animation is a deterministic tween on one paused timeline, so any frame renders the same at any worker count.

## Requirements

- Node.js 22 or newer
- FFmpeg (Windows: `winget install Gyan.FFmpeg`)
- [uv](https://github.com/astral-sh/uv) and Python 3.11
- [Claude Code](https://code.claude.com)

Everything runs on the CPU. No GPU is needed.

## Install

```bash
git clone https://github.com/mohamedzhioua/talkreel
cd talkreel
npm install && npm run build && uv sync --project py
node dist/cli.js doctor
```

`doctor` checks Node, FFmpeg, uv, Python 3.11 and the models. Exit code 2 means a tool is missing. Models download on first use.

To load talkreel as a Claude Code plugin (the repo has `.claude-plugin/plugin.json` and `skills/talkreel/`), start Claude Code with `claude --plugin-dir /path/to/talkreel`. See the [Claude Code plugin docs](https://code.claude.com/docs) for installing it permanently.

## Quickstart

With the skill, tell Claude Code: "make a talk about X". It creates the talk, runs each stage, and stops twice: after the script (you edit it) and after the review (you watch the video).

By hand:

```bash
node dist/cli.js new my-talk --title "My talk"
# write sources.json, script/en/*.md and scenes/*.html in talks/my-talk/
node dist/cli.js check  --talk talks/my-talk
node dist/cli.js voice  --talk talks/my-talk
node dist/cli.js align  --talk talks/my-talk
node dist/cli.js render --talk talks/my-talk --quality draft
node dist/cli.js frames --talk talks/my-talk
node dist/cli.js status --talk talks/my-talk
```

Without `--talk`, the CLI expects `talk.json` in the current directory. `voice`, `align`, `render` and `frames` take `--lang` and `--chapter NN`.

## Your own voice

Record one WAV per chapter as `audio/<lang>/NN.wav` and set `"mode": "own"` under `voice` in `talk.json`. Still run `voice`: in this mode it never synthesizes, it only converts your files to the canonical format in `build/`. Your originals are not touched.

## French

Add `"fr"` to `languages` in `talk.json`, then run the translate stage (Claude writes `script/fr/` from the English script). The default French voice is `ff_siwis`. Kokoro's French is serviceable, not great; M1 proves it on a short sample.

## Performance, honestly

Rendering runs at about 4x realtime on an 8-thread laptop CPU, so a 10-minute talk takes about 40 minutes. Only chapters whose inputs changed are re-rendered. Use `--quality draft` while iterating; `render` refuses to join draft and standard chapters.

## Talk folder layout

```
talks/<slug>/
  talk.json          title, languages, voice, theme, fps, resolution
  sources.json       sources with ids, URLs, quotes, dates
  script/<lang>/     NN-<chapter>.md
  scenes/            NN-<chapter>.html
  audio/<lang>/      NN.wav (generated, or yours)
  captions/<lang>/   NN.json word timings
  build/             per-chapter HyperFrames projects (generated)
  out/               <slug>-<lang>.mp4, chapters.txt, transcript.md
  talk.state.json    input hashes, decides what is stale
```

## Roadmap

These are plans, not features.

- **M2:** voice cloning (Chatterbox), more cinematic upgrades, full French videos.
- **M3:** an optional presenter avatar from a photo, on free cloud GPUs, with consent safeguards.

## Licence and credits

MIT, see `LICENSE`. [THIRD_PARTY.md](THIRD_PARTY.md) lists dependencies. One note: the Kokoro audio chain pulls in GPL-3.0 components (phonemizer, espeak-ng) through your own `uv sync`; talkreel never ships them.

Ideas adapted from lemo-opuscar, mg-styles-15 and ClaudeAnimationBase (all MIT), and from promo-flow (ideas only). Rendering by [HyperFrames](https://github.com/heygen-com/hyperframes) from HeyGen.
