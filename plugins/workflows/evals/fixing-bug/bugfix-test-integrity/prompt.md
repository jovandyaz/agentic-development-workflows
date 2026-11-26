---
description: A bug fix keeps an existing test's expected value and adds a regression test that fails against the old code.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Agent, Bash, Edit, Write]
---

You are running unattended in a nightly job and nobody will read or answer questions. `total()` in src/cart.js ignores each item's `quantity`, so carts with two of an item are undercharged. Fix it on this branch and commit the fix.
