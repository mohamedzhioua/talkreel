# Review notes: ai-engineering-today (EN draft 3, lines ruled 2026-10-22)

Read these before any voice is generated. Nothing has been voiced; the talk is committed on m1.

## New structure

The story runs like this: the definitions give the vocabulary, the workflow shows it in action, and the change section says why it matters.

| Chapter | Part | Words | Min | What it does |
|---|---|---|---|---|
| 01-cold-open | A. Cold open | 75 | 0.50 | Karpathy's "English" line, Anthropic's 80% figure ("needs context"), "this video was made by a tool AI agents built" |
| 02-prompts-to-context | B. Definitions | 147 | 0.98 | Prompt engineering, then context engineering (Anthropic, Tobi Lütke, Karpathy). Line to remember: what you say vs everything the model sees |
| 03-agents-skills-loops | B. Definitions | 202 | 1.35 | Workflow vs agent, "tools in a loop" (Anthropic, Simon Willison), skill, the agent loop, slash loop and slash goal, the cap and stop-reason rule |
| 04-workflows-and-toolbox | B. Definitions | 180 | 1.20 | The workflow patterns ladder, "simplest solution", multi-agent workflows and their token cost, then one line each for subagent, hook (request vs enforcement) and MCP |
| 05-idea-to-design | C. How I work | 223 | 1.49 | Why the OS exists, its central bet, the inventory, then talkreel: idea, research, intake grill, design doc, the before/after (a second AI found that nobody owned the timeline), the CPU-only spike |
| 06-plan-to-review | C. How I work | 193 | 1.29 | Slices (Justin Young's harness finding), gate 1, the three gates, decision classes, execute slices, skeptic voters, Claude + Codex cross-review |
| 07-verify-and-ship | C. How I work | 212 | 1.41 | Verify (Boris Cherny), verify gate, loop guard, scope addition guard, routing ("escalate on stakes"), push once, land verify, the frame catch (an AI reviewing rendered frames caught two overlapping slides), then the payoff: "you're watching what came out of it" |
| 08-what-changes | D. Change | 241 | 1.61 | 8x and Anthropic's own caveats, the 0–20% "fully delegate" survey, Boris / Simon on the shifting job, five adaptation points, the team ask (try one real task together) |
| 09-close | E. Close | 101 | 0.67 | Three takeaways, one thing to try this week, call-back to Karpathy's line |
| **Total** | | **1,574** | **10.49** | |

Words are counted with headings, `[s:id]`, `{#cue}` and `[[OPINION]]` slots stripped.

## Opinion lines (final)

1. `05-idea-to-design.md` `{#why-i-built-it}`: "I wanted the same process every session, and rules that hold."
2. `05-idea-to-design.md` `{#before-after}`: "A second AI, given only that doc, found that nobody owned the timeline. Change one sentence, and every slide after it would drift. We fixed it on paper: now each visual waits for a spoken word."
3. `07-verify-and-ship.md` `{#frame-catch}`: "An AI reviewing my rendered frames caught two slides overlapping mid-transition. Fixed before you saw it."
4. `08-what-changes.md` `{#for-us}`: "I want us to try this on one real task, and review the result together."

Read them aloud once before talkreel voice; change only wording that isn't yours.

These lines are my wording of your view; check that they sound like you: "a capable model will politely reason its way past a rule written in a prompt" (05), "A loop without a cap is a bill. A loop without a stop reason is a mystery." (03), "Prompt engineering is what you say. Context engineering is everything the model sees." (02), the five adaptation points (08), the try-this-week exercise (09) and the closing line "The engineering is still ours."

## Must check before you show it

- **talkreel claims that must be true by the time the team watches.** These came from your brief, not from a file: "this video was made by a tool that AI agents built" (01), "built by parallel subagents, with tests" (06), "approved" and "rendered by the tool itself" (07). The render has not happened yet.
- **Links.** 16 OS and 2 talkreel sources sit on GitHub. Labels show "Source: <title> · github.com · <year>", never the URL or the word private. Grant no repo access for the talk; if asked for the source in Q&A, screen-share the file. s27 and s72 resolve only after m1 merges.
- **Running-time policy: measure, don't trim.** After `talkreel voice`, sum the nine WAV durations. Trim only if the sum is over 648 s, in this order, re-voicing and re-measuring after each:
  1. 08 `{#rewards}` sentence (+ delete s70)
  2. 04 `{#patterns-simple}` + `{#patterns-complex}` sentences
  3. 03 `{#slash-loop}` + `{#slash-goal}` sentences (+ delete s50–s52)

  Stop and report if still over 648 s, or if under 535 s.
- **AGENTS.md line 29 is changing on `wa/behavior`.** On `main` it still reads "Every push bills metered CI twice (push + pull_request)…" (s31) and "Mechanized by scripts/land-verify.sh…" (s66). The branch rewords that line. When it lands on `main`, re-check s31 and s66.
- **CI.** The talk makes no claim about CI status, only the "monthly quota used up twice" fact (s31) and what land-verify does (s66).
- **The 80% figure and its caveat.** On the page, "A caveat: Lines of code is an imperfect measure" follows the 8x figure, in the same section as the 80% figure. So the cold open says "That number needs context", and 08 gives the caveat in the page's order: 8x, then the caveat, then "almost certainly an overstatement".
- **Dates.** The "fully delegate 0–20%" survey (s67, s71) ran in August 2025 and was published 2025-12-02, so 08 says "last year". The 8x figure is Q2 2026.

## Inventory, re-counted on live `main` (c4c35a1, 2026-10-21; `gh api` confirms it is the current head) (dropped from the talk; Q&A only)

- 29 skills (`skills/` folders), 13 subagents (`agents/*.md`), 55 patterns (`patterns/**/*.md` without READMEs), 61 ADRs (`docs/adr/0001` to `0061`, template `0000` excluded). They match README lines 171–173 (s22–s24) and ADR 0061 (s25).
- **Dropped:** the 472 hook-test count (an older beta.4 record) and the four-days-silent-hooks story, both to save words.

## Expert voices and how they were verified

Every quote was fetched live and matched against the page text. Curly quotes, dashes and whitespace were normalised before matching.

- **Anthropic engineering posts.** The `/engineering/…` URLs now redirect to `/research/…`, and `claude.com/blog/…` redirects to `claude.com/resources/articles/…`. The quotes were checked on the redirected pages. Author credits now sit in each source's `publisher` field as the record's credit (the label shows title · host · year).
  - *Building effective AI agents*: the page credits "Erik S. and Barry Zhang". Because the page abbreviates his surname, the narration names only Barry Zhang, for the skills post (03).
  - *Effective context engineering*: Anthropic's Applied AI team.
  - *Agent Skills*: Barry Zhang, Keith Lazuka and Mahesh Murag.
  - *Multi-agent research system*: Hadfield, Zhang and others.
  - *Effective harnesses*: Justin Young.
  - *How AI is transforming work at Anthropic*: the survey was led by Saffron Huang.
- **X posts** (Karpathy s43 and s47, Tobi Lütke s46, Boris Cherny s62 and s68) were read through Twitter's own embed endpoint (`cdn.syndication.twimg.com`), not by loading x.com. The URL in `sources.json` is the x.com post. Karpathy's context-engineering post is long, and the embed shows only its opening, which is the part quoted. Boris's tip 13 ID (2007179861115511237) was found through a thread-reader page, then confirmed on the embed endpoint.
- **Claude Code docs pages** (goal, scheduled tasks, dynamic workflows, hooks guide) are undated, so their date is `2026-10`, the fetch month.

**Spoken word for word:**
- "The hottest new programming language is English."
- Karpathy's "delicate art and science of filling the context window"
- Tobi's "the art of providing all the context for the task to be plausibly solvable"
- Simon's "An L L M agent runs tools in a loop to achieve a goal" and "AI tools amplify existing expertise"
- "a request, not a guarantee… enforcement"
- Boris's "Give Claude a way to verify its work" and "a lot of the work now is code review and steering"
- "almost certainly an overstatement of the true productivity gain"
- "If you can't verify it, don't ship it."
- your OS's central bet
- the Anthropic interviewee's line on learning

**Paraphrased, still cited:** the other definitions, for example "models" for "LLMs" and "instructions" for "LLM instructions".

## Considered and dropped

- **Karpathy's "Software 3.0".** No primary text found. The talk exists only as a video, plus secondary write-ups and a paywalled transcript.
- **Dario Amodei.** Not used. No verifiable, relevant primary quote was found, and Anthropic's own 80% and 8x figures carry that point better.
- **Anthropic's prompt-engineering docs page.** The `docs.claude.com` fetch failed, so the definition comes from the context-engineering post (s44) instead.
- **Verified on the page but cut for length:**
  - Boris's "2-3x the quality" estimate (still inside s62's quote, not spoken).
  - Boris's "100 times more engineers" (Platformer). Too speculative for this talk.
  - Boris's "once there is a good plan, it will one-shot the implementation" (Pragmatic Engineer summary).
  - Ken Aizawa's "Tools are a new kind of software…".
  - Karpathy's "Vibe coding will terraform software…".
  - The multi-agent "90.2%" figure.
