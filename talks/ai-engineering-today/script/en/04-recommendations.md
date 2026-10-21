# What the guidance says

So what does the official guidance actually recommend? I'll give you five points.

{#start-simple} One, start simple. Anthropic recommends finding the simplest solution possible, and only increasing complexity when it's needed. [s:s15] Sometimes that means no agent at all.

{#four-phases} Two, separate thinking from typing. The recommended workflow has four phases. {#explore} Explore, {#plan} plan, {#implement} implement, {#commit} commit. [s:s16] Skip the first two, and you get clean code for the wrong problem.

{#verify} Three, and this is the big one. Give Claude a check it can run. Tests, a build, a screenshot to compare. [s:s17] {#dont-ship} The guide's short version is this. If you can't verify it, don't ship it. [s:s18]

{#claude-md} Four, keep Claude dot M D short and human readable. [s:s19] A giant instruction file gets skimmed, by models and by people.

{#context-engineering} Five, the umbrella over all of it, context engineering. Anthropic frames it as finding the smallest possible set of high signal tokens that make the outcome you want most likely. [s:s20]

[[OPINION: which of these five you would keep if you could keep only one, and why, in one or two sentences]]
