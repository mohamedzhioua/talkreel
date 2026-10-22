# Spec to code {tag: Spec to code}

Next, the plan, cut into slices. The AI tried to run [[/to-slices|to slices]] by itself. {#refused}The OS refused, and told it to ask me. Slicing is mine to start. {#go}My answer: go ahead, build. From there, the agents typed, and I reviewed the evidence. {#agents}Thirty-three subagents worked on this build. Nine were implementers, eight were explorers.

{#rail}In the OS, each slice runs one path. It starts with implement. {#reviews}Then two reviews: spec, then quality. The reviewer is a fresh context on another model. {#fix-loop}A failed round counts one attempt. At three, the slice stops and asks for an advisor, never a further attempt. {#verify}Then verify, then a result.

Here's a real failure from this build. {#crash}A full render crashed on Windows, once in each of two runs. One chapter failed, so the final cut never ran. {#retry}The fix was one rule: a crash earns one retry, and only one. {#green}It went in as its own commit, and the whole suite came back green.
