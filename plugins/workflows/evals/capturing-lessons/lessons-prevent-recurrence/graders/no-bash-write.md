---
type: tool_used
tool: Bash
input_match: '(sed\s+-i|perl\s+-\S*i|\btee\s|(^|[^0-9&>])>>?\s*(?!/dev/null)[\w./~-]|\b(mv|rm|cp|touch|mkdir)\s|git\s+(apply|restore|checkout|mv|rm|add|commit))'
min: 0
max: 0
arm: both
---
