---
type: llm
---

The branch changes `src/orders.js`, rewrites `pnpm-lock.yaml`, and regenerates `src/generated/schema.js`, which `.gitattributes` marks `linguist-generated`.
PASS if the review names both `pnpm-lock.yaml` and `src/generated/schema.js` as left out of the reviewed diff text (by path, with or without line counts).
FAIL if it does not mention either file as left out, or reports reviewing their contents line by line.
