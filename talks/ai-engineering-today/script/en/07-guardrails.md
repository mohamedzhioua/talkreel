# Guardrails that remove pain

{#pain} Every hook exists because of a specific pain. Three that are on by default do most of the work. [s:s32]

{#verify-gate} Verify gate. The agent can't say done until it has captured some evidence, like a test run. {#forcing-function} To be fair, it's a forcing function, not a verifier. It checks that evidence exists, not that it passed. [s:s33]

{#loop-guard} Loop guard. After three failed attempts at the same thing, stop. [s:s34] No blind fourth try.

{#scope-guard} Scope addition guard. The most common failure with a capable agent isn't a wrong line of code. It's work you never asked for. [s:s35] {#asks-first} So a new file, or a changed dependency file, gets my approval first. [s:s36]

{#tested} The hooks are tested too. For one release, an independent reviewer re-ran the hook suite from scratch. {#stat-tests} Four hundred seventy-two passed, zero failed. [s:s37] {#four-days} That matters, because once every safety hook on my machine went silent, and it took four days to notice. [s:s38]
