#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src test
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > src/cart.js <<'JS'
export function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
JS
cat > test/cart.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total } from "../src/cart.js";

test("an item without a quantity counts once", () => {
  assert.equal(total([{ price: 5 }]), 5);
});
JS
git add -A
git commit -q -m "feat: add cart total"
git switch -q -c fix/cart-quantity
