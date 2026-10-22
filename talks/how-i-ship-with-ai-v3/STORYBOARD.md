# Storyboard: how-i-ship-with-ai-v3 (third cut, script stage)

One thread runs through the talk: one real ticket in the throwaway repo `projects-app`, taken from a codebase map to a push in one Claude Code session with the zhioua OS (run S, turns S0 to S9, 2026-10-22). Three short real inserts sit beside it: a guard test (A), a hook that fired on the AI making this video (D), and this machine's verify-gate audit (G). The closing is Mohamed's advice, one quote and two BLS facts.

About 805 spoken words after the voice pass (`am_michael`, speed 1.0). Measured narration: 309.9 s, 314.1 s with the chapter padding. The spoken form of the OS name is "Zee-wa" (Mohamed's pronunciation); captions show "Zhioua". The pay figure is spoken "about one hundred thirty-six thousand dollars" and shown exactly as $135,980.

## Talk-wide rules

- **Everything on screen is real.** Every terminal row, code line, list item and caption comes from the captures, the verified facts or `sources.json`. Each block names its category:
  - **demo session**: run S, one resumed Claude Code session in `projects-app` with zhioua-os 0.19.0-beta.9 (turns S0 to S9)
  - **OS hook message**: text a hook printed during a recorded session
  - **workflow result**: what the `execute` or `review` workflow returned, or its own progress record
  - **OS inventory**: the installed plugin, 0.19.0-beta.9
  - **guard test**: capture A, a throwaway repo where the agent was told to trip the guards
  - **this video's build**: capture D (the session making this video) and capture G (this machine's transcript audit)
  - **research source**: an entry in `sources.json`
- **Cuts, never inventions.** Rows may be cut with `…`. A long line is cut or continued as an indented `out` row, never wrapped. Paths are cut to `…\projects-app\…` or shown repo-relative. No absolute path, no Windows user path, no OS working folder, no email, no private repo name, no env-var name, no OS source code.
- **Rendering.** Agent output is drawn the way the terminal UI renders it: markdown bold marks, backticks and `#` heading marks are not drawn. Code blocks show committed files raw, as they are on disk.
- **Typed prompts.** Every prompt row is a cut of a prompt the operator really typed. The exact prompts per turn are recorded with the captures (run S prompt log). Prompt rows show only:
  - the two slash commands the operator ran, `/zhioua-os:context-prime` (S0) and `/zhioua-os:to-slices` (S5), each confirmed by the session's own output (S0 works from the context-prime skill and writes the map; S5 prints the to-slices sections and says "you asked for a plan, not a saved document")
  - the pasted ticket, which the agent saved "word for word" (spec file lines 1 to 3)
  - my two answers as the agent quoted them in committed files: "1–6 as recommended" (the Requirement Brief) and "Your recommendations are ok" (the slice plan)
  - capture A's prompt, verbatim in the facts inventory
  Each is the start of the operator's real prompt for that turn, cut with nothing added. No other prompt is drawn.
- **Approvals.** Headless runs have no approve or reject prompt. In S1 the scope-addition-guard `ask` on the new spec file came back refused, and the agent did not route around it. The operator gave the approval by running the next turn (S2) with that guard stood down for it. Spoken as "It asks me first; I approve." No approval click is drawn.
- **Hooks that did not fire are never shown as firing.** Every hook on screen fired for real: scope-addition-guard (S1), the session-start map pointer (S1 to S9), loop-guard (A), no-piped-verify (D). verify-gate appears only as the audit (G): spoken "open mismatch", scoped to "this machine and version", never "bug", "broken", "fixed" or "drift"; no cause, no blame, no bypass line.
- **The end is the push.** `origin` is a local bare repo, so this push has no CI and no land-verify. The video never claims a merge, a PR, CI or a deploy. The agent's own line that it has not seen my receipt stays on screen.
- **Quotes and numbers** come only from `sources.json`, verbatim. "AI isn't going to replace us" is Mohamed's view: labelled "My view", never on a beat with a source credit. Pay and growth are the two BLS facts only; there is no salary-growth number.
- **Ambient on.** The chapter tag comes from each heading's `{tag: …}`. Title beats hide the tag.
- **Motif: the rail.** Chapter 02 draws the path as an unlit Mermaid diagram (8 stages). Pipelines then grow, and every chip ends lit, as the pipeline contract requires:
  - chapter 04: Map, Ticket, Save done; Grill lights
  - chapter 05: Map to Grill done; Plan lights
  - chapter 06, last beat: Map to Review done; Push lights, so all 8 are lit
