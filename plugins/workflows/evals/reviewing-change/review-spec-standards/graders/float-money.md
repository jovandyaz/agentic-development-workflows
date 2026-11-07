---
type: llm
---

PASS if the review reports, as a finding, that `refund` uses floating-point arithmetic on money (`requested * 0.97`), which breaks the AGENTS.md rule that money is an integer number of cents, or that it does not round down to a whole cent.
FAIL if the review omits this.
