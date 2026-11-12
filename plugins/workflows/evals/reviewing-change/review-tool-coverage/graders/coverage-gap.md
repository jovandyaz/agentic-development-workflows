---
type: llm
---

PASS if the review reports that `src/shared/format.ts` imports `../domain/money`, that this breaks the documented rule "`src/shared` must not import `src/domain`", and notes that `lint:arch` (`.dependency-cruiser.cjs`) has no rule covering `src/shared`.
FAIL if the review skips the rule because tooling enforces it, or does not mention the `src/shared` import of `src/domain`.
