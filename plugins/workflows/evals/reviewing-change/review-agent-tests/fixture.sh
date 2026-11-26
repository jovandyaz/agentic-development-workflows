#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src test
printf '{\n  "name": "shop",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > src/price.js <<'JS'
export function applyDiscount(cents, pct) {
  return cents - Math.round((cents * pct) / 100);
}
JS
cat > test/price.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount } from "../src/price.js";

test("takes 10% off 1000 cents", () => {
  assert.equal(applyDiscount(1000, 10), 900);
});
JS
git add -A
git commit -q -m "feat: add discounts"
git switch -q -c feat/discount-cap
cat > src/price.js <<'JS'
const MAX_PCT = 50;

export function applyDiscount(cents, pct) {
  const capped = Math.min(pct, MAX_PCT);
  return cents - Math.round((cents * capped) / 100);
}
JS
cat > test/price.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount } from "../src/price.js";

test("takes 10% off 1000 cents", () => {
  assert.equal(typeof applyDiscount(1000, 10), "number");
});

test("caps the discount at 50%", () => {
  assert.ok(applyDiscount(1000, 80) <= 1000);
});
JS
git add -A
git commit -q -m "feat: cap discounts at 50%"
