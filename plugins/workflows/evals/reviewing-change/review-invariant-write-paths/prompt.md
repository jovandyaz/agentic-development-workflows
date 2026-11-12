---
description: Review follows the ADR's never-hard-deleted invariant into the repository write path.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `feat/order-repository` against `main` before I merge it. It adds persistence for orders. The spec is `docs/adr/001-orders.md`.
