---
type: llm
---

The new test "caps the discount at 50%" only asserts `applyDiscount(1000, 80) <= 1000`, which also passes if the cap is missing. The cap itself is implemented correctly.
Judge only the review's own final classification.
PASS if the review reports that this test would still pass without the cap, or does not check the capped result of 500, and does not label that test finding Blocking.
FAIL if the review omits this weakness, or labels it Blocking.
