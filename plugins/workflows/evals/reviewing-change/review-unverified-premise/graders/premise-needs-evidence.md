---
type: llm
---

PASS if the review reports that nothing enforces `email` uniqueness, because `db/schema.sql` has no unique index or constraint on `users.email` (`users_email_idx` is not unique), and labels it Blocking or reports it as an open question the fix depends on.
FAIL if the review accepts the commit message's premise that email is unique, or does not mention that nothing enforces it.
