#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf 'export const VERSION = "1.0.0";\n' > src/index.js
git add src/index.js
git commit -q -m "chore: initialize package"
cat > src/slug.js <<'EOF'
export function slugify(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
EOF
git add -N src/slug.js
