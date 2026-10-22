# talkreel v3 talk: "How I ship with AI", third cut

Status: gate 1 ruled (2026-10-22). Fable 5.1 at max effort made the final call, after gpt-6-astra and Fable 5.1 had both advised at high effort. The engine scope, the honesty rules and the verify-gate wording below stand. The outline does not: after gate 1 the maintainer gave his own structure, and the built talk follows it.

**As built** (`talks/how-i-ship-with-ai-v3/`, about 314 s, `am_michael`):
1. A required opening, then the OS's parts.
2. Context engineering, in plain words.
3. One real ticket in a throwaway repo (`projects-app`), taken through one Claude Code session with the zhioua OS:
   - context-prime writes the codebase map
   - the ticket is saved as a spec on a branch (scope-addition-guard asks first)
   - the grill asks only the client's questions
   - the brief and the slice plan are committed next to the spec
   - the execute workflow builds each slice
   - the review workflow checks the branch
   - an evidence receipt is captured
   - the push
4. Closing advice, with one real quote and two BLS facts.

The captures in the table below remain as short inserts. The outline in "Proposed outline" is kept as the gate-1 record.

## Problem

The second cut (`talks/how-i-ship-with-ai/`, 299 s) answered the maintainer's complaints about the first one: it runs 5 minutes, uses terminal views and motion, and shows the zhioua OS, including its `review` and `execute` workflows run for real. It has three weak points, and the third is serious:

1. **Guardrails shown "as printed".** scope-addition-guard and loop-guard never fired during the build, so chapter 5 showed their messages framed as "what each hook prints". An honest frame is still not footage.
2. **A story told after the fact.** Every scene replays the M1 build from a week earlier. Nothing on screen comes from the making of the video itself, even though that process is the claim.
3. **One claim is now known to be hollow.** The second cut says that verify-gate "ran at all fifty-one stops, and passed every time". It did pass. While capturing real hook fires for this cut, we found out why: it never checked.

## What the captures found (2026-10-22)

All of this was recorded in a throwaway git repo with the installed plugin (0.19.0-beta.9) active, through headless Claude Code sessions (`claude -p --output-format stream-json --include-hook-events`), and in the master session itself. Raw captures stay in the untracked handoff folder.

| # | What | Real output (excerpt) |
|---|---|---|
| A | loop-guard: `node test.js` failed 3 times | `loop-guard: this command has now failed 3 consecutive time(s):` … The agent stopped instead of making a 4th call. |
| B | scope-addition-guard: the agent was asked to fix a bug and also add a helper file | The Write of `format.js` was denied: `scope-sensitive: no approval on record` / `path: …format.js (signal: new durable path)`. The agent fixed the bug, did not route around the block, and reported it. |
| B′ | verify-gate in that same session | The session edited `price.js` and captured no evidence. Both Stop hooks returned exit 0: **no block**. |
| F | verify-gate replayed through the plugin's own dispatcher on session B's Stop payload | real transcript: `exit 0`, nothing printed. The same transcript plus one line carrying the key the hook greps for: `exit 2`, `verify-gate: no captured evidence for this session.` |
| — | Root cause | The hook's no-edits fast path greps the transcript for a `tool_name` key. Claude Code transcripts record tool calls as `"name":"Edit"`. On this machine, 152 session transcripts contain Edit or Write calls, and none matches. So the gate takes the "no edits" exit every time. |
| C | `evidence.sh capture` | `evidence: captured label=test run=20261022T121616Z runtime=unknown exit=0 sha256=dc51b8c9…` |
| D | no-piped-verify, unstaged, on the master agent making this video | `no-piped-verify: blocked.` / `reason : verification command piped into 'head' -- the pipeline reports head's exit code, not the check's` |
| E | `land-verify.sh` on the merge of the second cut (9d09147) | `land-verify: waiting for CI on 9d09147c7a1a on main (timeout 600s)...` / `land-verify: GREEN — all 1 run(s) for 9d09147c7a1a concluded success.` |

session-autoload printed nothing at SessionStart in either run, so it is not shown.

## Goals

- **A new talk.** `talks/how-i-ship-with-ai-v3/`, English, 285–315 s, about 840 spoken words, `af_heart` at speed 1.08.
- **Spine: the making of this cut.** The process that made the video is the proof. Every guard on screen is a real fire. The peak is the honest discovery: trying to film verify-gate for real exposed that it had never checked.
- **Everything on screen is real**, as in the second cut. It is traced in `STORYBOARD.md` by category. Placeholders are only the hooks' own. No OS source code appears, only what the hooks print and what the sessions did.
- **Reuse what is still true.** The second cut's real `review` and `execute` results (2026-10-22), the intake-grill exchange, the builder check and the read-only-agent-guard block stay valid footage.
- **Two cheap engine fixes** for gaps the second cut left:
  - `text-wrap: pretty` on prose blocks, so a split column does not end on a lone word
  - no chapter tag on a beat whose primary block is `title`
  - `COMPOSE_VERSION` becomes "8"

