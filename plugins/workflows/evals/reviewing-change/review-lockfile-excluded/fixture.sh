#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src/generated
printf '{\n  "name": "orders",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf '# Orders\n\n- Prices are integer cents.\n' > AGENTS.md
printf 'src/generated/** linguist-generated=true\n' > .gitattributes
printf 'export function subtotal(line) {\n  return line.cents * line.quantity;\n}\n' > src/orders.js
printf "lockfileVersion: '9.0'\n" > pnpm-lock.yaml
printf 'export const schemaVersion = 1;\n' > src/generated/schema.js
git add -A
git commit -q -m "feat: add order subtotals"
git switch -q -c feat/order-total
printf 'export function subtotal(line) {\n  return line.cents * line.quantity;\n}\n\nexport function total(lines) {\n  return lines.reduce((sum, line) => sum + subtotal(line), 0);\n}\n' > src/orders.js
{
  printf "lockfileVersion: '9.0'\n\npackages:\n"
  for i in $(seq 1 100); do
    printf '  /dep-%s@1.0.%s:\n    resolution: {integrity: sha512-LOCKMARKER%s}\n    dev: false\n' "$i" "$i" "$i"
  done
} > pnpm-lock.yaml
{
  printf 'export const schemaVersion = 2;\n'
  for i in $(seq 1 40); do printf 'export const field%s = "GENMARKER%s";\n' "$i" "$i"; done
} > src/generated/schema.js
git commit -q -am "feat: add order totals"
