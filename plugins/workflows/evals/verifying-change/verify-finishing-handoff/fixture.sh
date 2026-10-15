#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '{\n  "name": "sum",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf 'node_modules/\n' > .gitignore
git add package.json .gitignore
git commit -q -m "chore: initialize sum"
git switch -q -c feat/sum
mkdir -p test
printf 'export function sum(a, b) {\n  return a + b;\n}\n' > sum.js
printf 'import assert from "node:assert/strict";\nimport test from "node:test";\nimport { sum } from "../sum.js";\n\ntest("adds", () => assert.equal(sum(2, 3), 5));\n' > test/sum.test.js
git add sum.js test/sum.test.js
git commit -q -m "feat: add sum"
