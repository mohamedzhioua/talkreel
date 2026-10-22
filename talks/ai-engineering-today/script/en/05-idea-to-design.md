# How I work: idea to design

That's the vocabulary. Here's the problem I hit. {#guidance-alone}Late in a long session, a capable model will politely reason its way past a rule written in a prompt.

{#the-os}So I built the AI Engineering OS. It's a plugin, one installable unit that bundles skills, hooks and subagents. [s:s13] It runs on Claude Code and on OpenAI's Codex. {#central-bet}Its central bet: a rule the model can reason its way around is not a rule. Doctrine states intent. Hooks enforce it. Evals measure whether it actually happened. [s:s21]

{#why-i-built-it}I wanted the same process every session, and rules that hold.

{#this-video}The best example is this video. {#idea}It began as an idea, talkreel. A tool that turns a topic into a narrated video, with free, open source tools, on my own machine. [s:s72] {#research}First, research, every quote checked against its page. {#intake-grill}Then intake grill questions me before any code. What's the goal, what are the limits, what does done look like? [s:s26] {#design-doc}Then design doc, with risks and decisions. {#before-after}A second AI, given only that doc, found that nobody owned the timeline. Change one sentence, and every slide after it would drift. {#fixed}We fixed it on paper: now each visual waits for a spoken word. {#spike}The big risk was whether free voices and rendering would run on a laptop with no graphics card. {#spiked}So we spiked it first. {#spike-result}Every component passed. [s:s27]
