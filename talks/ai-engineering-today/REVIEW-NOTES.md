# Review notes: ai-engineering-today (EN first draft)

Read these before any voice is generated. Nothing here has been voiced.

## Length

Spoken words, not counting headings, `[s:id]`, `{#cue}` and the opinion slots:

| Chapter | Words | Target |
|---|---|---|
| 01-cold-open | 79 | ~80 |
| 02-today | 210 | ~220 |
| 03-definitions | 291 | ~330 |
| 04-recommendations | 151 | ~170 |
| 05-my-os | 202 | ~200 |
| 06-a-day | 278 | ~280 |
| 07-guardrails | 148 | ~150 |
| 08-takeaways | 125 | ~120 |
| **Total** | **1,484** | 1,450–1,550 |

That is about 9.9 minutes at 150 wpm. To stay inside 1,550 words, the four opinion slots together have about **60–70 words**, so roughly 15 words each. If you write more, trim chapter 03 or 06.

## Opinion slots (4), to replace with your own words

Each one is a `[[OPINION: …]]` line. The parser does not strip it, so **every slot must be replaced or deleted before `talkreel voice`**, or the TTS will read the hint aloud.

1. `02-today.md`: what changed most in your own working day (for example less typing, more reading diffs).
2. `04-recommendations.md`: which of the five recommendations you would keep if you could keep only one, and why.
3. `06-a-day.md`: a short real moment where a gate or a cross review caught something you would have shipped.
4. `08-takeaways.md`: one concrete thing you want the team to try this week.

The narration in 05 ("a capable model will politely reason its way past a rule written in a prompt") and the "small desk" image in 02 are also my wording of your view. Check that they sound like you.

## Facts to check

- **ADR count is 61, not 59.** On `origin/main` (c4c35a1) `docs/adr/` holds 0001 to 0061. The local `wa/behavior` branch holds only 59. The talk says sixty-one and cites ADR 0061 (s25).
- **Skills 29, subagents 13, patterns 55**: re-counted on `origin/main` (`skills/` has 29 folders; `agents/` has 13 files, `.claude/agents/` has 14 because it adds `explore.md`; `patterns/` has 55 `.md` files besides the READMEs). They match README lines 171–173 (s22–s24).
- **472 hook tests** is the beta.4 figure (CHANGELOG, 0.19.0-beta.4, 2026-09-08), re-run by an independent reviewer. No newer count is recorded on `main`: NEXT_ACTIONS.md still quotes 444 from 2026-08-13. The narration says "for one release" to keep it dated. I did not re-run the suite.
- **CI.** The brief said the README calls hosted CI red. On `main` the README has no such line. NEXT_ACTIONS.md says "Hosted CI runs real steps again" and that post-merge land-verify on `9288070` is GREEN. The talk makes **no** claim about CI status either way, only the "monthly quota exhausted twice" fact (s31).
- **talkreel source (s27)** points at `docs/design/m1-pipeline.md` on talkreel `main`, but that file exists only on the local `m1` branch. The link is dead until m1 is pushed and merged.
- **"That tool is talkreel"** (06) assumes talkreel exists and works by the time you show the video. Adjust if you show it earlier.
- **"Every safety hook on my machine went silent… four days"** (07) is from docs/hooks.md (2026-07-21 incident). The README adds the cause: a moved repo left the plugin root path dangling.

## Quotes that differ from the brief

All quotes in `sources.json` were checked against the fetched pages and the files on `origin/main` (one script, every id passed; s6 only differs by a space that the HTML-to-text step inserted after a bold tag).

- 80%: the page says "more than 80% of the code we merge into Anthropic’s codebase was authored by Claude", as of May 2026. It does not say "merged code".
- 8×: "So 8× lines of code/engineer/day in the second quarter of 2026 is almost certainly an overstatement of the true productivity gain."
- ~4×: the page writes "around 4x", from a March 2026 poll of 130 employees, with Mythos Preview. A separate sentence says the true uplift was "somewhat lower" (s42).
- Agents definition continues: "…, maintaining control over how they accomplish tasks."
- Simplest: "…and only increasing complexity when needed."
- Hooks: "An instruction like “never edit .env” in CLAUDE.md or a skill is a request, not a guarantee. A PreToolUse hook that blocks the edit is enforcement."
- The four phases are named **Explore, Plan, Implement, Commit** (step headings). The page heading is "Explore first, then plan, then code". The talk says "implement", not "code".
- Agent loop: the page has it twice, for Claude Code and for agents in general. s8 uses the general one.

## Source conventions

- **Web quotes** are verbatim substrings of the page text, curly apostrophes kept.
- **Repo quotes** are the *rendered* text of the cited lines. Markdown markup is removed (`**`, backticks, link targets, `>`/`-` prefixes, table pipes at the line edges), and wrapped lines are joined with one space. The URL carries `?plain=1#Lx-Ly` so the exact lines open on GitHub. Table rows keep the inner `|` between cells.
- **Dates:** article publication dates where the page has one. "When AI builds itself" shows no publication date, only "Update 9/18/2026", so it is `2026-09`. Claude Code docs pages are undated: `2026-10` is the fetch month. Repo files carry the date of their last commit on `main`, except s37, which carries the beta.4 release date.
- Narration paraphrases most definitions, to keep them speakable (for example "the model" for "LLMs"), and cites them. The only word-for-word spoken quotes are your OS pitch (05), "a request, not a guarantee… enforcement" (03), "give Claude a check it can run" and "if you can't verify it, don't ship it" (04), and "almost certainly an overstatement" (08).

## TTS spelling choices

Captions show the script's spelling, so these appear on screen as written:

| Written | Instead of | Why |
|---|---|---|
| Claude dot M D | CLAUDE.md | file extension and capitals |
| skill dot M D | SKILL.md | same |
| M C P | MCP | so it is spelled out, not read as a word |
| eighty percent, eight times, four times | 80%, 8×, 4x | symbols |
| twenty twenty-four | 2024 | read as a year |
| twenty-nine, thirteen, fifty-five, sixty-one, four hundred seventy-two | digits | safer for Kokoro |
| intake grill, design doc, to slices, execute slices, verify gate, loop guard, scope addition guard, land verify | hyphenated names | hyphens split anyway; reads naturally |
| no graphics card | CPU-only | avoids "C P U" |

Worth a one-chapter test voice before the full run: whether Kokoro already says "MCP" as letters (then you could write it normally and get cleaner captions), how it says "talkreel" (consider "talk reel"), "Codex", "evals", and "OpenAI's".

## Cues

Every `{#cue}` is kebab-case and unique across the talk: 4 to 17 per chapter, about one every one or two sentences. Chapter 03 and the list in 04 use one cue per item for diagram steps. Scene builders should treat the names as suggestions for what changes on screen.
