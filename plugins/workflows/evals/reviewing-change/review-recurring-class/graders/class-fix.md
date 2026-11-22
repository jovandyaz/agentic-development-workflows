---
# Round 1 fixed dashes and round 2 fixed dots; spaces and parentheses still bypass the same check.
type: llm
---

`src/redact.js` redacts only ten adjacent digits, `ddd-ddd-dddd`, and `ddd.ddd.dddd`. Round 1 reported the dashes bypass and this branch then patched dots.
PASS if the review reports that phone numbers with other separators (such as spaces or parentheses, for example `555 123 4567` or `(555) 123-4567`) still reach the logs, identifies this as the same cause or class as the round-1 finding, and proposes one rule that covers any separator between the digit groups instead of adding another separator to the pattern.
FAIL if it misses the remaining bypass, treats it as unrelated to the round-1 finding, or proposes only adding the next separator to the pattern.
