#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf 'export function verify(token) {\n  return token.length > 0;\n}\n' > src/auth.js
git add src/auth.js
git commit -q -m "feat(auth): add token verification"
printf 'export function verify(token) {\n  return typeof token === "string" && token.length > 0;\n}\n' > src/auth.js
git add src/auth.js