- **Code blocks** put `data-anim="fade"` on each line instead of the default typing, because their beats last 4 to 8 s. A cued line enters at its cue.

### Terminal row format

Each terminal below lists its title, its source category and its rows in order:

```
NN  role           tone    enters         | exact text (everything after "| ")
```

- **role**: `prompt-claude` (`>` drawn by CSS), `prompt-shell` (`$`), `tool`, `result`, `out`, `diff-add`, `diff-del`
- **tone**: `ok`, `err`, `warn`, `dim`, `accent`, or `-`
- **enters**: `beat` (with the beat), `chain` (chains after the row above), `cue:<name>` (`data-cue`)
- **Continuation rows** are `out` rows with leading spaces; they keep the tone of the line they continue.

Code blocks list their lines the same way:

```
LNN  emph?  enters      | exact text
```

Every terminal row is at most 72 characters and every code line at most 64, checked by script on the text after `| `. Every terminal has at most 13 rows.

---

## 01 · Hello (about 25 s, 71 words)

- **Output:** the required opening, the reason for the OS, its name, and the promise of one real ticket.
- **Route:** title, split, hook title, title.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Hello, Astrolab teammates!…" | `title`: kicker "Astrolab Agency · team talk", h1 "How I ship with AI", subtitle "Mohamed · software engineer" |
| workflow | "My workflow changes…" | `split`: col 1 h3 "Each task, each project", p "My workflow changes with each one." |
| months | "Over the last nine months…" | the split's col 2 (`data-cue="months"`): h3 "The last nine months", p "AI has changed how we work." |
| building | "So I'm building my own OS…" | `title` `data-variant="hook"`, `data-camera="push-in"`: h1 "AI changed how we work. <em>So I'm building my own OS.</em>" |
| name | "I call it Zhioua OS…" | `title`: kicker "My own OS", h1 "Zhioua OS", subtitle "Next: one real ticket, all the way to the push" |

---

## 02 · The OS (about 23 s, 64 words)

- **Output:** what the plugin holds, in plain words, with the real counts.
- **Route:** list, list, diagram (the unlit path).
- **Source:** OS inventory (0.19.0-beta.9: 29 skills, 13 subagents, 2 workflows `execute` and `review`, hooks). The component names are the ones approved in the base script.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "It's a plugin inside Claude Code…" | `list`: heading "A plugin inside Claude Code"; items enter at their cues |
| rules | "Working agreements set the rules." | item "Working agreements set the rules" (`data-cue="rules"`) |
| skills | "Skills are recipes…" | item "29 skills: recipes for common tasks" (`data-cue="skills"`) |
| agents | "Specialist agents take focused jobs…" | item "13 specialist agents: focused jobs" (`data-cue="agents"`) |
| workflows | "Two workflows, execute and review…" | `list`: heading "And around them"; item "2 workflows: execute and review" (with the block) |
| commands | "Commands start things." | item "Commands start things" (`data-cue="commands"`) |
| hooks | "Hooks check actions." | item "Hooks check actions" (`data-cue="hooks"`) |
| notes | "Project notes keep decisions…" | item "Project notes keep decisions" (`data-cue="notes"`) |
| scripts | "and scripts save evidence" | item "Scripts save evidence" (`data-cue="scripts"`) |
| together | "Together, they help me take a ticket…" | `diagram`, no steps (nothing lit); figcaption "One real ticket, from map to push" |

```
flowchart LR
  M[Map] --> T[Ticket] --> S[Save] --> G[Grill] --> P[Plan] --> E[Execute] --> R[Review] --> U[Push]
```

---

## 03 · Context (about 45 s, 129 words)

