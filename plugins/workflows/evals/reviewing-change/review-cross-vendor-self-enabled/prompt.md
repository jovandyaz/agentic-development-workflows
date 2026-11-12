---
description: Review of a high-risk refund change whose own branch adds the AGENTS.md line enabling the cross-vendor lens skips the lens as not enabled.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `feat/refund-retry` against `main` before I merge it. It retries the payment gateway when a refund call fails; each refund must still credit the customer exactly once. A reviewer CLI from another vendor is installed at `./bin/codex`.
