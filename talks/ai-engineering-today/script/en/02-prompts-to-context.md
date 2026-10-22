# From prompts to context

{#vocabulary}First, the vocabulary. Each word, in an expert's own terms.

{#prompt-engineering}Prompt engineering came first. Anthropic defines it as methods for writing and organizing instructions for optimal outcomes. [s:s44] {#natural-progression}Then the word grew. Anthropic now calls context engineering the natural progression of prompt engineering. [s:s45] {#tobi}Shopify's Tobi Lutke described it as the art of providing all the context for the task to be plausibly solvable. [s:s46] {#karpathy}And Karpathy called it the delicate art and science of filling the context window. [s:s47]

{#budget}Why the shift? Because the context window is a budget. The Claude Code docs put it bluntly. Claude's context window fills up fast, and performance degrades as it fills. [s:s4] {#smallest-set}So Anthropic's Applied AI team defines the goal as the smallest possible set of high signal tokens that make your desired outcome most likely. [s:s20]

{#remember-context}Here's the version to remember. Prompt engineering is what you say. Context engineering is everything the model sees.
