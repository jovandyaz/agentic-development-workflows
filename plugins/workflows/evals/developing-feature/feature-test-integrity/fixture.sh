#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src test
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > src/money.js <<'JS'
export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
JS
cat > test/money.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCents } from "../src/money.js";

test("formats cents as dollars", () => {
  assert.equal(formatCents(1999), "$19.99");
});
JS
git add -A
git commit -q -m "feat: add money formatting"
git switch -q -c feat/split-cents
