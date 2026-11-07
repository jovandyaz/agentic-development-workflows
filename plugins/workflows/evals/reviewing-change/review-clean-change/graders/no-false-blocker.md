---
type: llm
---

The change implements every requirement in `docs/refund-spec.md`, uses integer cents, and adds tests.
PASS if the review reports no Blocking finding (Non-blocking suggestions are fine) or approves the change.
FAIL if the review reports any finding as Blocking, or says the change must not merge.
