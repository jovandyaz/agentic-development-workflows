#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src docs
printf '{\n  "name": "support-log",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf '# Support Log\n\n- No phone number reaches the logs.\n' > AGENTS.md
cat > src/redact.js <<'JS'
const PHONE = /\d{10}/g;

export function redact(line) {
  return line.replace(PHONE, "[phone]");
}
JS
git add -A
git commit -q -m "feat: redact phone numbers from log lines"
git switch -q -c fix/redact-phones
sed -i.bak 's#^const PHONE = .*#const PHONE = /\\d{10}|\\d{3}-\\d{3}-\\d{4}/g;#' src/redact.js && rm src/redact.js.bak
git commit -q -am "fix: redact phone numbers written with dashes"
sed -i.bak 's#^const PHONE = .*#const PHONE = /\\d{10}|\\d{3}-\\d{3}-\\d{4}|\\d{3}\\.\\d{3}\\.\\d{4}/g;#' src/redact.js && rm src/redact.js.bak
git commit -q -am "fix: redact phone numbers written with dots"
cat > docs/review-round-1.md <<'MD'
# Review round 1: fix/redact-phones

## Blocking

1. Phone numbers written with dashes bypass redaction (src/redact.js:1).
   `555-123-4567` reaches the logs because PHONE matches only ten adjacent
   digits. Fixed by commit "fix: redact phone numbers written with dashes".
MD
printf 'docs/review-round-1.md\n' >> .git/info/exclude