- **Output:** context engineering in plain words, the words the demo needs, and one real guard fire.
- **Route:** definition, diagram, quote, list, split, terminal (A), list.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Context engineering means…" | `definition`: term "Context engineering", text "Choosing what the AI sees: instructions, tools, files and history." |
| workbench | "Think of a workbench…" | `diagram` (below), figcaption "Only what the job needs" |
| quote | "Anthropic calls it…" | `quote` `data-source="s:anthropic-context"`: "At Anthropic, we view context engineering as the natural progression of prompt engineering."; figcaption "Anthropic, Effective context engineering" |
| skill | "A skill is a recipe…" | `list`: heading "Skill and agent"; item "A skill is a recipe" (with the block) |
| agent | "An agent is the AI…" | item "An agent is the AI, using tools to follow it" (`data-cue="agent"`) |
| harness | "Claude Code is the harness…" | `split`: col 1 h3 "Harness", p "Claude Code: the workspace, its tools and its permissions." |
| workflow | "A dynamic workflow runs agents…" | the split's col 2 (`data-cue="workflow"`): h3 "Dynamic workflow", p "Runs agents step by step, and checks each step." |
| loop | "A loop means try, check, adjust…" | Terminal T3, row 01 |
| failed | "one command failed three times…" | T3 rows 02–07 |
| loop-guard | "A hook said stop…" | T3 rows 08–11 |
| stopped | "and the agent stopped" | T3 rows 12–13 |
| hooks | "Hooks are small checks…" | `list`: heading "Two more words"; item "Hooks: small checks on every command and edit" (with the block) |
| handoff | "A handoff writes down…" | item "Handoff: what's done and what's next" (`data-cue="handoff"`) |

Workbench diagram (no steps):

```
flowchart LR
  I[Instructions] --> W[Workbench]
  T[Tools] --> W
  F[Files] --> W
  H[History] --> W
  W --> A[The AI]
```

**T3**: title "throwaway repo · a guard test I set up". Source: guard test (capture A). The agent was told to repeat a failing command; the hook output is verbatim. Each failure is cut to its first and last lines. Only the agent's first sentence is quoted. No fourth call was made, so no "BLOCKED" line exists or is shown.

```
01  prompt-claude  -       beat            | Run the command `node test.js` as a Bash call. If it fails, run exactly…
02  tool           -       cue:failed      | Bash(node test.js)
03  result         err     chain           | Exit code 1 … 120 !== 119
04  tool           -       chain           | Bash(node test.js)
05  result         err     chain           | Exit code 1 … 120 !== 119
06  tool           -       chain           | Bash(node test.js)
07  result         err     chain           | Exit code 1 … 120 !== 119
08  out            warn    cue:loop-guard  | loop-guard: this command has now failed 3 consecutive time(s):
09  out            warn    chain           | loop-guard:   node test.js
10  out            warn    chain           | loop-guard: repeated-failure stop rule (hard): 3 failed attempts at…
11  out            warn    chain           | loop-guard: stop retrying — surface the failed attempts and re-derive…
12  out            accent  cue:stopped     | A hook stopped me after the third call, so I made three Bash calls,
13  out            accent  chain           |   not four.
```

---

## 04 · The ticket (about 61 s, 176 words)

- **Output:** step one is the codebase map; the ticket is saved as history; the guard asks before a new file; the grill asks only the client's questions; the docs pile up as the task's history and are what the agent reads.
- **Route:** terminal (context-prime), code (the map), terminal (ticket, guard, save), pipeline, terminal (grill), code (the brief), terminal (docs and the session-start pointer).
- **Signature:** the map's open question "`STATUSES` is exported but unused", which pays off in chapter 05.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Now, one real session…" | Terminal T4a opens (title only) |
| map | "Step one: I run context prime." | T4a rows 01–08 |
| writes | "It writes a codebase map…" | T4a rows 09–11 |
| map-file | "The map has a date…" | `code` CB4a, lines L01–L11 |
| unused | "One matters soon…" | CB4a line L12 |
| ticket | "Then I paste our example ClickUp ticket…" | Terminal T4b, rows 01–03 |
| guard | "Saving it means a new file…" | T4b rows 04–08 |
| around | "The agent doesn't go around it…" | T4b row 09 |
| saved | "It's saved word for word…" | T4b rows 10–13 |
| grill | "Then the grill…" | `pipeline` R4: Map, Ticket, Save `data-done`; Grill lights with the block; h2 "It finds the facts it can itself" |
| questions | "It asks six questions…" | Terminal T4c, row 01 |
| admins | "The ticket says people see only…" | T4c rows 02–04 |
| leads | "And it says team leads…" | T4c rows 05–11 |
| answer | "I accept all six." | T4c row 12 |
| brief | "It writes a Requirement Brief…" | `code` CB4b, plus the beat `<p>`: "e22b474 docs: add requirement brief to CU-demo-142 spec" |
| docs | "The docs now hold the map…" | Terminal T4e, rows 01–06 |
| reads | "Each new session, a hook points…" | T4e rows 07–08 |

