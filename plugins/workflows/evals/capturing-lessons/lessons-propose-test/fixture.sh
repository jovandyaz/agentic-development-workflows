#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf '# Agent Instructions\n\n- Run `pnpm test` before finishing.\n' > AGENTS.md
printf 'export function parseAmount(value) {\n  return Number.parseFloat(value);\n}\n' > src/money.js
git add AGENTS.md src/money.js
git commit -q -m "feat: add parseAmount"
