---
type: llm
---

The branch changes `src/orders.js`, adds a dependency to `package.json`, rewrites `pnpm-lock.yaml` to match, and regenerates `src/generated/schema.js`, which `.gitattributes` marks `linguist-generated`.
PASS if the review names both `pnpm-lock.yaml` and `src/generated/schema.js` as left out of the reviewed diff text (by path, with or without line counts).
FAIL if it omits either file as left out, or reports reviewing their contents line by line.
