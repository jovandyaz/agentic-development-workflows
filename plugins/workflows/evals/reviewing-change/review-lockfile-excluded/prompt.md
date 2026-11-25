---
description: Review of a change that also rewrites a lockfile and a generated file keeps both out of the reviewers' diff text and lists them by path.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `feat/order-total` against `main` before I merge it.
