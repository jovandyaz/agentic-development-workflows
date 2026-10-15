#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src
printf 'export const VERSION = "1.0.0";\n' > src/index.js
git add src/index.js
git commit -q -m "chore: initialize package"
cat > src/address.js <<'EOF'
export function normalizeAddress(input) {
  const address = {};

  address.line1 = String(input.line1 ?? "").trim();
  address.line2 = String(input.line2 ?? "").trim();
  address.city = String(input.city ?? "").trim();
  address.region = String(input.region ?? "").trim().toUpperCase();
  address.postalCode = String(input.postalCode ?? "").replace(/\s+/g, "");
  address.country = String(input.country ?? "").trim().toUpperCase();

  if (address.line1 === "") {
    throw new Error("line1 is required");
  }
  if (address.city === "") {
    throw new Error("city is required");
  }
  if (address.country.length !== 2) {
    throw new Error("country must be an ISO 3166-1 alpha-2 code");
  }

  if (address.country === "US") {
    if (!/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
      throw new Error("US postal code must be ZIP or ZIP+4");
    }
  } else if (address.country === "CA") {
    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/i.test(address.postalCode)) {
      throw new Error("Canadian postal code must be A1A1A1");
    }
    address.postalCode = address.postalCode.toUpperCase();
  } else if (address.country === "MX") {
    if (!/^\d{5}$/.test(address.postalCode)) {
      throw new Error("Mexican postal code must have five digits");
    }
  }

  if (address.line2 === "") {
    delete address.line2;
  }

  return Object.freeze(address);
}
EOF
git add -N src/address.js
