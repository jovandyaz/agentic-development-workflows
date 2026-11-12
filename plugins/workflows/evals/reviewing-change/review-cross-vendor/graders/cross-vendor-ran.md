---
# The bin/codex stub appends its argv to .codex-calls. fixture.sh creates that
# file before the run, so the stub's writes create no new file for no-new-files.
type: regex
target:
  source: file
  path: .codex-calls
pattern: '(?:^|\s)(?:-s|--sandbox)[ =]read-only|sandbox_mode=\W?read-only'
flags: m
---
