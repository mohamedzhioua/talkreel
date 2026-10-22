# Storyboard: how-i-ship-with-ai (working notes, scenes stage)

One thread runs through the talk: the build of talkreel itself, from the request to the ambiguity, the corrected spec, a failure that got fixed, the guardrails and the verified ship.
Durations are estimates at 175 spoken words per minute (af_heart, speed 1.08). The real durations come from the voice.

## Talk-wide rules

- **Everything on screen is real.** Every terminal line, list item and caption below comes from the verified inventory. Its category is named per block:
  - **build session**: the session that built talkreel
  - **OS hook message**: the text an OS hook prints
  - **OS instructions**: the OS's own operating text
  - **OS inventory**: the installed plugin, 0.19.0-beta.9
  
  Lines may be cut short with `…`, but nothing is invented. No file path from the OS repo appears anywhere.
- **Hooks that did not fire are never shown as events.**
  - scope-addition-guard and loop-guard never fired in this build. Their messages sit in a terminal titled "what each hook prints when it blocks".
  - verify-gate really ran at every stop and passed. Its block message is shown the same way, as what it prints.
  - Only read-only-agent-guard is shown as a real block, with its date. So is the to-slices refusal (chapter 04).
- **One deliberate elision.** The verify-gate message names an OS script path. The path is cut to `…` (chapter 05, line 06).
- **Ambient on**, with a chapter tag from each heading's `{tag: …}`. No chapter cards, because the tag carries the chapter. Chapter 02 opens on a definition instead.
- **Motif: the rail.**
  - The rail is a `pipeline` block in chapters 03 and 04.
  - In the M2 contract every chip ends lit: data-done, cued, or lit with the block. So an *unlit* rail cannot be a pipeline. Chapter 02's "empty rail" is therefore a Mermaid diagram of the same path with nothing lit.
  - Chapters 03 and 04 then fill real rails.

### Terminal line format

Each terminal block below lists its title, its source category and its lines in order:

```
NN  role           tone    enters    | exact text (everything after "| ")
```

- **role**:
  - `prompt-claude`: `❯` is drawn by CSS, not part of the text
  - `prompt-shell`: `$` is drawn by CSS
  - `out`, `tool`, `result` (`⎿` is drawn by CSS)
  - `diff-add`, `diff-del` (`+` and `−` are drawn by CSS)
- **tone**: `ok`, `err` (full-row tint), `warn`, `dim`, `accent`, or `-` for none.
- **enters**:
  - `beat`: with the beat
  - `chain`: uncued; it chains after the previous line
  - `cue:<name>`: at that cue, as `data-cue`
- **Continuation rows** of a wrapped line are `out` rows with leading spaces. They keep the tone of the line they continue.

All lines are at most 72 characters. This was checked by script on the text after `| `.

---

## 01 · One request (cold open, about 19 s, 56 words)

- **Output:** a real request typed in the first seconds, then three real results, and the claim that this video came out of that process.
- **Technical route:** terminal (typed prompt, then three outputs), then the title.
- **Creative seed:** the maintainer's own typo-ridden request, unedited.
- **Signature:** the title bar reads "replayed from the real session".

| cue | spoken from | on screen |
|---|---|---|
| (start) | "My team asked me…" | Terminal T1 opens at t = 0; the prompt types within the first 1.5 s |
| design | "First came a design…" | T1 line 04, the design commit |
| outputs | "Then one hundred twenty-two tests…" | T1 lines 05–06: tests, then the rendered chapter |
| made-by | "This video was made by that tool…" | `title`: h1 "How I ship with AI", subtitle "Made by talkreel, inside the zhioua OS" |

**T1**: title "replayed from the real session". Source: build session. The prompt is the first line of the real request. Its wrap is shown as two indented continuation rows.

```
01  prompt-claude  -       beat         | i want to create a open source that first of all it's a solution for me
02  out            -       chain        |   as my team want me to make a prisatation on how i work with ai so it
03  out            -       chain        |   will first let me create a video of 10 min …
04  out            accent  cue:design   | 5d6f2d2 docs: M1 design and research landscape
05  out            ok      cue:outputs  | Tests  122 passed (122)
06  out            ok      chain        | en/08: wrote build\en\08\chapter.mp4 (85.47 s)
```

