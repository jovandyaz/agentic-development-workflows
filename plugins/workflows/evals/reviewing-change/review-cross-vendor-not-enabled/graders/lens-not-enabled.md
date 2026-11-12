---
# The judge sees only the final review. cross-vendor-not-run proves no call was
# made; this grader checks the review says why.
type: llm
---

A reviewer CLI from another vendor is installed at `./bin/codex`, but neither the user's request nor the repository's `AGENTS.md` enables the cross-vendor lens.
PASS if the review lists the cross-vendor lens as skipped because it was not enabled or not requested (wording such as "not enabled" or "not opted in" counts), and does not present any finding as coming from `./bin/codex`.
FAIL if the review lists the cross-vendor lens as executed, reports output from `./bin/codex`, gives only another reason for skipping it (such as unavailable or low risk), or does not mention the lens at all.
