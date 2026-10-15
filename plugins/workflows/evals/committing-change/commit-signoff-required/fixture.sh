#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf '# Contributing\n\nAll commits must include a `Signed-off-by` trailer (Developer Certificate of Origin). Use `git commit -s`.\n' > CONTRIBUTING.md
printf 'export function verify(token) {\n  return token.length > 0;\n}\n' > src/auth.js
git add CONTRIBUTING.md src/auth.js
git commit -q -s -m "feat(auth): add token verification"
printf 'export function verify(token) {\n  return typeof token === "string" && token.length > 0;\n}\n' > src/auth.js
git add src/auth.js
