---
# The repository has no property-based testing library, so the run must add
# no dependency to get one.
type: regex
target:
  source: file
  path: package.json
pattern: 'dependencies'
match: not_contains
---
