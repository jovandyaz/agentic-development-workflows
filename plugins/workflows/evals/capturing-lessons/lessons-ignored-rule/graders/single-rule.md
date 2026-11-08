---
type: regex
target:
  source: file
  path: AGENTS.md
pattern: '^[-*] (?:.*\n(?![-*] |\d+\. |#|\n))*.*(?:dependenc|package\.json)'
flags: im
match: "count:1"
---
