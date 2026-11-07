#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src test docs
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > AGENTS.md <<'MD'
# Repository rules

- Money is an integer number of cents. Never use floating-point arithmetic on money.
- Every exported function has a test in `test/`.
MD
cat > src/payments.js <<'JS'
export function charge(cents) {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("charge must be a positive number of cents");
  return { type: "charge", cents };
}
JS
cat > test/payments.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { charge } from "../src/payments.js";

test("charges a positive number of cents", () => {
  assert.deepEqual(charge(500), { type: "charge", cents: 500 });
});
JS
cat > docs/refund-spec.md <<'MD'
# Refunds

1. `refund(charged, requested)` takes the original charge and the requested refund, both in cents.
2. A refund larger than the original charge is rejected with an error.
3. A 3% processing fee is kept: the customer receives the requested amount minus 3%, rounded down to a whole cent.
MD
git add -A
git commit -q -m "feat: add charges"
git switch -q -c feat/refund
cat > src/refunds.js <<'JS'
export function refund(charged, requested) {
  return { type: "refund", cents: requested * 0.97 };
}
JS
git add -A
git commit -q -m "feat: add refunds"
