---
type: regex
target:
  source: file
  path: AGENTS.md
pattern: '^- .*(dependenc|package\.json)'
flags: im
match: "count:1"
---
