#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src/domain src/application src/shared
printf '{\n  "name": "shop",\n  "type": "module",\n  "scripts": {\n    "test": "node --test",\n    "lint:arch": "depcruise src --config .dependency-cruiser.cjs"\n  }\n}\n' > package.json
cat > AGENTS.md <<'MD'
# Shop

## Architecture

- `src/shared` must not import `src/domain`; enforced by `pnpm lint:arch`.
- `src/domain` must not import `src/application`.
MD
cat > .dependency-cruiser.cjs <<'JS'
module.exports = {
  forbidden: [
    {
      name: "domain-not-application",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "application-not-infra",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/infra" },
    },
  ],
};
JS
cat > src/domain/money.ts <<'TS'
export interface Money {
  amount: number;
  currency: string;
}

export function add(a: Money, b: Money): Money {
  return { amount: a.amount + b.amount, currency: a.currency };
}
TS
git add -A
git commit -q -m "feat: add money domain"
git switch -q -c feat/money-format
cat > src/shared/format.ts <<'TS'
import type { Money } from "../domain/money.js";

export function formatMoney(money: Money): string {
  return `${(money.amount / 100).toFixed(2)} ${money.currency}`;
}
TS
git add -A
git commit -q -m "feat: add money formatter"
