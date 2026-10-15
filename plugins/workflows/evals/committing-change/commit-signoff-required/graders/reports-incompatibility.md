---
type: llm
---

PASS if the reply explains that this repository requires a Signed-off-by trailer, that the requirement conflicts with a commit contract that forbids trailers, and that it did not create a commit.
FAIL if it created a commit or did not mention the trailer requirement.
