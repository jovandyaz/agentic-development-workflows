#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf '{\n  "name": "api",\n  "type": "module",\n  "dependencies": {\n    "express": "4.21.2"\n  }\n}\n' > package.json
printf 'import express from "express";\n\nconst app = express();\napp.get("/health", (req, res) => res.json({ ok: true }));\nexport default app;\n' > src/server.js
git add package.json src/server.js
git commit -q -m "feat: add health endpoint"
