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
  if (!Number.isInteger(charged) || !Number.isInteger(requested) || requested <= 0) {
    throw new Error("refund amounts must be positive whole cents");
  }
  if (requested > charged) throw new Error("refund exceeds the original charge");
  const gross = requested * 97;
  return { type: "refund", cents: (gross - (gross % 100)) / 100 };
}
JS
cat > test/refunds.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { refund } from "../src/refunds.js";

test("keeps a 3% fee rounded down for the customer", () => {
  assert.deepEqual(refund(1000, 1000), { type: "refund", cents: 970 });
  assert.deepEqual(refund(1000, 101), { type: "refund", cents: 97 });
});

test("rejects a refund larger than the charge", () => {
  assert.throws(() => refund(500, 501), /exceeds/);
});

test("rejects amounts that are not positive whole cents", () => {
  assert.throws(() => refund(500, 1.5), /whole cents/);
  assert.throws(() => refund(500, 0), /whole cents/);
});
JS
git add -A
git commit -q -m "feat: add refunds"
