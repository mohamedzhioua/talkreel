# Script

Goal: the words the narrator speaks, one Markdown file per chapter, written
for the ear. The script is the single source for the voice, the captions (their
text is the script's spelling) and the cue times that drive the scenes.

## Files and length

- `script/en/NN-<chapter>.md`, `NN` = `01`, `02`, … in playing order;
  `<chapter>` is a short kebab-case name. The scene for it will be
  `scenes/NN-<chapter>.html`.
- About **150 words per minute**. A 10-minute talk is about 1,500 spoken words.
- `01` is the **cold open**: 20 to 40 seconds (50 to 100 words) that state the
  problem or a surprising fact, then the promise of the talk and its title.
- Then 5 to 8 chapters of 150 to 300 words each, one idea per chapter, ending
  with a short wrap-up chapter (what to remember, what to do next).

## Format

```markdown
# Verification beats vibes

An assistant can draft a feature in minutes. {#doubt}But who checks it?
{#stat}In one survey, 46% of developers said they distrust the accuracy of AI
tools. [s:example-survey] {#loop}So I work in a loop.
```

- The first line is `# <chapter title>`. Headings are not spoken.
- Plain paragraphs only: no lists, tables, links, code blocks, bold or
  italics. Everything except the markers below is read aloud.
- **`[s:id]`** after every figure, date, quote or attributed claim, placed
  **after the sentence's final punctuation** and followed by a space:
  `… of AI tools. [s:id] Next sentence`. The id must exist in `sources.json`.
- **`{#cue}`** marks where the picture changes. Put it directly before the first
  word of that phrase, with no space after it: `{#loop}So I work…`. Names are
  lowercase kebab-case and unique within the file. Plan about one cue every 5
  to 15 seconds (12 to 40 words): one per new beat, plus one per build inside a
  beat (a list item, a diagram step).
- Never put a marker inside a word or between a number and its unit.

## Writing for the ear

- Short sentences, mostly under 20 words. One idea per sentence.
- Plain spoken language: "we", "you", contractions are fine. No "as you can see
  on this slide".
- Write numbers as words in the narration ("forty-six percent", "twenty
  twenty-six"), because the voice reads them reliably. Captions show the script's
  spelling, so they show the words too. Stat blocks on screen still show digits
  (`46%`). A spoken/display marker that puts digits in captions is planned for M2.
- Spell out acronyms on first use if listeners may not know them ("MCP, the
  Model Context Protocol").
- Avoid words that are hard to voice: long chains of nouns, symbols (`->`,
  `/`), file paths (say "the state file"; show the path in the scene).
- Every claim with a number or a quote carries `[s:id]`. If a sentence needs a
  number you cannot source, rewrite it without the number.

## Done when

- Every chapter file exists, the word counts add up to the target length
  (report per chapter: words and minutes at 150 wpm).
- Every `[s:id]` exists in `sources.json` (`talkreel check` passes).
- Then stop at the **script checkpoint** (see `SKILL.md`): the user edits.
