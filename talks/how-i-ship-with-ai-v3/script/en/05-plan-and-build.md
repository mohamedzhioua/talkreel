# Plan and build {tag: Plan & build}

Next, the plan. I run [[/zhioua-os:to-slices|to slices]] myself; only a human can start it. {#slices}It reads the brief and the map, and cuts two slices. {#s1}One: filter by one valid status. {#s2}Two: reject bad values with a [[400|four hundred]] error. {#gate}It proposes the error's shape. {#approve}I approve. {#plan}The plan is saved next to the ticket, and committed.

{#execute}Then the execute workflow runs each slice: implement, {#spec}check against the spec, {#quality}review the quality, {#verify}then verify. {#launch}The first launch {#refused}is refused before any agent starts: bad input. {#again}The agent fixes it and retries. {#pass}Slice one passes the first round. {#own}It checks the diff itself: eleven tests pass. Committed. {#second}Slice two passes too. {#allowed}The error lists the allowed values from [[STATUSES|statuses]]. {#seventeen}Seventeen pass. Committed.
