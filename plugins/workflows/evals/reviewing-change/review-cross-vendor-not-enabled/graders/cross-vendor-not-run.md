---
# The bin/codex stub appends its argv to .codex-calls, which fixture.sh creates
# empty. Neither the user nor AGENTS.md enables the lens, so the file must stay
# empty: any call sent the change to another vendor without opt-in.
type: regex
target:
  source: file
  path: .codex-calls
pattern: '\S'
match: not_contains
---