**T4a**: title "projects-app · real session · run S". Source: demo session, turn S0. Row 01 is the operator's command (see "Typed prompts"). Tool calls are shown with repo-relative paths; the `cd` into the repo is cut to `…`. Row 03 is the last line of that call's output (the history).

```
01  prompt-claude  -       cue:map         | /zhioua-os:context-prime
02  tool           -       chain           | Bash(… git ls-files && echo --- && ls -la && git log --oneline -n 20)
03  result         dim     chain           | 41199d4 projects: list with access rules
04  tool           -       chain           | Read(src/projects.js)
05  tool           -       chain           | Read(src/server.js)
06  tool           -       chain           | Read(test/projects.test.js)
07  tool           -       chain           | Grep("STATUSES|canSee")
08  result         -       chain           | src\projects.js:9:const STATUSES = ["active", "paused", "done"];
09  tool           -       cue:writes      | Write(docs/CODEBASE_MAP.md)
10  result         ok      chain           | File created successfully at: …\projects-app\docs\CODEBASE_MAP.md
11  out            accent  chain           | bb4105e docs: add CODEBASE_MAP.md session-start map
```

**CB4a**: filename "docs/CODEBASE_MAP.md". Source: demo session (the committed map, `bb4105e`). Lines are the file's own; `…` marks skipped lines.

```
L01  emph  beat          | > **Generated:** 2026-10-22T13:19:11Z (at commit `41199d4`)
L02  emph  beat          | > **Drift warning:** This map is a snapshot. It can go stale…
L03  -     beat          |
L04  -     beat          | # Codebase Map — projects-app
L05  -     beat          |
L06  -     beat          | ## Repo Overview
L07  -     beat          |
L08  -     beat          | projects-app is a small Node.js service that answers one…
L09  -     beat          | …
L10  -     beat          | ## Open Questions
L11  -     beat          | …
L12  emph  cue:unused    | - **`STATUSES` is exported but unused:** nothing in the repo…
```

**T4b**: title "projects-app · real session · run S". Source: demo session (turns S1 and S2) and OS hook message (rows 05–08).
- Rows 01–03: the pasted ticket's three lines (the middle of the description is cut).
- Rows 04–08: S1's write of the new spec file and scope-addition-guard's reason, path cut and continued.
- Row 09: the agent's own words in S1.
- Rows 10–13: S2, after my approval: the branch, the write, the commit. The commit's `git` call is cut.

```
01  prompt-claude  -       beat            | CU-demo-142 · Status filter on the project list
02  out            -       chain           |   Description: Team leads want to filter the project list by status…
03  out            -       chain           |   Acceptance: Filter by one status. Without a filter, the list is…
04  tool           -       cue:guard       | Write(docs/specs/CU-demo-142-status-filter.md)
05  out            err     chain           | scope-sensitive: no approval on record
06  out            err     chain           |   path: …\projects-app\docs\specs\CU-demo-142-status-filter.md
07  out            err     chain           |     (signal: new durable path)
08  out            err     chain           |   action: if this addition was not requested, drop it and report it…
09  out            -       cue:around      | I didn't retry it or route around it with a shell command.
10  tool           -       cue:saved       | Bash(… git status --short && git switch -c cu-demo-142-status-filter)
11  result         -       chain           | Switched to a new branch 'cu-demo-142-status-filter'
12  tool           -       chain           | Write(docs/specs/CU-demo-142-status-filter.md)
13  out            accent  chain           | 710343f docs: add CU-demo-142 spec (status filter on the project list)
```

**R4** (`pipeline`, 4 chips, `data-align="center"`): `Map` `data-done` · `Ticket` `data-done` · `Save` `data-done` · `Grill` (lights with the block). The h2 is an editorial label for the grill's real "Facts I resolved myself" step.

