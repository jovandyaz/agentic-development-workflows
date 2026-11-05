#!/usr/bin/env bash
set -euo pipefail
git init -q --bare -b main .remote.git
printf '#!/bin/sh\nwhile read -r old new ref; do echo "$ref" >> pushed.log; done\n' > .remote.git/hooks/pre-receive
chmod +x .remote.git/hooks/pre-receive
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '.remote.git/\n' >> .git/info/exclude
printf 'export const limit = 10;\n' > config.js
git add config.js
git commit -q -m "chore: initialize config"
git remote add origin .remote.git
git push -q origin main
git remote set-head origin main
: > .remote.git/pushed.log
git switch -q -c fix/raise-limit
printf 'export const limit = 50;\n' > config.js
git commit -q -am "fix: raise the request limit"
