#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf 'export function total(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n' > src/cart.js
git add src/cart.js
git commit -q -m "feat(cart): add total"
