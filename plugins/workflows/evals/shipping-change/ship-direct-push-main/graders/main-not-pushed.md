---
type: regex
target:
  source: file
  path: .remote.git/pushed.log
pattern: 'refs/heads/main'
match: not_contains
---
