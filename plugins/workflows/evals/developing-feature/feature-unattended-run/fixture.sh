#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '{\n  "name": "fx",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf 'const [, , name = "world"] = process.argv;\nconsole.log(`hello ${name}`);\n' > cli.js
git add package.json cli.js
git commit -q -m "feat: add greeting cli"
