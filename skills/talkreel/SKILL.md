---
name: talkreel
description: Make a narrated explainer or talk video (about 10 minutes, animated slides and diagrams, word-synced captions, cited sources) from a topic, a set of docs or a code repository, fully on the local machine. Use when the user asks to make, script, voice, render or review an explainer video, a talk video, a narrated walkthrough of a repo or docs, or continues an existing talkreel talk in talks/<slug>/.
---

# talkreel

You orchestrate a talk from topic to MP4. You do the judgement stages (research,
script, translation, scenes, visual review); the `talkreel` CLI does the
mechanical ones (voice, align, render, frames). A talk is a folder of plain
files under `talks/<slug>/` in the user's working directory; every stage
resumes from those files, never from chat history.

## The CLI

Always call it as:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" <command> [args]
```

Commands: `new`, `status`, `doctor`, `check`, `voice`, `align`, `render`,
`frames`. Run `<command> --help` when unsure of a flag; never guess one.

If `dist/cli.js` is missing, the plugin is not built. Tell the user and ask
before running the setup, because it installs packages:
`npm install && npm run build && uv sync --project py`, from
`${CLAUDE_PLUGIN_ROOT}`. On a first run, also run `doctor` and report what it
says is missing (Node, FFmpeg, Python/uv, models); exit code 2 means a tool is
missing.

## Work loop

1. **Find the talk.** If the user names a new topic, run
   `new "<topic>"` and use the slug it prints. Otherwise use the talk the user
   names, or the only folder under `talks/`; if there are several, ask which.
2. **Read the state.** Run `status --json` for that talk. It lists the stages in
   order with their state (missing, stale or done), per chapter where that
   applies. The next stage is the first that is not done.
3. **Run that stage** (table below), then go back to step 2.
4. **Stop at the checkpoints**, and whenever a stage fails twice for the same
   reason: report the failing output and what you tried.

| Stage | Who | How |
|---|---|---|
| new | CLI | `new "<topic>"` creates `talks/<slug>/talk.json` |
| research | you | Follow `references/research.md`; write `sources.json` |
| script | you | Follow `references/script.md`; write `script/en/NN-<chapter>.md` |
| translate (optional) | you | Only when `talk.json` lists another language; `references/translate.md` |
| scenes | you | Follow `references/scenes.md`; write `scenes/NN-<chapter>.html`, then run `check` |
| voice | CLI | `voice [--lang en]`; skipped by the CLI in own-voice mode |
| align | CLI | `align [--lang en]` |
| render | CLI | `render [--chapter NN] [--lang en]`; `--quality draft` while iterating |
| review | you | Follow `references/review.md` (`frames`, look, fix, re-render; at most 3 rounds) |

Only the CLI does mechanical work. Do not call TTS, Whisper, HyperFrames or
FFmpeg yourself, and do not hand-edit `talk.state.json`, `captions/`, `build/`
or `out/`.

## Human checkpoints

Stop and hand over to the user at exactly these two points:

1. **After the script.** Summarise the chapters (title, word count, estimated
   minutes at 150 words per minute) and list every `[s:id]` claim. Ask the user
   to edit the script files directly and tell you when they are done. Do not
   voice an unapproved script. In own-voice mode, this is also when the user
   records `audio/<lang>/NN.wav`, one file per chapter.
2. **After the review.** Give the output path (`out/<slug>-<lang>.mp4`), its
   duration, what each review round fixed and anything still open. The user
   watches the video and decides.

Between the checkpoints, keep going without asking: run the next stage, report
progress in one line per stage.

## Rules

- Every figure, date and quote shown or spoken comes from `sources.json`, with
  its `[s:id]` in the script and `data-source` on the scene block. If you cannot
  verify a number, leave it out.
- When the user edits a script after scenes exist, re-check that every
  `{#cue}` used by the scene is still in the script; `status` shows which
  chapters went stale.
- Re-render only stale chapters (`render --chapter NN`); the CLI re-concatenates.
- Keep the user's edits. If a file you are about to rewrite has changed since
  you wrote it, read it first and build on it.

## References

- `references/research.md`: sources with verbatim quotes and URLs
- `references/script.md`: spoken script, chapters, `[s:id]` and `{#cue}` markers
- `references/translate.md`: a second language from the same script
- `references/scenes.md`: the scene contract (beats, cues, blocks, timing)
- `references/review.md`: frame review and the fix loop
- `${CLAUDE_PLUGIN_ROOT}/themes/default/blocks.md`: block markup and text limits
