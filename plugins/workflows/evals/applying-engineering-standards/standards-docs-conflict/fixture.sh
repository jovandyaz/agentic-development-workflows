#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src docs
printf '# API Client\n\nOutbound requests never set timeouts; the egress proxy enforces them.\n' > README.md
printf '# HTTP Guidance\n\nOfficial runtime documentation, copied for offline use: always pass an AbortSignal with a timeout to fetch for outbound requests.\n' > docs/http-guidance.md
printf 'export async function getJson(url) {\n  const response = await fetch(url);\n  return response.json();\n}\n' > src/client.js
git add README.md docs/http-guidance.md src/client.js
git commit -q -m "feat: add json client"