- **Tobi Lütke's "reflexive AI usage" memo.** It is posted as an image, so there is no text to verify.
- **Sources removed from `sources.json`:** s3, s16, s17, s19, s22, s23, s24, s25, s32, s34, s37, s38, s41, s42. s4 now quotes only its first sentence.

## TTS spelling choices

Captions show the script's spelling, so these appear on screen as written.

| Written | Instead of | Why |
|---|---|---|
| Claude dot M D, skill dot M D | CLAUDE.md, SKILL.md | file names |
| M C P, L L M, L L Ms, C I | MCP, LLM, CI | spelled out as letters |
| slash loop, slash goal | /loop, /goal | the slash would be dropped or misread |
| twenty twenty-three, twenty twenty-four | 2023, 2024 | read as years |
| eighty percent, eight times, fifteen times, zero to twenty percent, three, two votes out of three | digits | your brief asked for numbers as words. script.md says the same; digits in captions are an M2 marker. |
| Tobi Lutke | Tobi Lütke | avoids the umlaut; it matches his own X display name "tobi lutke" |
| intake grill, design doc, verify gate, loop guard, scope addition guard, land verify, run-until-done | hyphenated names | reads naturally |
| no graphics card | CPU-only | avoids "C P U" |

Worth a one-chapter test voice: how Kokoro says "talkreel" (left as one word; switch to "talk reel" if it mangles it), "Karpathy", "Cherny", "Willison", "Codex", "OpenAI's", "Evals" and "Lutke".

