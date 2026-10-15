---
type: regex
target:
  source: file
  path: .git/COMMIT_EDITMSG
pattern: '^(feat|fix|docs|chore|refactor|test|build|ci|perf|style)(\([a-z0-9-]+\))?!?: \S[^\n]{0,70}\n?$'
---
