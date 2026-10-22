# Storyboard: ai-engineering-today (working notes, scenes stage)

Per scenes.md §12: a four-part brief and a beat grid per chapter, written before the HTML.
Durations are estimates at 150 wpm (2.5 words/s) between cues; the real ones come from the voice.

Talk-wide rules:

- Camera, sparingly: `push-in` on 01 `eighty` (the 80% stat), 08 `eight-times` (8x) and 09 `callback`
  (the echo); `pan-left` on three key definitions (02 context engineering, 03 agent, 04 hook). `none` elsewhere.
- Echo: 01's big-stat beat is centred with a push-in; 09's final beat is centred with the same push-in and an
  accent `<em>` punch line.
- How I work (05-07): a flow "spine" diagram builds node by node; gates are rhombi, hooks get a
  "Guardrail N:" heading.

## 01 cold open

- **Output:** AI now writes most of the code at Anthropic; this talk explains what that means and how I work.
- **Technical route:** quote, stat (push-in, centred) + p line, title hook, title.
- **Creative seed:** a quote, then one huge number that the narrator questions straight away.
- **Signature:** `>80%` growing slowly on screen, then "That number needs context."

| cue | message | focal action | reaction |
|---|---|---|---|
| tweet | Karpathy: English is the new language | quote fades up (first beat) | a familiar line |
| eighty | >80% of Anthropic's merged code by Claude | stat, slow push-in | "that's huge" |
| needs-context | the number needs context | one line under the stat | healthy doubt |
| this-video | this video came from a tool AI agents built | hook title, accent on "Under my rules." | curiosity |
| promise | ten minutes: words, how I work, what changes | title with the three-part subtitle | knows the map |

## 02 from prompts to context

- **Output:** context engineering grew out of prompt engineering: it is about everything the model sees, on a budget.
- **Technical route:** chapter-card, definition x3 (one pan-left), quote x3, split.
- **Creative seed:** terms in big type, each with one line, ending on a two-column "say vs sees".
- **Signature:** the split "What you say. / Everything the model sees."

| cue | message | focal action | reaction |
|---|---|---|---|
| vocabulary | the vocabulary, in experts' terms | chapter card pops | new section |
| prompt-engineering | prompt engineering, defined | definition | baseline term |
| natural-progression | context engineering is its progression | definition, pan-left | the key term |
| tobi | Tobi Lutke's framing | quote | an industry voice |
| karpathy | Karpathy's framing | quote | it is a craft |
| budget | the window is a budget that degrades | heading + docs quote | the constraint |
| smallest-set | the goal: smallest high-signal set | definition "Good context" | the goal |
| remember-context | say vs sees | split, two columns | the line to keep |

## 03 agents, skills and loops

- **Output:** agent vs workflow, what a skill is, and that loops need verification, a cap and a stop reason.
- **Technical route:** chapter-card, definitions (agent pan-left), quotes, diagram (loop), list, split.
- **Creative seed:** the agent loop as a ring, with "verify" called out.
- **Signature:** the four-node loop with "Verify is a beat, not an extra".

| cue | message | focal action | reaction |
|---|---|---|---|
| agent | next word: agent | chapter card | new section |
| workflow | workflow: code paths you wrote | definition | the "before" side |
| agent-def | agent: model directs itself | definition, pan-left | the contrast |
| tools-in-a-loop | Anthropic's short form | quote | simple |
| simon | Willison agrees | quote | consensus |
| skill | skill: a folder with SKILL.md | definition | concrete |
| manual | loads only what's needed | quote | why it scales |
| agent-loop | gather, act, verify, repeat | loop diagram | the shape |
| verify-beat | verify is part of the loop | figcaption | emphasis |
| slash-loop | /loop re-runs on an interval | definition | tool |
| slash-goal | /goal: a fresh model decides done | definition | independent judge |
| cap | my rule: cap, receipt, stop reason | list (three items) | discipline |
| remember-loop | no cap = bill, no stop reason = mystery | split | memorable |

## 04 workflows and the toolbox

- **Output:** start simple on the ladder of patterns; multi-agent costs tokens; subagent, hook and MCP in one line each.
- **Technical route:** chapter-card, diagram (ladder, stepped), quote, definition, diagram (fan-out), stat, definitions (hook pan-left), quote.
- **Creative seed:** a ladder that fills in rung by rung between its two ends.
- **Signature:** `15x` more tokens.

| cue | message | focal action | reaction |
|---|---|---|---|
| workflow-again | back to workflows | chapter card | new section |
| ladder | from workflows to agents | ladder ends appear | the span |
| patterns-simple | chaining, routing, parallel | three rungs pop | the simple end |
| patterns-complex | orchestrator, evaluator | last rungs pop | the complex end |
| simplest | start with the simplest | quote | restraint |
| multi-agent | multi-agent workflow | definition | the new shape |
| lead-agent | a lead fans out to subagents | fan-out diagram | parallel |
| tokens | ~15x more tokens | stat pops | cost |
| toolbox | three more words | heading | a quick list |
| subagent | subagent defined | definition under the heading | isolation |
| hook | hook defined | definition, pan-left | determinism |
| request-not-guarantee | instruction = request, hook = enforcement | docs quote | the key point |
| mcp | MCP defined | definition | connections |

## 05 how I work: idea to design