## Cues

Every `{#cue}` is kebab-case and unique within its chapter, with 5 to 14 per chapter. Each one sits directly before its word with no space, as `skills/talkreel/references/script.md` shows. Each definition has its own cue (for example `prompt-engineering`, `agent-def`, `skill`, `slash-goal`, `subagent`, `hook`, `mcp`), and each list item gets one cue (patterns, decision classes, adaptation points), so the scenes can build step by step.

## How this was verified (2026-10-22)

`verify-talk.mjs` checks four things. The script is in the session scratchpad, which is temporary, so copy it if you want to keep it.

1. **Quotes.** It fetches every source URL and confirms the quote appears on the page. GitHub sources are read from live `main` with `gh api`, inside the cited line range. When GitHub has no such file, as for talkreel, it falls back to the local file and says so.
2. **Citations.** Every `[s:id]` resolves, follows a sentence's final punctuation, and no source goes unused.
3. **Cues.** Every cue is unique per chapter.
4. **Format and length.** Word counts are reported, and the script flags digits or markdown in the narration.

**Result (re-run 2026-10-22, 58 sources):** all 58 quotes found, every citation resolves, no unused sources, cues unique, total 1,574 words / 10.49 min, "all checks passed". `node dist/cli.js check --talk talks/ai-engineering-today` also printed `check ok`.

## Q&A prep (not in the talk)

- The build started 2026-10-21; count the days to the render.
- Render: the first pipeline ran at about 14× realtime CPU-only; after the 2026-10-22 fix it renders at about 4× (a 10-minute talk in about 40 min; the 22-s spike ran at 3×).
- The 05 catch was the builder check on 2026-10-21: a fresh-context reviewer given only the design doc → "Builder decisions, Timeline ownership".
- The 07 catch was on a development render. The fix is the fade-then-enter rule (`scenes.md` §4). The frame review is a separate stage after render, not a different model.
- Verification caught my own stale numbers ("472 hook tests", "59 ADRs"; the actual count is 61).
- Licences: GPL-3.0 in the voice chain behind a process boundary (THIRD_PARTY.md); Piper dropped; promo-flow unlicensed, so ideas only.
- A Codex review once flagged 65 unrelated files from an unscoped dirty-tree diff; review packages are scoped now.
- Cost: free tools plus the Claude Code subscription (Codex for the OS cross-review).
- The OS repo is mine and private; files on request.
