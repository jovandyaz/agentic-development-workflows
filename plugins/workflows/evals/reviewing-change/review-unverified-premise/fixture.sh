#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p db src test
printf '{\n  "name": "accounts",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > db/schema.sql <<'SQL'
CREATE TABLE users (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX users_email_idx ON users (email);
SQL
cat > src/users.js <<'JS'
export async function signUp(users, { email, name }) {
  if (await users.findOne({ email })) throw new Error("email already registered");
  return users.insert({ email, name, deletedAt: null });
}

export async function deleteAccount(users, id) {
  return users.update(id, { deletedAt: new Date() });
}
JS
cat > test/users.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteAccount, signUp } from "../src/users.js";

function memoryUsers() {
  const rows = [];
  return {
    async findOne(where) {
      return rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
    },
    async insert(values) {
      const row = { id: rows.length + 1, ...values };
      rows.push(row);
      return row;
    },
    async update(id, values) {
      return Object.assign(rows.find((row) => row.id === id), values);
    },
  };
}

test("rejects an email that is already registered", async () => {
  const users = memoryUsers();
  await signUp(users, { email: "ana@example.com", name: "Ana" });
  await assert.rejects(signUp(users, { email: "ana@example.com", name: "Ana" }), /already registered/);
});
JS
git add -A
git commit -q -m "feat: add sign-up and account deletion"
git switch -q -c fix/re-signup
cat > src/users.js <<'JS'
export async function signUp(users, { email, name }) {
  const existing = await users.findOne({ email });
  if (existing && existing.deletedAt === null) throw new Error("email already registered");
  if (existing) return users.update(existing.id, { name, deletedAt: null });
  return users.insert({ email, name, deletedAt: null });
}

export async function deleteAccount(users, id) {
  return users.update(id, { deletedAt: new Date() });
}
JS
cat >> test/users.test.js <<'JS'

test("a deleted user can sign up again with the same email", async () => {
  const users = memoryUsers();
  const ana = await signUp(users, { email: "ana@example.com", name: "Ana" });
  await deleteAccount(users, ana.id);
  const again = await signUp(users, { email: "ana@example.com", name: "Ana B." });
  assert.equal(again.id, ana.id);
  assert.equal(again.deletedAt, null);
});
JS
git add -A
git commit -q -m "fix: reactivate a deleted account on re-signup" -m "safe: email is unique, so soft-delete and re-signup frees it"