- **Output:** rules in prompts slip, so I built an OS that enforces them; talkreel shows idea to design.
- **Technical route:** chapter-card + p, definition, quote + p, diagram (spine, stepped), split, diagram (spine + spike).
- **Creative seed:** the spine diagram grows one node per stage.
- **Signature:** the before/after split: "Nobody owned the timeline" → "Each visual waits for a word".

| cue | message | focal action | reaction |
|---|---|---|---|
| guidance-alone | prompt rules get reasoned away | card + problem line | the problem |
| the-os | the OS: one plugin | definition | what it is |
| central-bet | a rule it can reason around isn't a rule | quote | the thesis |
| why-i-built-it | same process, rules that hold | line under the quote | motive |
| this-video | case study: this video | heading, empty spine | anticipation |
| idea | talkreel, the idea | Idea node + caption | the project |
| research | research | Research node | step |
| intake-grill | intake grill questions first | Intake grill node | step |
| design-doc | design doc | Design doc node | step |
| before-after | a second AI found the gap | split | proof the process works |
| spike | the risk, spiked first | Spike node pops | de-risked |

## 06 how I work: plan to review

- **Output:** small slices, one spec gate, three gates in all, decision classes, and a skeptical review.
- **Technical route:** chapter-card, quotes, diagram (gate), lists, diagram (slice path), stat, diagram.
- **Creative seed:** the gate drawn as a rhombus the work must pass.
- **Signature:** `2 of 3` skeptic votes.

| cue | message | focal action | reaction |
|---|---|---|---|
| slices | plan in small slices | chapter card | new section |
| one-shot | agents try to do too much at once | quote | outside evidence |
| incremental | incremental progress | quote | the fix |
| gate-one | I approve the spec first | gate diagram | guardrail |
| three-gates | only three gates ask me | list (three) | low interruption |
| classes | every other call gets a class | list heading | taxonomy |
| mechanical | mechanical: just do it | item | |
| taste | taste: decide, say why | item | |
| user-challenge | user challenge: stop, recommend | item | |
| execute | each slice's path | slice-path diagram | pipeline |
| parallel | built by parallel subagents | figcaption | real use |
| skeptics | a finding survives on 2 of 3 | stat | rigour |
| cross-review | one side builds, the other reviews | diagram | independence |

## 07 how I work: verify and ship

- **Output:** verification is enforced by hooks, scope is guarded, and shipping is one push plus a verified landing.
- **Technical route:** chapter-card, quote, guardrail diagrams/stat/quote with "Guardrail N:" headings, definition, diagram (stepped), h2, diagram (whole path).
- **Creative seed:** each hook is a guardrail with a number.
- **Signature:** the payoff: the whole path in one diagram.

| cue | message | focal action | reaction |
|---|---|---|---|
| verify | verify by running checks | chapter card | new section |
| boris | Boris: give Claude a way to verify | quote | authority |
| verify-gate | no stop without evidence | guardrail 1 diagram | enforcement |
| forcing-function | checks evidence exists, not that it passed | figcaption | honesty |
| loop-guard | the fourth attempt is refused | stat `3` | bounded |
| scope-guard | the common failure: unasked work | guardrail 3 + quote | recognition |
| asks-first | new file or dependency asks me | scope diagram | control |
| routing | escalate on stakes, not cost | definition | principle |
| push-once | push once per plan | spine: Push once node | discipline |
| land-verify | wait for real CI, keep a receipt | Land verify + Receipt nodes | done means done |
| frame-catch | frame review caught overlap | single heading | proof |
| payoff | the whole path | eight-node diagram | "this video is the proof" |

## 08 how engineering is changing

- **Output:** output is up, but the measure is weak; the job moves toward steering and review; five ways to adapt.
- **Technical route:** h2 + stat (push-in), quotes, stat, h2 + quote, quotes, list (five, cued), h2 + quote, h2.
- **Creative seed:** a big number, then the numbers' own caveats.
- **Signature:** `8x`, immediately qualified by Anthropic itself.

| cue | message | focal action | reaction |
|---|---|---|---|
| eight-times | 8x code per engineer per day | stat, push-in | impressive |
| context-promised | lines of code is imperfect | quote | caveat |
| overstatement | almost certainly overstated | quote | honesty |
| delegate | most fully delegate only 0-20% | stat | grounded |
| job-moves | the job is moving | heading | reframing |
| steering | code review and steering | quote under the heading | new role |
| amplify | amplifies expertise | quote | skills matter |
| rewards | rewards top-tier practice | quote | practices matter |
| adapt | how we adapt | list heading | actionable |
| adapt-spec / adapt-verify / adapt-review / adapt-encode | items 1-4 | one item each | checklist |
| adapt-skills | five: keep skills sharp | heading + quote | a warning |
| for-us | try one real task together | single heading | the ask |

## 09 close

- **Output:** three takeaways and one thing to try this week.
- **Technical route:** list (cued items), h2 + code, title hook (push-in, centred).
- **Creative seed:** the takeaways as a numbered list, the exercise as a three-line file.
- **Signature / echo:** the final beat is centred with a push-in like 01's big stat, with an accent punch line.

| cue | message | focal action | reaction |
|---|---|---|---|
| takeaways | three things | list heading | wrap-up |
| take-words | the words | item 1 | |
| take-job | the job | item 2 | |
| take-enforce | the rules | item 3 | |
| try-this | write goal, limits, check | three-line task file types in | doable |
| callback | the engineering is still ours | hook title, push-in | the ending |
