import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skills = join(root, "plugins", "workflows", "skills");

function skill(name) {
  return readFileSync(join(skills, name, "SKILL.md"), "utf8");
}

function assertOrdered(text, labels) {
  let previous = -1;
  for (const label of labels) {
    const current = text.indexOf(label);
    assert.ok(current > previous, `expected ${label} after previous pipeline stage`);
    previous = current;
  }
}

test("reviewing-pr runs code-quality before every other review lens", () => {
  const text = skill("reviewing-pr");
  assertOrdered(text, [
    "First gate: code-quality",
    "Superpowers review",
    "Standards and spec review",
    "Anthropic review",
  ]);
  assert.match(text, /No other review lens starts until code-quality returns/);
});

test("feature and bug workflows review before final verification", () => {
  for (const name of ["developing-feature", "fixing-bug"]) {
    assertOrdered(skill(name), ["reviewing-pr", "verifying-change"]);
  }
});

test("feature workflow preserves an already-approved design", () => {
  assert.match(
    skill("developing-feature"),
    /If a design is already approved, validate that it is\s+still applicable without reopening settled choices/,
  );
});

test("implementation workflows propagate the no-commit constraint", () => {
  for (const name of ["developing-feature", "fixing-bug"]) {
    assert.match(
      skill(name),
      /(?:Pass|pass) (?:a|that) no-commit\s+constraint/,
    );
  }
});

test("portable review setup installs both Matt Pocock skills", () => {
  const review = skill("reviewing-pr");
  assert.match(review, /--skill code-review --skill setup-matt-pocock-skills/);
});

test("failed verification returns through debugging, review, and verification", () => {
  assertOrdered(skill("verifying-change"), [
    "Use systematic-debugging",
    "Run reviewing-pr",
    "Run verifying-change again",
  ]);
});

test("dependency lock pins every approved external dependency", () => {
  const lock = JSON.parse(
    readFileSync(join(root, "dependencies.lock.json"), "utf8"),
  );
  assert.deepEqual(
    lock.dependencies.map(({ id }) => id),
    [
      "superpowers",
      "anthropic-frontend-design",
      "mattpocock-code-review",
      "anthropic-code-review",
      "playwright-mcp",
    ],
  );
  for (const dependency of lock.dependencies) {
    assert.match(dependency.revision, /^[a-f0-9]{40}$/);
    assert.ok(dependency.license);
    assert.ok(dependency.requirement);
  }
});

test("portable install instructions use reviewed immutable artifacts", () => {
  const files = [
    skill("developing-feature"),
    skill("fixing-bug"),
    skill("reviewing-pr"),
    skill("verifying-change"),
    readFileSync(join(root, "README.md"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(files, /@latest/);
  assert.match(files, /3b3fad96af16a10759d930941b4520ba0c40edae\.tar\.gz/);
  assert.match(files, /6654f6b60cd9d5be8b54c6fafe44346dabeb3b76\.tar\.gz/);
  assert.match(files, /@playwright\/mcp@0\.0\.79/);
});
