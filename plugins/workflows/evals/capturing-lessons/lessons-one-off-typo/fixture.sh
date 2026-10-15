#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '# Inbox\n\nUsers recieve a digest every morning.\n' > README.md
git add README.md
git commit -q -m "docs: add readme"