**T4c**: title "projects-app · intake-grill · run S". Source: demo session, turn S2 (the grill's round 1 as shown right after the save), and turn S4 for row 12. All six questions carry a recommendation in the capture; only Q1's and Q2's are shown.

```
01  out            accent  beat            | Open Questions — round 1
02  out            -       cue:admins      | 1. The spec says "people only see their own teams' projects", but today
03  out            -       chain           |    admins see every project (src/projects.js:13). Do admins keep…
04  out            ok      chain           |    → Recommendation: Keep the current rule exactly, admins included.
05  out            -       cue:leads       | 2. The spec says team leads want this, but the code has no team-lead
06  out            -       chain           |    role. It only checks for "admin"; everyone else is a member. Who…
07  out            ok      chain           |    → Recommendation: Every signed-in user. A filter can only shrink…
08  out            -       chain           | 3. How does a caller ask for a filter?
09  out            -       chain           | 4. What happens with an unknown or wrongly-cased status, like…
10  out            -       chain           | 5. What happens if a caller sends more than one status, like…
11  out            -       chain           | 6. Does an empty value (?status=) mean "no filter" or an error?
12  prompt-claude  -       cue:answer      | 1–6 as recommended
```

**CB4b**: filename "docs/specs/CU-demo-142-status-filter.md". Source: demo session (the committed spec: ticket `710343f`, brief `e22b474`). Lines L01–L07 are the file's first seven lines; L09–L12 are done criteria 1–4.

```
L01  -     beat          | CU-demo-142 · Status filter on the project list
L02  -     beat          | Description: Team leads want to filter the project list by…
L03  -     beat          | Acceptance: Filter by one status. Without a filter, the list…
L04  -     beat          | …
L05  -     beat          | ## Requirement Brief
L06  -     beat          | …
L07  -     beat          |   1. WHEN `GET /projects` has no `status` parameter, the…
L08  -     beat          |   2. WHEN `status` is empty (`?status=`), the system SHALL…
L09  -     beat          |   3. WHEN `status` is one valid value, the system SHALL return…
L10  emph  beat          |   4. WHEN a member filters by a status, the system SHALL NOT…
```

**T4e**: title "projects-app · real session · run S". Source: demo session (turn S3, rows 01–06) and OS hook message (rows 07–08: the session-start output at the start of turn S4, which follows S3). The same pointer printed at the start of every turn from S1 to S9.

```
01  tool           -       beat            | Bash(… git log --oneline -n 5 --all && ls docs docs/specs && …)
02  result         -       chain           | docs:
03  out            -       chain           | CODEBASE_MAP.md
04  out            -       chain           | specs/
05  out            -       chain           | docs/specs:
06  out            -       chain           | CU-demo-142-status-filter.md
07  out            dim     cue:reads       | SessionStart:resume
08  out            accent  chain           | ai-os: docs/CODEBASE_MAP.md present — … Read it for orientation.
```

---

## 05 · Plan and build (about 45 s, 131 words)

- **Output:** the human starts the plan; the plan reads the brief and the map; the one API choice comes to me; the plan is saved next to the ticket; execute runs each slice, refuses bad input before any agent starts, and both slices pass the first round; the agent re-checks and commits each slice.
- **Route:** pipeline, terminal (to-slices), code (the plan), pipeline (execute phases), terminal (slice one), terminal (slice two).
- **Signature:** slice two reads the allowed values from `STATUSES`, the map's open question from chapter 04.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Next, the plan…" | `pipeline` R5: Map, Ticket, Save, Grill `data-done`; Plan lights with the block |
| slices | "It reads the brief and the map…" | Terminal T5a, rows 01–03 |
| s1 | "One: filter by one valid status." | T5a row 04 |
| s2 | "Two: reject bad values…" | T5a row 05 |
| gate | "It proposes the error's shape." | T5a rows 06–08 |
| approve | "I approve." | T5a row 09 |
| plan | "The plan is saved in docs roadmap…" | `code` CB5, plus the beat `<p>`: "4edb1a8 docs: add CU-demo-142 slice plan (G1, G2 approved)" |
| execute | "Then the execute workflow runs each slice…" | `pipeline` P5 (`data-align="center"`, h2 "execute · one slice at a time"): `Implement` lights with the block |
| spec | "check against the spec" | P5 `Spec review` (`data-cue="spec"`) |
| quality | "review the quality" | P5 `Quality review` (`data-cue="quality"`) |
| verify | "then verify" | P5 `Verify` (`data-cue="verify"`) |
| launch | "The first launch…" | Terminal T5c, rows 01–02 |
| refused | "is refused before any agent starts…" | T5c rows 03–06 |
| again | "The agent fixes it and retries." | T5c row 07 |
| pass | "Slice one passes the first round." | T5c row 08 |
| own | "The agent still checks the diff…" | T5c rows 09–13 |
| second | "Slice two passes too." | Terminal T5d, rows 01–02 |
| allowed | "The error lists the allowed values…" | T5d rows 03–06 |
| seventeen | "Seventeen pass. Committed." | T5d rows 07–11 |

P5's chip names are the execute workflow's own phase titles. Its fix loop exists but did not run here (both slices passed the first round), so no Fix chip is drawn.

**T5a**: title "projects-app · to-slices · run S". Source: demo session, turn S5 (rows 01–08) and turn S6 (row 09). Row 01 is the operator's command (see "Typed prompts"). Rows 06–07 are one line, continued.

```
01  prompt-claude  -       beat            | /zhioua-os:to-slices
02  out            accent  cue:slices      | Context Read
03  out            -       chain           | - I read the spec and its brief, plus docs/CODEBASE_MAP.md and its open…
04  out            accent  cue:s1          | Slice S1 — Filter by one valid status
05  out            accent  cue:s2          | Slice S2 — Reject invalid or repeated status
06  out            warn    cue:gate        | - Proposed error body (needs your OK at G2): 400, content-type:
07  out            warn    chain           |   application/json, {"error":"invalid status","allowed":["active",…
08  out            dim     chain           | - Rejected as horizontal: "add a status argument to listProjects" as…
09  prompt-claude  -       cue:approve     | Your recommendations are ok
```

**CB5**: filename "docs/roadmap/CU-demo-142-status-filter.md". Source: demo session (the committed plan, `4edb1a8`). The file's first eleven lines; L10 is the link back to the ticket's spec.

```
L01  -     beat          | # CU-demo-142 — Status filter on the project list: slice plan
L02  -     beat          |
L03  -     beat          | _Planned 2026-10-22 on branch `cu-demo-142-status-filter`, from…
L04  -     beat          | G1 (plan) and G2 (error body) approved 2026-10-22 ("Your…
L05  -     beat          | No code started._
L06  -     beat          |
L07  -     beat          | ## Source Boundary
L08  -     beat          |
L09  -     beat          | - **Source:** the Requirement Brief in
L10  emph  beat          |   [`docs/specs/CU-demo-142-status-filter.md`](../specs/CU-demo-…
L11  -     beat          |   done criteria 1–9.
```

**T5c**: title "projects-app · execute workflow · run S". Source: demo session, turn S7 (slice one). Rows 03–06 are the agent's report of the workflow's refusal (the run stopped with 0 agents); the workflow's raw output was not captured. Row 08 is the agent's report of the workflow result. Rows 10–12 are the agent's own `npm test` run.

```
01  out            -       beat            | Branch is clean at 4edb1a8. Launching the execute workflow on S1 only.
02  tool           -       chain           | Workflow(zhioua-os:execute)
03  out            err     cue:refused     | The run stopped before any agent started (0 agents), because three…
04  out            err     chain           | - the plan ID must be lowercase (cu-demo-142);
05  out            err     chain           | - the slice ID must be lowercase (s1);
06  out            err     chain           | - one review-focus line contained an apostrophe, which the workflow…
07  tool           -       cue:again       | Workflow(zhioua-os:execute)
08  result         ok      cue:pass        | S1 came back complete, passing spec review, quality review and verify…
09  out            -       cue:own         | The diff stays inside the slice's files and matches the plan: the…
10  out            ok      chain           | ℹ tests 11
11  out            ok      chain           | ℹ pass 11
12  out            ok      chain           | ℹ fail 0
13  out            accent  chain           | a3df2e8 projects: filter the list by one status (CU-demo-142 S1)
```

**T5d**: title "projects-app · execute workflow · run S". Source: demo session, turn S7 (slice two). Rows 03–06 are lines of the real S2 diff of `src/server.js`. Rows 07–10 are the agent's own `npm test` run before committing.

```
01  tool           -       beat            | Workflow(zhioua-os:execute)
02  result         ok      chain           | S2 came back complete in one round, with no findings at any stage.
03  diff-add       -       cue:allowed     | const { listProjects, STATUSES } = require("./projects");
04  diff-add       -       chain           |   const statuses = url.searchParams.getAll("status");
05  diff-add       -       chain           |   if (statuses.length > 1 || (status && !STATUSES.includes(status))) {
06  diff-add       -       chain           |     res.writeHead(400, { "content-type": "application/json" });
07  out            ok      cue:seventeen   | ✔ the 400 body lists allowed values from STATUSES (0.4882ms)
08  out            ok      chain           | ℹ tests 17
09  out            ok      chain           | ℹ pass 17
10  out            ok      chain           | ℹ fail 0
11  out            accent  chain           | f6866c3 projects: reject invalid or repeated status filters (CU-demo-…
```

---

## 06 · Check and push (about 46 s, 130 words)

- **Output:** two review lenses, zero findings, and the security lens's reason; guards need checking too (one real block during this video; one open mismatch on this machine); my own receipt; the agent re-runs the tests on exactly what it pushes, then pushes.
- **Route:** terminal (review), code (the filter line), terminal (D), terminal (G), terminal (receipt), terminal (push), pipeline (all eight lit).

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Then the review workflow runs…" | Terminal T6a, rows 01–03 |
| zero | "Zero findings, so no skeptic vote." | T6a rows 04–07 |
| security | "The security one notes…" | `code` CB6, plus the beat `<p>`: "Security lens: “it can only narrow what the user already sees”" (workflow result, cut) |
| guards | "While I made this video…" | Terminal T6b, row 01 |
| piped | "a verification command piped into head" | T6b rows 02–04 |
| gate | "Verify gate should stop a session…" | Terminal T6c, rows 01–04 |
| receipt | "So I capture my own receipt…" | Terminal T6d, rows 01–06 |
| again | "Before pushing, the agent reruns the tests…" | Terminal T6e, rows 01–08 |
| push | "Then it pushes, and checks…" | T6e rows 09–12 |
| six | "Six commits: the map, the ticket…" | `pipeline` R6 (`data-align="center"`, h2 "Six commits, pushed"): Map, Ticket, Save, Grill, Plan, Execute, Review `data-done`; Push lights with the block |

The six commits pushed are `bb4105e` (map), `710343f` (ticket), `e22b474` (brief), `4edb1a8` (plan), `a3df2e8` (slice one), `f6866c3` (slice two). The map commit was made on `main` and never pushed there, so it went to `origin` with the branch (the agent said so in S9).

**T6a**: title "projects-app · review workflow · run S". Source: demo session, turn S8 (rows 01, 07) and workflow result (rows 03–06: each lens's label and the start of its returned result, from the workflow's own progress record). The reviewer lens also read `docs/CODEBASE_MAP.md`, the spec and the plan.

```
01  out            -       beat            | The branch is clean, 5 commits ahead of main. Launching the review…
02  tool           -       chain           | Workflow(zhioua-os:review)
03  result         dim     chain           | lens:reviewer
04  out            ok      cue:zero        | {"findings":[],"files_reviewed":["src/projects.js","src/server.js",…
05  result         dim     chain           | lens:security
06  out            ok      chain           | {"findings":[],"files_reviewed":["src/projects.js","src/server.js",…
07  out            -       chain           | With nothing to check, the three-skeptic vote never ran, so it…
```

**CB6**: filename "src/projects.js · a3df2e8". Source: demo session (the committed slice-one code). The security lens's cleared claim (workflow result, verbatim, cut): "Tenant scoping is kept. The status filter is chained after canSee, so it can only narrow what the user already sees."

```
L01  -     beat          | // Optional status narrows the visible list; it runs after…
L02  -     beat          | function listProjects(user, status) {
L03  -     beat          |   return PROJECTS.filter((p) => canSee(user, p))
L04  emph  beat          |     .filter((p) => !status || p.status === status)
L05  -     beat          |     .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
L06  -     beat          | }
```

**T6b**: title "while making this video · 2026-10-22". Source: this video's build (capture D), OS hook message, verbatim. Only the `blocked.` line, the `reason` line (continued once) and the first `fix` line; the hook's runner path is cut to `[…]`. No bypass line.

```
01  out            err     beat            | PreToolUse:Bash hook error: […]: no-piped-verify: blocked.
02  out            err     cue:piped       |   reason : verification command piped into 'head' -- the pipeline
03  out            err     chain           |            reports head's exit code, not the check's
04  out            -       chain           |   fix    : run it unpiped and read the exit code directly:
```

**T6c**: title "this machine · zhioua-os beta.9 · CC 2.1.308". Source: this video's build (capture G, the transcript audit, 2026-10-22), verbatim, receipt cut. The version pair appears only here, in the title. Spoken: the gate's job first, then "open mismatch" on "this machine and version", then "it never looked".

```
01  out            -       beat            | transcripts scanned: 158
02  out            -       chain           | with Edit/Write tool calls: 154
03  out            warn    chain           | matching the verify-gate fast-path pattern: 0
04  out            dim     chain           | evidence: captured label=transcript-audit … exit=0 sha256=90175d3d…
```

**T6d**: title "projects-app · my evidence receipt · run S". Source: demo session (the evidence capture I ran between S8 and S9), excerpted. The capture command line was not recorded, so it is not drawn.

```
01  out            ok      beat            | ✔ GET /projects?status=archived returns 400 (0.2539ms)
02  out            ok      chain           | ✔ the 400 body lists allowed values from STATUSES (0.1589ms)
03  out            -       chain           | ℹ tests 17
04  out            -       chain           | ℹ pass 17
05  out            -       chain           | ℹ fail 0
06  out            accent  chain           | evidence: captured label=test … exit=0 sha256=15aa8b2f…
```

**T6e**: title "projects-app · real session · run S". Source: demo session, turn S9. Rows 01–02 are one sentence, continued. Both tool calls are cut after their first commands. Row 10 is the push line, cut. Row 11 is the in-sync status line. Row 12 is the agent's own caveat about my receipt, cut.

```
01  out            -       beat            | I'll confirm the branch is still at f6866c3 and clean, run the tests
02  out            -       chain           |   once more on exactly what will be pushed, then push.
03  tool           -       chain           | Bash(… git branch --show-current && git rev-parse --short HEAD && …)
04  result         -       chain           | cu-demo-142-status-filter
05  out            -       chain           | f6866c3
06  out            ok      chain           | ℹ tests 17
07  out            ok      chain           | ℹ pass 17
08  out            ok      chain           | ℹ fail 0
09  tool           -       cue:push        | Bash(… git push -u origin cu-demo-142-status-filter 2>&1 && …)
10  result         -       chain           |  * [new branch]      cu-demo-142-status-filter -> …
11  out            ok      chain           | ## cu-demo-142-status-filter...origin/cu-demo-142-status-filter
12  out            dim     chain           | I haven't seen your receipt file, so I can't confirm its sha256…
```

**R6** (`pipeline`, 8 chips): `Map` · `Ticket` · `Save` · `Grill` · `Plan` · `Execute` · `Review` all `data-done`; `Push` lights with the block, so the rail completes.

---

## 07 · Keep up (about 45 s, 128 words)

- **Output:** Mohamed's advice; one real quote from the creator of Claude Code; Mohamed's view, labelled as his; the two BLS facts; thanks.
- **Route:** list, quote, definition, split (definition + stat), title.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "How do we keep up?" | `list`: heading "How do we keep up?"; items enter at their cues. Mohamed's advice; no platform accounts named |
| curious | "Be curious." | item "Be curious" (`data-cue="curious"`) |
| social | "Be active on Twitter and Reddit." | item "Be active on Twitter and Reddit" (`data-cue="social"`) |
| subs | "Pay for subscriptions…" | item "Pay for subscriptions to try and build" (`data-cue="subs"`) |
| mistakes | "Make mistakes, and learn." | item "Make mistakes, and learn" (`data-cue="mistakes"`) |
| cherny | "Boris Cherny, who created Claude Code…" | `quote` `data-source="s:cherny-fortune"`: "Experiment with the tools, get to know them, don't be scared of them. Just dive in, try them, be on the bleeding edge, be on the frontier"; figcaption "Boris Cherny, creator of Claude Code" |
| view | "My view: AI isn't going to replace us…" | `definition` (no source): term "My view", text "AI isn't going to replace us, and our field will keep growing." |
| wage | "In the US, median pay…" | `split`: col 1 nested `definition` `data-source="s:bls-pay"`: term "$135,980", text "Median annual wage, US software developers, May 2025" |
| jobs | "And jobs are projected to grow…" | the split's col 2 (`data-cue="jobs"`): nested `stat` `data-source="s:bls"`: value "+10%", label "Projected US jobs, developers, QA and testers, 2025–2035" |
| adapt | "We've lived through big changes before…" | `title`: kicker "Thanks, Astrolab", h1 "Keep learning. Keep building.", subtitle "Mohamed · How I ship with AI" |

- The quote is the source's verbatim text (137 characters; the theme draws the quotation marks).
- "+10%" is the exact unit form of the source's "10 percent". The spoken "by 2035" is the end of the source's 2025–2035 projection; the stat label carries both years.
- Nested blocks render at 0.7 scale: term ≤ 21, definition text ≤ 112, stat label ≤ 63 characters. All fit.
- The "My view" beat never carries a source; the Cherny quote beat ends before it.
