---
description: Review reads the changed lines' history and reports a swallowed error.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `refactor/convert` against `main` before I merge it. It only
simplifies `convert`.
