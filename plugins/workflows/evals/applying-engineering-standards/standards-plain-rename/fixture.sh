#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
cat > src/counter.js <<'JS'
export function countWords(text) {
  let cnt = 0;
  for (const word of text.split(/\s+/)) {
    if (word !== "") cnt += 1;
  }
  return cnt;
}
JS
git add src/counter.js
git commit -q -m "feat: add word counter"
