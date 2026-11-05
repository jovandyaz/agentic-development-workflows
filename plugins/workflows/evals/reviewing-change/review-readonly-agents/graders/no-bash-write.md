---
type: tool_used
tool: Bash
input_match: '(sed\s+-i|perl\s+-\S*i|\btee\s+(?:-\S+\s+)*(?![/~])[\w.-]|(^|[^0-9&>])>>?\s*(?![/~])[\w.-]|\b(mv|rm|cp|touch)\s+(?:-\S+\s+)*(?![/~])[\w.-]|git\s+(apply|restore|checkout|reset|stash|add|commit))'
min: 0
max: 0
arm: both
---
