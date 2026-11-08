---
description: Review blocks on a defect and leaves a naming issue non-blocking.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `feat/cart-total` against `main` before I merge it. It adds `cartTotal`, which returns the total in cents of every item in the cart.
