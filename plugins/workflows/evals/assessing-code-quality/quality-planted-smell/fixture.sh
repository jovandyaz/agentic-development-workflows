#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
cat > src/pricing.js <<'EOF'
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
EOF
git add src/pricing.js
git commit -q -m "feat(pricing): add subtotal"
cat >> src/pricing.js <<'EOF'

export function memberTotal(items, member) {
  let total = subtotal(items);
  if (member.tier === "gold") total = total - total * 0.2;
  else if (member.tier === "silver") total = total - total * 0.1;
  return Math.round(total * 100) / 100;
}

export function invoiceTotal(items, member) {
  let total = subtotal(items);
  if (member.tier === "gold") total = total - total * 0.2;
  else if (member.tier === "silver") total = total - total * 0.1;
  return Math.round(total * 100) / 100 + 4.99;
}
EOF
