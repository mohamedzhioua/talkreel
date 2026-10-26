# Reels

A reel is a short talk with `resolution: "portrait"`, usually one chapter and
30–45 seconds of narration. Start with `new <slug> --title "<title>" --reel`.
It creates `assets/`, `script/en/01-reel.md` and `scenes/01-reel.html` with a
hook, photo proof, benefits list and CTA. Add your own `assets/proof.jpg` and
`assets/logo.svg` (or update both paths) before `check`. Replace the sample
copy and URL. The scaffold keeps the normal voice configuration; choose the
voice deliberately before running `voice`.

## Hook, pacing and CTA

- Open on the viewer's problem and promise. Use `title data-variant="hook"`
  with one short `<h1>`; a restrained `push-in` suits the opening.
- At 150 words/minute, 30–45 seconds is roughly 75–113 spoken words. Read it
  aloud. Each proof beat gets one clear photo or action and several seconds
  to read; move pictures with `{#cue}` / `data-cue`, never seconds in HTML.
- Show proof before listing benefits. Use two or three concise list items.
  With slice 8, put `data-check` on each `<li>` and give each its own
  `data-cue` to tick at the spoken phrase. Keep each line short for portrait.
- Close with `cta`: local logo, `<h2>`, `<p class="action">` and optional
  `<p class="url">`. Ask for one action. Hold the fully entered card for at
  least 1.5 seconds; allow time for the transition and entrance too.
- Run `status` on the portrait talk for one length table with a row per language.
  Each row labels its source: `voiced` totals canonical narration WAV durations
  when every chapter's voice stage is fresh and its WAV is readable; otherwise
  `estimate` uses spoken script words at 150 words/minute for the whole language.
  Over 90 s warns “long for a reel”; over 180 s also warns “over the Shorts limit”.
  These are warnings, not blockers; check the final MP4 duration before delivery.

## Portrait geometry, UI crops and safe zones

`src/geometry.ts` is the authority. The portrait canvas is **1080×1920**.
Padding is top 340, right 72, bottom 872, left 72: the stage is **936×708**,
x 72..1008 and y 340..1048. Keep headings, claims, logos and actions inside
that stage. Captions occupy a separate 936×160 band, bottom offset 696
(y 1064..1224), at 40 px, normally up to 32 characters (36 for absorption).
Leave that band clear.

Platform overlays reserve the top **14%**, bottom **35%** and **6%** on each
side. Only background photography should extend under those zones. Review
`frames --safe-zones` on a portrait draft and inspect every extracted PNG.
The review loop is capped at three rounds; finish at standard quality.

Crop UI screenshots to the relevant task before authoring; avoid a tiny whole
desktop. `device data-frame="browser"` uses a 16:10 viewport; `phone` uses
9:16. Prepare that aspect ratio, then mark targets with screenshot percentage
coordinates. Use one zoom or click to direct attention. Keep essential UI and
the clicked target visible after cropping and zooming; screenshots are images,
not live websites. See `scenes.md` and the theme's `blocks.md` for markup.

## Photos and clips

Prefer the largest original photos. For product shots, slice 8 adds
`<figure data-block="figure" data-fit="cover">`: its `<img>` becomes a
composer-owned full-bleed backdrop with a fixed legibility scrim, between the
ambient layer and stage. Its figcaption stays in the stage. It fades at the
figure's cue, with no transform or camera move; do not add a camera to that
photo beat. A figure without `data-fit="cover"` fits inside the stage.

Cover crops the sides: choose a centred subject and inspect the crop at 9:16.
Keep all text in the stage, even when the image fills the canvas. Use local
`assets/` images with meaningful alt text; no remote image URLs.

Take stills from clips with the author's own tool, then copy the chosen stills
into `assets/`. **1024×576 clips are landscape material**: containing them in
portrait makes a narrow band; covering the canvas cuts most of their width
and magnifies the remaining pixels. Prefer a larger photo when possible.
There is no video block in M3; use stills rather than putting `<video>` in a
scene. The skill's CLI-only mechanical-work rule still applies: ask the author
to extract a still rather than running an ad hoc media pipeline.

## Arabic script and display

Use the author's own Arabic recording, including for Saudi Arabic. Set
`languages: ["ar"]`, `voice: {"mode": "own"}`, and write
`script/ar/01-reel.md` with the matching scene basename. The optional Arabic
group provides script-level CTC alignment; without it, `align` warns and falls
back to Whisper. Arabic pages get `dir="rtl"`, IBM Plex Sans Arabic and
isolated caption words; code and terminal islands remain LTR. Avoid `type`
entrances on Arabic prose.

Tashkeel can remain in the script as pronunciation guidance. Captions remove
harakat U+064B–U+065F and U+0670 after NFC normalisation; script and caption
JSON retain their spelling. There is no automatic diacritizer. Write numbers
as spoken words for alignment; digit tokens and words outside the CTC
vocabulary receive interpolated timings. Use display forms when the caption
should show digits: `[[٣|ثلاثة]]` or `[[90%|تسعون بالمئة]]`. Keep cue names
stable across languages. Check meaning, vowel choices and caption breaks with
the author.

## Voice choice and recording

Own voice is primary for **male French and all Arabic**. For English, Kokoro
`am_michael` is the default candidate to try; this recommendation does not
change the scaffold's `af_heart`. Kokoro `ff_siwis` remains the French option
when an AI voice suits the brief. Arabic TTS is not available in this slice.
Auditions arrive **when slice 7 lands**; do not invoke `voice --audition` yet.

Record in a quiet room, at a consistent microphone distance, as **48 kHz WAV**,
one take per chapter. Leave a little breathing room around the CTA. Save the
take at `audio/<lang>/NN.wav` (for this reel, `audio/fr/01.wav` or
`audio/ar/01.wav`), set `voice.mode` to `"own"`, then still run `voice` to
convert it to the canonical format. Originals stay untouched. Follow with
`align`, `check`, draft `render`, and `frames --safe-zones`.

For a music bed, use a file the author has permission to use and set `music`
with `file`, `credit` and `license` in talk.json. Rendering ducks it under
narration and loudness-normalises the mix. A talk without music is not
loudness-normalised; recording format conversion alone does not set loudness.
