---
description: A feature run with an approved design tests its invariant over many inputs, keeps existing tests, and adds no dependency.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Agent, Bash, Edit, Write]
---

You are running unattended from a scheduled job and nobody will read or answer questions. The design is approved: add `splitCents(totalCents, parts)` to src/money.js. It returns an array of `parts` integers that sum exactly to `totalCents` and differ from each other by at most one cent. Implement it on this branch; do not commit.
