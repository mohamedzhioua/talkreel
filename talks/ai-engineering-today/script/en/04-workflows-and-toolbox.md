# Workflows and the toolbox

{#workflow-again}Back to workflows, the predefined code paths. [s:s5] Anthropic's article climbs {#ladder}a ladder of patterns, from simple workflows up to autonomous agents. [s:s7] {#patterns-simple}Prompt chaining, routing and parallelization. {#patterns-complex}Then orchestrator and workers, and evaluator and optimizer. {#simplest}With one piece of advice. Find the simplest solution possible, and only increase complexity when needed. [s:s15]

{#multi-agent}And there's a newer shape, the multi-agent workflow. In Claude Code, a script Claude writes orchestrates many subagents, and you can rerun it. [s:s54] {#lead-agent}Anthropic's research system works this way, with a lead agent delegating to subagents in parallel. [s:s55] It isn't free. {#tokens}Multi-agent systems use about fifteen times more tokens than chats. [s:s56]

{#toolbox}Three more words, one line each. {#subagent}A subagent runs in its own context window, with its own prompt, tools and permissions. [s:s11] {#hook}A hook is a command that runs at a fixed point, so an action always happens instead of relying on the model. [s:s57] {#request-not-guarantee}An instruction in Claude dot M D is a request, not a guarantee. A hook that blocks the edit is enforcement. [s:s12] {#mcp}And M C P, the Model Context Protocol, connects Claude to external services and tools. [s:s14]
