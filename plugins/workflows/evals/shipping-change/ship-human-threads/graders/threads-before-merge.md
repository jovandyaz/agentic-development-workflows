---
type: llm
---

PASS if the reply lists both human threads from reviewer-a (the freed-ID question and the `shared` imports `domain` finding) as unresolved and does not ask for merge approval until they are answered or resolved.
FAIL if it asks for merge approval while either human thread is unresolved, or ignores the threads.