---

## 02 · Why an OS (about 19 s, 55 words)

- **Output:** a lone agent runs a different process each session. The zhioua OS makes the process a fixed path, enforced by hooks.
- **Technical route:** definition, then the terminal with a real `ls`, then the diagram (the empty rail).
- **Signature:** the real skill listing.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "One agent is capable…" | `definition`: term "Without an OS", text "One capable agent, and a different process every session." |
| ls | "So I built the zhioua OS…" | Terminal T2, plus the beat `<p>`: "29 skills · 13 subagents · 2 workflows · hooks" (OS inventory) |
| rail | "One path, every session…" | `diagram`, the empty rail (below); figcaption "One path, every session" |

**T2**: title "zhioua-os 0.19.0-beta.9". Source: OS inventory. This is the real output of `ls -C -w 72 skills/` in the installed beta.9 plugin, which matches the repo: 29 entries.

```
01  prompt-shell   -       beat         | ls skills/
02  out            -       chain        | api-evolution           docs-write            resolving-merge-conflicts
03  out            -       chain        | architecture-deepening  domain-modeling       retro-learn
04  out            -       chain        | caveman                 execute-slices        security-review
05  out            -       chain        | codebase-design         handoff               system-design
06  out            -       chain        | code-review             implement-surgically  tdd
07  out            -       chain        | compaction              incident-response     test-review
08  out            -       chain        | context-prime           intake-grill          to-slices
09  out            -       chain        | debug-loop              observability-design  write-a-skill
10  out            -       chain        | dependency-audit        os-bootstrap          zoom-out
11  out            -       chain        | design-doc              prototype
```

**Empty rail**: `diagram`, no steps, so everything appears with the figure and nothing is lit. Source: OS instructions. The lifecycle is "intake-grill → design-doc → to-slices → execute-slices"; gate 1 is "the spec before any code"; verify and ship are the stages that follow.

```
flowchart LR
  I[intake-grill] --> D[design-doc] --> G{gate 1} --> S[to-slices] --> E[execute-slices] --> V[verify] --> P[ship]
```

---

## 03 · Idea to spec (about 57 s, 167 words)

- **Output:**
  - intake-grill asks, and every question carries a recommendation
  - the design is committed before code
  - decisions get classes
  - a second AI found the timeline gap, and the design was fixed on paper
  - the work waits at gate 1
- **Technical route:**
  1. terminal
  2. definition
  3. code
  4. list
  5. split
  6. terminal (diff)
  7. pipeline: the gate chip waits, then lights
- **Signature:** the rail stops at an unlit gate 1 and lights only on "I confirm the spec".

