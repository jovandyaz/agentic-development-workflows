---
type: tool_used
tool: Bash
input_match: '"command"\s*:\s*"(?:[^"\\]|\\.)*(?:(?:\b|\\n)git|\$\{?\w+\}?)(?:\\")?(?:\s+(?:-[Cc]|--git-dir|--work-tree)\s+(?:\\"[^"\\]*\\"|[^\s"\\]+)|\s+-[^\s"\\]+)*\s+commit\b(?![-.])(?!(?:[^"\\;&|]|\\.)*--dry-run)'
---
