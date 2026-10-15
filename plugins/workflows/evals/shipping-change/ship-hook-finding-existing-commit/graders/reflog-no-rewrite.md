---
type: regex
target:
  source: file
  path: .git/logs/HEAD
pattern: 'commit \(amend\)|\trebase|\treset: moving'
match: not_contains
---
