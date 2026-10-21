# A day with the OS

{#vague-request} Let me show you a real day, and the example is the video you're watching. {#talkreel} I wanted a tool that turns a topic into a narrated explainer video, with free tools, on my own laptop. That tool is talkreel.

{#flow} A vague request like that routes through four skills. Intake grill, design doc, to slices, and execute slices. [s:s26] {#intake-grill} Intake grill questions me before any code. What's the goal, what are the limits, what does done look like? {#design-doc} Design doc turns my answers into a design, with risks and decisions. The big risk was whether free voices and rendering would even run on Windows. {#spike} So we ran a spike first. Every component passed, on a laptop with no graphics card. [s:s27]

{#to-slices} To slices cuts the design into small tasks with acceptance checks. {#gate-one} Then the first gate. I approve the spec before any code is written. {#execute-slices} Execute slices builds one slice at a time. {#review} One side implements, and a fresh context on the other side, Claude or Codex, reviews the real diff. Every finding must be backed by evidence. [s:s28]

{#gates} I only get asked at three gates. The spec before code. User challenge decisions. And human owned boundaries, like merge, tag and publish. [s:s29] {#decisions} Every other call gets a class. {#mechanical} Mechanical, the code or spec decides, so just do it. {#taste} Taste, cheap to reverse, so decide and say so. {#user-challenge} User challenge, irreversible or a preference it can't infer, so stop and bring me a recommendation. [s:s30]

{#push-once} Finally, it pushes once per finished plan, never per commit, because this repo has used up its monthly build quota twice. [s:s31] {#land-verify} And a merge isn't the finish line. Land verify waits for the real result, and keeps a receipt.

[[OPINION: a short, real moment where a gate or a cross review caught something you would otherwise have shipped]]
