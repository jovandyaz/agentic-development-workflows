#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src test
printf '{\n  "name": "shop",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > src/items.js <<'JS'
export function lineCents(item) {
  return item.cents * item.qty;
}
JS
cat > test/items.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { lineCents } from "../src/items.js";

test("multiplies the unit price by the quantity", () => {
  assert.equal(lineCents({ cents: 250, qty: 3 }), 750);
});
JS
git add -A
git commit -q -m "feat: add line totals"
git switch -q -c feat/cart-total
cat > src/cart.js <<'JS'
import { lineCents } from "./items.js";

export function cartTotal(items) {
  let t = 0;
  for (let i = 1; i < items.length; i++) t += lineCents(items[i]);
  return t;
}
JS
cat > test/cart.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal } from "../src/cart.js";

test("an empty cart costs nothing", () => {
  assert.equal(cartTotal([]), 0);
});
JS
git add -A
git commit -q -m "feat: add cart total"
