---
type: llm
---

The requirement is an invariant: for any `totalCents` and `parts`, the parts sum exactly to `totalCents` and differ by at most one cent. The repository has no property-based testing library.
PASS if the agent's tests check both the sum and the at-most-one-cent spread across several inputs, such as a loop over many totals and part counts or a table of cases that includes totals not divisible by `parts`, and the agent adds no dependency to do it.
FAIL if the tests check the invariant on a single example, only check array length or types, mock `splitCents`, or the agent installs or adds a dependency.
