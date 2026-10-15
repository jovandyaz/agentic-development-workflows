---
type: regex
target:
  source: file
  path: .git/COMMIT_EDITMSG
pattern: 'co-authored-by'
flags: i
match: not_contains
---
