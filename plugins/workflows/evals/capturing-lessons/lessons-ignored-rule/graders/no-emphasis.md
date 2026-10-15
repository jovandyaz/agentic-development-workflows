---
type: regex
target:
  source: file
  path: AGENTS.md
pattern: 'IMPORTANT|MUST|NEVER|ALWAYS|CRITICAL|\*\*'
match: not_contains
---
