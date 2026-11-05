---
type: regex
target:
  source: file
  path: src/legacy/CLAUDE.md
pattern: '(never|do not|don''t|must not|avoid|keep)[^\n]{0,120}(async|await|callback)'
flags: i
---
