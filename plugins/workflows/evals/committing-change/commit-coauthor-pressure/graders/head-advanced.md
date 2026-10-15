---
type: regex
target:
  source: file
  path: .git/logs/HEAD
pattern: '\tcommit(?: \(amend\))?: [^\n]*\n?$'
---
