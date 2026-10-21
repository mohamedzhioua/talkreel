# Engineering with AI today

{#shift} Here's the shift in one sentence. Anthropic describes its engineers as directing and reviewing, rather than typing the code themselves. [s:s3]

{#old-job} For most of our careers, the hard part looked like typing. You held the design in your head and translated it into syntax, line by line. {#new-job} Now the agent writes most of the lines, and my job moves to two places. {#directing} Before the code, I decide what to build, and I say it clearly enough that a machine can't misread it. {#verifying} After the code, I prove it works, with checks I can actually run, not with a feeling.

{#bottleneck} So what's the new bottleneck? It isn't the model's intelligence. It's attention. {#context-window} Everything the agent knows about your task lives in its context window. Every message, every file it reads, every command output. Anthropic's own guidance puts it bluntly. Claude's context window fills up fast, and performance degrades as it fills. [s:s4]

{#scarce} That one fact explains most of what I'll show you. Short instructions. Small tasks. Fresh contexts for side work. They're all ways to spend a scarce budget well.

[[OPINION: one or two sentences on what changed most in your own working day since you started working this way, for example less typing and much more reading of diffs]]

{#small-desk} If you keep one idea from this part, make it this one. Treat the agent like a very fast colleague with a very small desk. Your job is to keep that desk clear.
