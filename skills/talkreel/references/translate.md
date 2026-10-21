# Translate

Goal: `script/<lang>/NN-<chapter>.md` for a second language (M1: French, `fr`),
from the approved English script. Run this stage only when `talk.json` lists
the language, and only after the user approved the English script.

## Rules

- **Same files, same names.** One output file per English chapter, same `NN`
  and `<chapter>`, same `# heading` (translated).
- **Keep every marker.** Every `{#cue}` and `[s:id]` from the English chapter
  appears in the translation with the same name, the same count and in the same
  order. The scene file is shared by all languages and its cues must resolve in
  each one. Place each `{#cue}` before the first word of the phrase that carries
  the same idea, even if the word order changes.
- **Natural, spoken target language.** Translate meaning, not words. Use the
  register a native speaker would use in a technical talk; keep established
  English terms when the audience says them in English ("pull request",
  "prompt").
- **Length.** French runs 15 to 20% longer than English. Tighten so each
  chapter stays within 10% of the English word count; the voice is about the
  same speed.
- **Numbers and quotes.** Use the target language's number format in speech
  ("46 %", "3,5"), but never change a value. A quoted source stays verbatim in
  `sources.json`; in the script, introduce a translated quote as a translation
  ("selon …, en substance : …").
- **On-screen text.** Scenes are shared, so their text stays in the scene's
  language in M1. Tell the user this when they ask for a translated video.

## Done when

- One file per chapter, each with exactly the English chapter's cue names and
  source ids, in order (compare the two lists, and report any difference).
- Word counts per chapter are reported next to the English counts.
