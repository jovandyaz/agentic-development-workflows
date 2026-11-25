#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '{\n  "name": "orders",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf '# Orders\n\n- Prices are integer cents.\n' > AGENTS.md
printf 'export function total(lines) {\n  return lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);\n}\n' > orders.js
printf '# Orders\n\n## Usage\n\nCall `total(lines)` with a list of lines.\n' > README.md
git add -A
git commit -q -m "feat: add order totals"
git switch -q -c docs/readme-usage
printf '# Orders\n\n## Usage\n\nCall `total(lines)` with a list of `{ cents, quantity }` lines. It returns\nthe order total in integer cents.\n' > README.md
git commit -q -am "docs: describe the order line shape"
