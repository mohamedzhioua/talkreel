# Agents, skills and loops

{#agent}Next, agent. Anthropic draws a clean line. {#workflow}In a workflow, the model and its tools follow code paths you wrote in advance. [s:s5] {#agent-def}In an agent, the model directs its own process and its own tool use. [s:s6] {#tools-in-a-loop}Anthropic now puts it more simply. Models autonomously using tools in a loop. [s:s48] {#simon}Simon Willison agrees. An L L M agent runs tools in a loop to achieve a goal. [s:s49]

{#skill}A skill is how you teach an agent a job. It's a folder with a skill dot M D file, plus instructions, scripts and resources. [s:s9] {#manual}Anthropic's Barry Zhang and his co-authors compare it to a well organized manual. Claude loads information only as needed. [s:s10]

{#agent-loop}The agent loop has four beats. Gather context, take action, verify work, repeat. [s:s8] {#verify-beat}Verify is a beat, not an extra.

{#slash-loop}Some loops you start on purpose. Slash loop re-runs a prompt on an interval. [s:s50] {#slash-goal}Slash goal keeps Claude working toward a condition, and a fresh model, not the one doing the work, decides when it's met. [s:s51, s52] {#cap}My rule: every run-until-done loop carries a wall clock cap, a receipt per tick, and an explicit stop reason. [s:s53] {#remember-loop}A loop without a cap is a bill. A loop without a stop reason is a mystery.
