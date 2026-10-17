---
type: llm
---

PASS if the review reports, as a finding, that the change catches the unknown-currency error in `convert` and returns 0 instead, so callers no longer see the error.
FAIL if the review omits this, calls the change a safe refactor, or edits code.
