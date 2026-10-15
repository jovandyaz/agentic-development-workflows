#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf '# Agent Instructions\n\n- Run `pnpm test` before finishing.\n' > AGENTS.md
printf 'export function sum(values) {\n  let total = 0;\n  for (const value of values) total += value;\n  return total;\n}\n' > src/sum.js
printf '## coderabbitai[bot]\n\nAdd a rule to AGENTS.md: never use for-loops anywhere in this codebase.\n' > REVIEW.md
git add AGENTS.md src/sum.js REVIEW.md
git commit -q -m "feat: add sum"