## Proposed outline (about 300 s, about 860 words)

1. **Caught (20 s, ~55 words).** The cold open is capture D: the AI making this video pipes a check into `head`, and the OS blocks it with the reason. "That's the system I ship with. It doesn't take the AI's word for anything." Then the title.
2. **The system (30 s, ~85 words).** One plugin: 29 skills, 13 subagents, 2 workflows, hooks. One path every session (the lifecycle diagram). Only three pauses wait for me.
3. **Decide before code (50 s, ~145 words).**
   - intake-grill asks, with a recommendation
   - the design is committed before code
   - a fresh AI finds that nobody owned the timeline
   - gate 1, shown with **this cut's own** advisor chain: the real astra command line and an excerpt of the real Fable max ruling on this design. "I don't pick. I confirm."
4. **Two workflows (65 s, ~190 words).** `review`: lenses, three skeptics, survive on 2 of 3, and its real 2026-10-22 result. `execute`: implement, spec review, quality review, verify, with its real result. Then I re-run the checks myself.
5. **Guardrails, fired for real (75 s, ~215 words; the peak).**
   - The throwaway repo. loop-guard stops a third identical failure, and the agent stops.
   - scope-addition-guard denies the unrequested file, and the agent reports it instead of working around it.
   - That same session edited a file and ran no check, yet verify-gate said nothing. Replayed: `exit 0`. Add the one line it looks for: `exit 2`.
   - "In the last cut I said it passed fifty-one stops. It did, because it never looked."
   - read-only-agent-guard's real block, as a second real fire.
6. **Ship (40 s, ~115 words).** This cut's own tests and frame review rounds (real numbers, captured during the build). One PR, CI green. land-verify run for real on the last cut's merge: GREEN.
7. **Close (20 s, ~55 words).** I write intent, review evidence, merge. Third cut: 9 min 38 s, then 5 minutes, then this. "Judge it by its evidence. Even the OS's own."

## Non-Goals

- Fixing verify-gate. It lives in the private OS repo, so it is outside this talkreel PR. It is reported to the maintainer as *Suggested, not done*.
- Showing `reverse-spec`: it is not in the installed beta.9.
- The Claude + Codex `mode: "both"` run: it needs its own authorization and adds no new kind of evidence.
- Music, new block types, French.

## Technical Plan

- **Talk folder** `talks/how-i-ship-with-ai-v3/`, with `ambient: true`, the same voice settings, and 7 chapters.
- **`test/disclosure.test.ts`** scans both talk folders.
- **Script:** an Opus 5.5 xhigh subagent writes the script and `STORYBOARD.md` from a verified-facts inventory. Any number outside the inventory is forbidden.
- **Screen paths.** Demo paths are cut to `…\demo\format.js`, never a Windows user path.
- **Engine:**
  - `theme.css`: `text-wrap: pretty` on `.col p`, the definition text and list items
  - `compose-html.ts` or the runtime: hide `.tr-tag` while a `title` beat is on screen
  - `COMPOSE_VERSION` "8"
  - one test each
- **Ship.** Voice, align, render (standard), frames, then a review by 2 fresh agents, at most 3 rounds. One PR. Land-verify after the merge.

## Risks

| Risk | Mitigation |
|---|---|
| The verify-gate segment reads as an attack on the maintainer's own OS, in front of their boss | Frame it as the process working: a real attempt to film found a real gap. Keep it to the facts: exit 0 vs exit 2, 152 transcripts. Make no claim of a fix. |
| "Throwaway repo" footage looks staged | Say so on screen: "a throwaway repo, where I asked the agent to break the rules". The prompts are shown or quoted, and the hook outputs are verbatim. |
| The cold open needs context (what is `head`, and why it matters) | One spoken sentence: "a pipe reports the last command's exit code, so a failing check reads as passing". |
| Length creep from new material | Word budget per chapter, voice chapter 1 first to calibrate. Cut chapter 4 before chapter 5. |

## Decisions (for the advisors)

| # | Question | Proposed call |
|---|---|---|
| D1 | Spine | The making of this cut (captures A–F), not a replay of the M1 build |
| D2 | Show the verify-gate discovery? | Yes, as the peak, factual, with exit 0 vs exit 2. Correct the second cut's claim on screen. |
| D3 | Cold open | Capture D (no-piped-verify on the master agent), not the original request |
| D4 | Reuse the second cut's review/execute results, or re-run the workflows on this cut's engine diff | Reuse: the engine diff is two CSS/compose lines, so a fresh run would show less |
| D5 | Engine scope | Only the two fixes above |
| D6 | Slug and title | `how-i-ship-with-ai-v3`, title "How I ship with AI" |
| D7 | Model names in speech | Keep the second cut's rule (only "two advisor models" and "a fresh context on another model"). On screen, the real astra command line may show the model id, because it is the real command. |
