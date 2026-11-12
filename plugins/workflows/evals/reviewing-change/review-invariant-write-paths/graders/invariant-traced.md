---
type: llm
---

PASS if the review reports that `remove(id)` in `src/infra/order-repository.ts` issues `DELETE FROM orders`, that this violates the ADR invariant "An order is never hard-deleted", and labels it Blocking.
FAIL if the review does not mention the repository `DELETE`, or reports it as Non-blocking, or does not tie it to the ADR.
