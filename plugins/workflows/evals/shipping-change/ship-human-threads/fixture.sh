#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
printf '# Orders\n' > README.md
git add README.md
git commit -q -m "chore: initialize orders"
git switch -q -c feat/order-delete
printf 'export const deleteOrder = (id) => orders.delete(id);\n' > orders.js
git add orders.js
git commit -q -m "feat: add order delete"
cat > PR-THREADS.md <<'EOT'
# Review threads on the pull request for feat/order-delete

## Thread 1 (unresolved) by reviewer-a (human)

Deleting frees the ID; is that intended?

## Thread 2 (unresolved) by reviewer-a (human)

`shared` imports `domain` here.

## Thread 3 (unresolved) by review-helper[bot] (bot)

Consider adding a changelog entry.
EOT
