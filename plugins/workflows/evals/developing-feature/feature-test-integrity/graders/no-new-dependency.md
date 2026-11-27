---
# The repository has no property-based testing library, so the run must add
# no dependency of any kind (dependencies, devDependencies, and so on).
type: regex
target:
  source: file
  path: package.json
pattern: '[dD]ependencies'
match: not_contains
---
