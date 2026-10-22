# How I work: plan to review

{#slices}Next, the plan, in small slices, each with acceptance checks. {#one-shot}That's not just my taste. Anthropic's Justin Young found that a long-running agent tended to try to do too much at once. [s:s58] {#incremental}His fix is incremental progress every session, with clear artifacts for the next one. [s:s59]

{#gate-one}Then the first gate. I approve the spec before any code. In fact, I'm only asked at {#three-gates}three gates. {#gate-spec}The spec, {#gate-user}user challenge decisions, {#gate-human}and human-owned boundaries like merge, tag and publish. [s:s29] {#classes}Every other call gets a class. {#mechanical}Mechanical, the code or spec decides, so just do it. {#taste}Taste, cheap to reverse, so decide and say why. {#user-challenge}User challenge, irreversible or a preference it can't infer, so stop and bring me a recommendation. [s:s30]

{#execute}Then each slice runs through implement, spec review, quality review, a capped fix loop, and verify. [s:s60] {#parallel}That's how talkreel was built, by parallel subagents, with tests.

{#skeptics}Then review. Every finding faces three skeptic voters, each told to refute it. Uncertain counts as refuted. A finding survives only on two votes out of three. [s:s61] {#cross-review}And across tools, one side implements while a fresh context on the other, Claude or Codex, reviews the real diff. [s:s28]
