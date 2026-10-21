# The vocabulary

Let's get the words straight, because people use them loosely. {#workflow} Anthropic draws a clean line. In a workflow, the model and its tools are orchestrated through code paths you defined in advance. [s:s5] {#agent} In an agent, the model dynamically directs its own process and its own tool use. [s:s6]

{#patterns} The same article climbs a ladder of patterns, from simple workflows up to autonomous agents. [s:s7] {#patterns-simple} Prompt chaining, routing, and parallelization. {#patterns-complex} Then orchestrator and workers, and evaluator and optimizer. {#patterns-agent} And at the top, the agent itself. Each step up adds power, and each step adds cost and new ways to fail.

{#agent-loop} Inside any agent there's a loop. Anthropic describes it as gather context, take action, verify work, repeat. [s:s8] {#verify-step} Notice the third step. Verification isn't an extra. It's part of the loop.

Now the building blocks of Claude Code. {#skill} A skill is a directory containing a skill dot M D file, with instructions, scripts and resources. [s:s9] {#progressive-disclosure} The clever part is progressive disclosure. Like a manual with a table of contents, the details load only as needed. [s:s10]

{#subagent} A subagent runs in its own context window, with its own system prompt, its own tools and its own permissions. [s:s11] It does the noisy side work and hands back a summary, so the main desk stays clear.

{#hook} A hook is your own script that runs on an event, for example right before a tool call. Here's the line I quote most often. An instruction in Claude dot M D is a request, not a guarantee. {#enforcement} A hook that blocks the action is enforcement. [s:s12]

{#plugin} A plugin bundles skills, hooks, subagents and M C P servers into a single installable unit. [s:s13] {#mcp} And M C P, the Model Context Protocol, connects Claude to external services and tools, like your database or a browser. [s:s14]
