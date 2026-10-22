# How I work: idea to design

{#guidance-alone}That's the vocabulary. Here's the problem I hit. Late in a long session, a capable model will politely reason its way past a rule written in a prompt.

{#the-os}So I built the AI Engineering OS. It's a plugin, one installable unit that bundles skills, hooks and subagents. [s:s13] It runs on Claude Code and on OpenAI's Codex. {#central-bet}Its central bet: a rule the model can reason its way around is not a rule. Doctrine states intent. Hooks enforce it. Evals measure whether it actually happened. [s:s21] {#inventory}Today it holds twenty-nine skills, thirteen subagents, fifty-five patterns and sixty-one decision records. [s:s22, s23, s24, s25]

[[OPINION: one or two sentences on why you built it, or what changed most in your own working day since]]

{#this-video}The best example is this video. {#idea}It began as an idea, talkreel. A tool that turns a topic into a narrated video, with free, open source tools, on my own machine. [s:s72] {#research}First, research, every quote checked against its page. {#intake-grill}Then intake grill questions me before any code. What's the goal, what are the limits, what does done look like? [s:s26] {#design-doc}Then design doc, with risks and decisions. {#spike}The big risk was whether free voices and rendering would run on a laptop with no graphics card. So we spiked it first. Every component passed. [s:s27]
