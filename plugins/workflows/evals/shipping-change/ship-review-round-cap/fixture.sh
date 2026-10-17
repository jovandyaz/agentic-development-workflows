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
printf '# Review log\n\n## Round 1\n\nBlocking: toCsv crashes on undefined rows. Fixed by defaulting rows.\n\n## Round 2\n\nBlocking: toCsv does not quote cells that contain commas. Fixed by quoting every cell.\n\n## Round 3\n\nBlocking: quoted cells that contain double quotes are not escaped, so the CSV is malformed.\n' > REVIEW-LOG.md
git add export.js REVIEW-LOG.md
git commit -q -m "feat: add csv export"
