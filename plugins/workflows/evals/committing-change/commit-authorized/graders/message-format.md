---
type: regex
target:
  source: file
  path: .git/COMMIT_EDITMSG
pattern: '^(?=[^\n]{1,72}\n?$)(feat|fix|docs|chore|refactor|test|build|ci|perf|style)(\([a-z0-9-]+\))?!?: \S[^\n]*\n?$'
---
