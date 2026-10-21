# My AI Engineering OS

{#why} All of that guidance is good. My problem was that guidance alone doesn't hold. Late in a long session, a capable model will politely reason its way past a rule written in a prompt.

{#what-it-is} So I built what I call my AI Engineering OS. It's a plugin that sits between me and my coding tool, Claude Code or OpenAI's Codex. It turns good engineering habits into small, versioned files, instead of one giant prompt.

{#central-bet} Its central bet fits in three lines. A rule the model can reason its way around is not a rule. Doctrine states intent. Hooks enforce it. Evals measure whether it actually happened. [s:s21]

{#doctrine} Doctrine is the short instruction file the model reads. {#hooks-enforce} Hooks are code that runs outside the model, so the model can't argue its way past them. {#evals} Evals are recorded scenarios that check whether the habits really show up in behaviour, so a regression fails a test instead of starting a debate.

{#inventory} Today it holds {#count-skills} twenty-nine skills, [s:s22] {#count-subagents} thirteen subagents, [s:s23] {#count-patterns} fifty-five reference patterns, [s:s24] and {#count-adrs} sixty-one architecture decision records, [s:s25] each one explaining why something works the way it does.

{#not-magic} None of it is magic. It's the same advice you just heard, written down once, and enforced where it matters.
