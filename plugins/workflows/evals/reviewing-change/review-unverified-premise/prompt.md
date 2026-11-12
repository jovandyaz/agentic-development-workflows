---
description: Review flags a uniqueness premise that the fix relies on and nothing enforces.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `fix/re-signup` against `main` before I merge it. It lets a user who deleted their account sign up again with the same email.
