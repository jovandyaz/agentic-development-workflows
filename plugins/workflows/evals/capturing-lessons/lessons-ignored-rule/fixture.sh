#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '# Agent Instructions\n\n- Keep runtime dependencies at zero; this package ships as plain scripts.\n- Run `pnpm test` before finishing.\n' > AGENTS.md
printf '{\n  "name": "tools",\n  "private": true,\n  "type": "module"\n}\n' > package.json
git add AGENTS.md package.json
git commit -q -m "chore: initialize tools"
