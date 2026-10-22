# Review: look at the frames, fix, re-render

Goal: catch what looks broken before the user watches. You review rendered
frames, not the HTML: a scene that looks right in code can still overflow.

## Loop (at most 3 rounds)

Rounds 1 and 2 review draft renders (talkreel render --quality draft). Before round 3, render every chapter at standard (talkreel render --quality standard; the quality change makes all chapters stale) and review those frames. A round-3 fix re-renders only its chapter, at standard.

1. Run `talkreel frames` for the talk (add `--chapter NN` after the first round
   to look only at chapters you re-rendered). It extracts key frames to
   `build/frames/<lang>/NN/` (0.5 s in, 0.15 s into every beat change as transition-<beat>, 0.9 s after every cue, and 0.5 s before the end) and prints
   JSON on stdout: `{"frames": [{lang, chapter, beat, label, time, path}]}`,
   where `label` is the cue name (or `start` / `end`).
2. Open **every** PNG with the Read tool and look at it. Do not skip frames and
   do not judge from file names.
3. Check each frame against the checklist below. Write down each defect with
   the frame path, the chapter, the beat id and what is wrong.
4. Fix each defect in `scenes/NN-<chapter>.html` (or in the script if a cue is
   misplaced), then run `talkreel check`.
5. Re-render only the chapters you changed: `talkreel render --chapter NN`, at the round's quality.
6. Next round from step 1, for the changed chapters.

Stop after round 3 even if defects remain, and report them.

## Checklist (every frame)

- **Overflow.** No text runs outside its box, gets cut off, or wraps into an
  extra line that pushes the block out of the safe area.
- **Caption collision.** Nothing from the scene reaches the caption band (the
  bottom 160 px). Captions are one line and fully readable.
- **Contrast.** All text is readable against the background. Dim grey is only
  for upcoming caption words.
- **Source labels.** Every number and every quote on screen has its
  "Source: …" label under it, and the label is whole (not truncated).
- **Nothing off-canvas.** No element is cut by the frame edge; diagrams fit
  inside the frame with their labels readable.
- **Sync.** The frame matches what is being said at that moment (compare the
  caption line with the beat); a build step is not visible before its cue.
- **Empty or cluttered.** No blank frame mid-beat; no beat with more than one
  primary block.
- **Reading time** (a heuristic, not a hard rule). Primary on-screen text must
  stay visible for at least `letters / 15 + 1.5` seconds; title and chapter cards
  for at least 4 s. Measure it from the beat's cue time to the next beat's cue
  time. If a beat is too short, shorten its text or move a cue. Never clamp
  caption timings.
- **Transitions.** Look at the frames inside every beat change (the
  `transition-<beat>` frames from `talkreel frames`). Only the outgoing beat should be
  fading, then the incoming one should enter; never both at once.
- **The rubric is this checklist.** Grade every frame against it, every round,
  within the 3-round cap.

## Fixes, in order of preference

1. Cut words. Most overflow is too much text; respect the limits in
   `themes/default/blocks.md`.
2. Split the beat into two beats with a new `{#cue}` in the script.
3. Change the block (a long list becomes a diagram, a long quote becomes a
   shorter verbatim excerpt).
4. Move a cue so a build lands on the right words.

Never fix by adding `style` attributes or seconds; both are forbidden in scenes.

## Report

For each round: the frames you looked at (paths), the defects found, the fix
for each, and the chapters re-rendered. After the last round, list anything
still open. Then stop at the **review checkpoint** (see `SKILL.md`).
