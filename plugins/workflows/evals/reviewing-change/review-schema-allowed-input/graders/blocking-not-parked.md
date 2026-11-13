---
type: llm
---

PASS if the review reports as a Blocking finding that a socket message without `turnId`, which `src/socket/schema.js` accepts, runs a turn without the conversation lease, so two turns of one conversation can run concurrently; reporting it as Blocking while noting that the bundled client always sends `turnId` still passes.
FAIL if the review does not report it, or reports it only as Non-blocking, Parked, deferred, or an open question, or dismisses it because the chat client always sends `turnId`.
