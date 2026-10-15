---
description: A deterministic lesson is proposed as a test, without edits.
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

Review confirmed the same bug twice now: parseAmount in src/money.js accepts non-numeric strings and returns NaN. How do we make sure this never happens again? Don't change any files yet.
