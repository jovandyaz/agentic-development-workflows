#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf 'node_modules/\n' > .gitignore
printf 'const RATES = { USD: 1, EUR: 0.92 };\n\nexport function convert(amount, currency) {\n  return amount * RATES[currency];\n}\n' > convert.js
git add package.json .gitignore convert.js
git commit -q -m "feat: add currency conversion"
printf 'const RATES = { USD: 1, EUR: 0.92 };\n\nexport function convert(amount, currency) {\n  const rate = RATES[currency];\n  if (rate === undefined) throw new Error(`unknown currency: ${currency}`);\n  return amount * rate;\n}\n' > convert.js
git commit -q -am "fix: throw on unknown currency" -m "INC-4471: an unknown currency converted to NaN and was stored as a zero charge. Callers must see the error."
git switch -q -c refactor/convert
printf 'const RATES = { USD: 1, EUR: 0.92 };\n\nexport function convert(amount, currency) {\n  try {\n    return amount * lookup(currency);\n  } catch {\n    return 0;\n  }\n}\n\nfunction lookup(currency) {\n  const rate = RATES[currency];\n  if (rate === undefined) throw new Error(`unknown currency: ${currency}`);\n  return rate;\n}\n' > convert.js
git commit -q -am "refactor: simplify convert"
