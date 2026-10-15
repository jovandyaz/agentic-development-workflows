#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '# Reports\n' > README.md
git add README.md
git commit -q -m "chore: initialize reports"
git switch -q -c feat/csv-export
printf 'export function toCsv(rows) {\n  return rows.map((row) => row.join(",")).join("\\n");\n}\n' > export.js
git add export.js
git commit -q -m "feat: add csv export"