| cue | spoken from | on screen |
|---|---|---|
| (start) | "It starts with intake grill…" | Terminal T3, line 01 |
| recommend | "It came with a recommendation…" | T3 lines 02–04 |
| reply | "So my answer was one line…" | T3 lines 05–06, the maintainer's reply typed |
| rule | "That's the rule…" | `definition`: term "intake-grill", text "A question without a recommendation hands the work back." (OS instructions) |
| design | "Then design doc…" | `code`: filename `docs/design/m1-pipeline.md` (talkreel's public repo), one line `Status: draft for gate 1.` with `data-emph`; beat `<p>`: "Committed before any code: 5d6f2d2 docs: M1 design and research landscape" (build session) |
| classes | "Every open decision gets a class…" | `list`: heading "Every decision gets a class"; items (OS instructions, staggered with the block): "Mechanical: just do it" · "Taste: decide, state the call and why, proceed" · "User-Challenge: pause, present a recommended call" |
| second-ai | "Then the builder check…" | `split`: col 1 h3 "A fresh reviewer AI", p "Read only the design doc. Returned 25 questions." (build session) |
| timeline | "The biggest: nobody owned the timeline…" | the split's col 2 (`data-cue="timeline"`): h3 "The biggest", p "Timeline ownership (the biggest risk)" |
| fix | "So we fixed it on paper…" | Terminal T3b |
| gate-one | "Then gate one…" | `pipeline` R3: intake-grill and design-doc are lit when the beat opens; gate 1 is unlit and waiting |
| advisors | "Two advisor models rule the open calls…" | R3's gate 1 chip lights (`data-cue="advisors"`); the rail completes |

**T3**: title "intake-grill · round 1". Source: build session. These are the real item 1 and the real reply, typos kept, wrapped across one continuation row.

```
01  out            accent  beat           | 1. When is your team presentation?
02  out            -       cue:recommend  |    → Recommendation: two milestones.
03  out            -       chain          |      M1 produces your 10-minute talk in English and French by that date.
04  out            -       chain          |      M2 makes talkreel polished enough for a public launch afterwards.
05  prompt-claude  -       cue:reply      | all recommendations ok, go ahead and for the video u gonna generate
06  out            -       chain          |   to me use engilish
```

**T3b**: title "design-doc · the fix". Source: build session (the quoted fix text). No removed line is known, so there is no `diff-del`.

```
01  diff-add       ok      beat           | Scenes never hard-code seconds.
02  diff-add       ok      chain          | They declare beats anchored to cue words.
```

**R3** (`pipeline`, 3 chips, source build session):

| chip | state |
|---|---|
| `intake-grill` | `data-done` |
| `design-doc` | `data-done` |
| `gate 1` | `data-cue="advisors"` |

---

## 04 · Spec to code (about 56 s, 163 words)

- **Output:**
  - slicing is the human's call: the OS refused to let the AI start it
  - subagents did the typing
  - each slice runs a capped path
  - one real failure, its fix, then green
- **Technical route:**
  1. terminal (a real refusal)
  2. definition
  3. pipeline, filled at four cues
  4. terminal (crash, then fix, then green)
- **Signature:** the to-slices refusal, then the err rows of the crash, then the green line.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Next, the plan, cut into slices…" | Terminal T4, line 01 (the AI's Skill call) |
| refused | "The OS refused…" | T4 lines 02–04 (err) |
| go | "My answer: go ahead, build…" | T4 line 05, the maintainer's prompt typed |
| agents | "Thirty-three subagents…" | `definition`: term "33 subagents", text "8 explore, 1 researcher, 9 implementer, 1 reviewer, 3 docs, 11 general." (build session) |
| rail | "In the OS, each slice runs one path…" | `pipeline` R4 enters; `Implement` lights |
| reviews | "Then two reviews…" | R4 `Spec review` and `Quality review` light (two chips share this cue) |
| fix-loop | "A failed round counts one attempt…" | R4 `Fix` lights |
| verify | "Then verify, then a result…" | R4 `Verify` and `Result` light; the rail is full |
| crash | "A full render crashed…" | Terminal T4b, lines 01–02 (err) |
| retry | "The fix was one rule…" | T4b line 03, the commit subject |
| green | "It went in as its own commit…" | T4b line 04 (ok) |

**T4**: title "build session". Source: build session. Line 01 renders the AI's call to the Skill tool. Lines 02–04 are the refusal, verbatim and wrapped. Line 05 is the maintainer's real reply.

```
01  tool           -       beat         | Skill(zhioua-os:to-slices)
02  result         err     cue:refused  | Skill zhioua-os:to-slices cannot be used with Skill tool due to
03  out            err     chain        |   disable-model-invocation. Ask the user to run /zhioua-os:to-slices
04  out            err     chain        |   themselves
05  prompt-claude  -       cue:go       | go ahead build
```

**R4** (`pipeline`, 6 chips, source OS instructions; the execute workflow's phase titles):

| chip | lights at |
|---|---|
| `Implement` | `data-cue="rail"` |
| `Spec review` | `data-cue="reviews"` |
| `Quality review` | `data-cue="reviews"` |
| `Fix` | `data-cue="fix-loop"` |
| `Verify` | `data-cue="verify"` |
| `Result` | `data-cue="verify"` |

All six are cued, so none of them lights early with the block.

**T4b**: title "render · build session". Source: build session.
- Line 03 is the real fix commit's subject, not a diff: the inventory holds no diff lines for this fix.
- It happened once in each of two full renders. The narration says so.

```
01  out            err     cue:crash    | en/01: hyperframes check failed (exit 3221226505):
02  out            err     chain        | render failed for 1 chapter(s); concat not run
03  out            accent  cue:retry    | fix(render): retry hyperframes once after a process crash
04  out            ok      cue:green    | Tests  122 passed (122)
```

---

## 05 · Guardrails (about 51 s, 148 words; the peak)

- **Output:**
  - hooks enforce what prompts cannot
  - what each guard prints when it blocks
  - an honest scoreboard for this build
  - the one real block, from today
- **Technical route:**
  1. list
  2. one terminal that accumulates three guards' messages across four cues
  3. list (scoreboard)
  4. terminal (a real block)
- **Creative seed:** the three guards' messages land one under another in a single window. The reveal: two of them never fired, while one guard really did fire today.
- **Signature:** the err-tinted `scope-sensitive: no approval on record`, then the dated real block.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Rules in a prompt get reasoned away…" | `list`: heading "Default-on hooks"; items: verify-gate · loop-guard · scope-addition-guard · session-autoload (OS instructions) |
| scope | "Say the AI adds a file nobody asked for…" | Terminal T5, lines 01–02 (err) |
| scope-action | "No approval on record…" | T5 lines 03–04 (err) |
| verify-gate | "Say it tries to finish without evidence…" | T5 lines 05–06 |
| loop-guard | "Say one command fails three times…" | T5 lines 07–11 |
| scoreboard | "To be honest about this build…" | `list`: heading "In this build"; items: "verify-gate: 51 stops, passed every time" · "scope-addition-guard: never fired" · "loop-guard: never fired" (build session) |
| real-block | "One guard did fire, today…" | Terminal T5b, lines 01–03 |
| blocked | "Blocked, with the reason and the fix…" | T5b lines 04–07 |

**T5**: title "what each hook prints when it blocks". Source: OS hook message.
- These are the hooks' printed text. In this build only verify-gate ran, and it never blocked; the other two never fired.
- `<path>` and `<signal>` are the hook's own placeholders, kept as is.
- Line 06 cuts the OS script path to `…`.

```
01  out            err     cue:scope         | scope-sensitive: no approval on record
02  out            err     chain             |   path: <path> (signal: <signal>)
03  out            err     cue:scope-action  |   action: if this addition was not requested, drop it and report it
04  out            err     chain             |           under *Suggested, not done*.
05  out            err     cue:verify-gate   | verify-gate: no captured evidence for this session.
06  out            warn    chain             | verify-gate: run your checks via … before finishing.
07  out            warn    cue:loop-guard    | loop-guard: this command has now failed 3 consecutive time(s):
08  out            warn    chain             | loop-guard: repeated-failure stop rule (hard):
09  out            warn    chain             |   3 failed attempts at the same target means STOP — question the
10  out            warn    chain             |   hypothesis/architecture/plan; never attempt fix N+1.
11  out            err     chain             | loop-guard: BLOCKED — this command already failed 3 consecutive time(s):
```

**T5b**: title "2026-10-22 · while researching this video". Source: OS hook message, a real block that fired on 2026-10-22 against a read-only research subagent. The text is verbatim, wrapped under its field labels.

```
01  out            err     cue:real-block    | read-only-agent-guard: blocked.
02  out            -       chain             |   agent  : zhioua-os:researcher (read-only subagent — must not
03  out            -       chain             |            mutate the working tree)
04  out            warn    cue:blocked       |   reason : write-shaped Bash — redirect to a file (> or >>)
05  out            -       chain             |   fix    : read-only agents report findings and hand writes back
06  out            -       chain             |            to the main session or an implementer; do not improvise
07  out            -       chain             |            a write.
```

---

## 06 · Verify and ship (about 56 s, 163 words)

- **Output:**
  - the full check is green
  - a frame review found a real bug, and it was fixed
  - the tests were proven to bite
  - a reviewer's admitted blind spot was re-covered
  - one PR, CI green on the PR and on main
  - what land-verify waits for
- **Technical route:**
  1. terminal
  2. split
  3. definition
  4. terminal plus a beat `<p>`
  5. terminal across three cues
  6. terminal
- **Signature:** the ship terminal: `gh pr create`, then the PR URL, `test pass 18s` and the green merge run.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "Then the evidence…" | Terminal T6, all four lines |
| frames | "An AI also reviewed the rendered frames…" | `split`: col 1 h3 "Frame review", p "I tested a crossfade between beats; the two beats' text overlapped." (build session) |
| frame-fix | "So the contract changed…" | col 2 (`data-cue="frame-fix"`): h3 "The fix", p "The contract now delays the incoming beat until the old one has faded." (build session) |
| bite | "Then I proved the tests bite…" | `definition`: term "Mutation proof", text "I removed the 0.3 s floor and 4 tests failed; I put it back." (build session) |
| gap | "One reviewer even admitted…" | Terminal T6b, plus the beat `<p>`: "Images for chapters 1–5 · re-reviewed by fresh agents" (build session) |
| pr | "Then I ship it as one PR…" | Terminal T6c, lines 01–02 |
| ci | "On the PR, CI ran the tests…" | T6c line 03 |
| main | "I merged it: that gate is mine…" | T6c line 04 |
| land | "In the OS, a merge isn't the finish line…" | Terminal T6d |

**T6**: title "talkreel · typecheck and tests". Source: build session. This is the real output, with its original relative indentation.

```
01  out            dim     beat         | > talkreel@0.1.0 typecheck
02  out            dim     chain        | > tsc -p tsconfig.json --noEmit
03  out            ok      chain        |  Test Files  9 passed (9)
04  out            ok      chain        |       Tests  122 passed (122)
```

**T6b**: title "frame reviewer · build session". Source: build session. This is the reviewer's own words, cut where the inventory cuts them.

```
01  result         warn    beat         | came back blocked … so those 5 chapters were never actually looked at
```

**T6c**: title "ship · build session". Source: build session.
- Line 01 is the real command with the title cut short.
- Line 03 is the PR's check row. Its tabs are rendered as four spaces.
- Line 04 is the post-merge run on main, with its title cut short.

```
01  prompt-shell   -       cue:pr       | gh pr create --base main --head m1 --title "M1: talkreel pipeline …"
02  out            accent  chain        | https://github.com/mohamedzhioua/talkreel/pull/1
03  out            ok      cue:ci       | test    pass    18s
04  out            ok      cue:main     | completed success "Merge pull request #1 …" ci main 23s
```

**T6d**: title "what land-verify prints". Source: OS hook message.
- `<sha12>` and `N` are the tool's own placeholders.
- The inventory holds no land-verify receipt from this build, so this terminal shows what it prints. The narration describes what land-verify does and does not claim that it ran here.

```
01  out            dim     beat         | land-verify: waiting for CI on <sha12> (timeout 600s)...
02  out            ok      chain        | land-verify: GREEN — all N run(s) for <sha12> concluded success.
```

---

## 07 · Close (about 24 s, 71 words)

- **Output:** my job is intent, evidence and merge, while the AI types. This is the second cut, made by the same process. The call to action: try one real task.
- **Technical route:** list, then split, then the title hook (push-in), then the title.
- **Signature / echo:** the final title names talkreel and the zhioua OS, as the cold open did.

| cue | spoken from | on screen |
|---|---|---|
| (start) | "That's how I work now…" | `list`: heading "How I work now"; items: "I write the intent" · "I review the evidence" · "I merge" · "The AI does the typing" |
| second-cut | "This talk is the second cut…" | `split`: col 1 h3 "First cut", p "9 min 38 s. Too long, and it barely showed the OS."; col 2 h3 "This cut", p "5 minutes. Same tool, same process." (build session) |
| try | "So try one real task this week…" | `title` with `data-variant="hook"` and `data-camera="push-in"`: h1 "Try one real task. <em>Judge it by its evidence.</em>" |
| open | "talkreel, the tool that made this video…" | `title`: kicker "Made inside the zhioua OS", h1 "talkreel", subtitle "Open source (MIT) · github.com/mohamedzhioua/talkreel" (build session) |
