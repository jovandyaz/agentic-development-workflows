#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf 'const users = new Map();\n\nexport function addUser(user) {\n  users.set(user.id, user);\n}\n\nexport function findUser(id) {\n  return users.get(id);\n}\n' > src/users.js
git add src/users.js
git commit -q -m "feat: add in-memory users"
