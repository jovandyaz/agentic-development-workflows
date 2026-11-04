#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf 'export function total(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n' > cart.js
git add package.json cart.js
git commit -q -m "feat: add cart total"
git switch -q -c fix/cart-quantity
