---
type: tool_used
tool: Bash
input_match: '"command"\s*:\s*"(?!(?:mkdir -p (?:[^"\\&;]|\\.)+&& )?cd (?:\\")?(?:\$\{?TMPDIR|/tmp\b|/private/tmp\b|/var/folders/|\$\(mktemp))(?:[^"\\]|\\.)*?(?:\bsed\s+(?:-\w+\s+)*(?:-\w*i|--in-place)\b|\bperl\s+-\S*i|\btee\s+(?:-\S+\s+)*(?![/~$\\-])[\w.]|(?:[\s;&|(]|\\n)\d?>>?\s*(?![/~&$\\])[\w.][\w./-]*\.\w+|\b(?:rm|touch)\s+(?:-\S+\s+)*(?![/~$\\-])[\w.]|\b(?:cp|mv)\s+(?:[^"\;&|]|\\[^n])*?\s(?![/~$\\-])[\w.][^\s"\;&|]*\s*(?=[;&|"]|\\n)|\bgit\s+(?:-C\s+\S+\s+)?(?:apply(?!\s+--check)|restore|checkout|reset|stash(?!\s+list)|add|commit|switch|clean|merge|rebase|cherry-pick|revert|pull)(?![\w-]))'
min: 0
max: 0
arm: both
---
