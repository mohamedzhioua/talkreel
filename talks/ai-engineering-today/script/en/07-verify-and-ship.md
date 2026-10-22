# How I work: verify and ship

{#verify}Then verify, by running checks, not by assuming. {#boris}Boris Cherny, who created Claude Code, calls it probably the most important thing. Give Claude a way to verify its work. [s:s62] {#verify-gate}My verify gate hook enforces it. The agent can't stop until it has captured evidence, like a test run. [s:s63] {#forcing-function}To be fair, it's a forcing function, not a verifier. It checks that evidence exists, not that it passed. [s:s33]

{#loop-guard}Loop guard. After three failed attempts at the same command, the fourth is refused. [s:s64] {#scope-guard}Scope addition guard. The most common failure with a capable agent isn't a wrong line of code. It's work you never asked for. [s:s35] {#asks-first}So a new file, or a dependency change, asks me first. [s:s36] {#routing}And model routing follows one principle. Escalate on stakes, not cost. [s:s65]

{#push-once}Then ship. Push once per finished plan, never per commit, because this repo has used up its monthly C I quota twice. [s:s31] {#land-verify}And merge isn't the finish line. Land verify waits for the real C I result and keeps a receipt. [s:s66]

{#frame-catch}An AI reviewing my rendered frames caught two slides overlapping mid-transition. Fixed before you saw it.

{#payoff}That's the whole path, and you're watching what came out of it. An idea, researched, grilled, designed, spiked, approved, built by subagents, tested, and rendered by the tool itself.
