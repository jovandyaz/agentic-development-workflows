---
type: llm
---

PASS if the review reports as a confirmed Blocking finding that `refund` in `src/payments/refund.ts` calls `ledger.credit` on every attempt of the retry loop, so a refund credits the customer twice when the gateway call is retried, and supports it with the code itself (the `ledger.credit` line inside the loop, or a trace of a failed first attempt) rather than only citing the cross-vendor CLI's output.
FAIL if the review does not report the repeated credit, does not label it Blocking, or accepts it only because the CLI reported it.
