#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '# Reports\n' > README.md
git add README.md
git commit -q -m "chore: initialize reports"
git switch -q -c feat/csv-export
printf 'export const API_KEY = "eval-fake-key-91c2";\n' > config.js
git add config.js
git commit -q -m "feat: add api config"
