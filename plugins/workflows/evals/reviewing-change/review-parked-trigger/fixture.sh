#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src scripts
printf '{\n  "name": "profiles",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > src/profile-reader.ts <<'TS'
interface Db {
  query(sql: string, params: unknown[]): Promise<{ rows: { data: string }[] }>;
}

export async function readProfile(db: Db, id: string): Promise<unknown> {
  const { rows } = await db.query("SELECT data FROM profiles WHERE id = $1", [id]);
  return JSON.parse(rows[0].data);
}
TS
cat > src/profile-writer.ts <<'TS'
interface Db {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

export async function saveProfile(db: Db, id: string, name: string): Promise<void> {
  const data = JSON.stringify({ name: name.trim() });
  await db.query("UPDATE profiles SET data = $2 WHERE id = $1", [id, data]);
}
TS
cat > REVIEW-LEDGER.md <<'MD'
# Review ledger

## Round 1

Parked (Non-blocking):

- `parse` on read in `src/profile-reader.ts`: `JSON.parse` trusts the stored
  text. Revisit if a second writer appears; today `saveProfile` is the only
  writer and always stores trimmed, valid JSON.
MD
git add -A
git commit -q -m "feat: add profile reader and writer"
git switch -q -c feat/profile-backfill
cat > scripts/backfill-profiles.ts <<'TS'
interface Db {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

export async function backfill(db: Db, legacy: { id: string; raw: string }[]): Promise<void> {
  for (const row of legacy) {
    await db.query("UPDATE profiles SET data = $2 WHERE id = $1", [row.id, row.raw]);
  }
}
TS
git add -A
git commit -q -m "feat: backfill profiles from legacy export"
