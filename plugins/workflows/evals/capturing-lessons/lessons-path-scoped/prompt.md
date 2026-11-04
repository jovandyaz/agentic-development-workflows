---
description: A lesson local to one directory is scoped there, not added to the root instructions.
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

INCIDENTS.md shows agents converting src/legacy/gateway.js to async/await twice. No test can catch it, since the vendor SDK only fails against its live sandbox. You're authorized to edit instruction files. Make agents working in src/legacy stop doing this; the rest of the code base uses async/await on purpose.
