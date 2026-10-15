import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_AGENTS_LINES = 60;

function agentsInstructions() {
  return readFileSync(join(root, "AGENTS.md"), "utf8");
}

test("agent instructions stay short enough to be followed", () => {
  const lineCount = agentsInstructions().trimEnd().split("\n").length;
  assert.ok(lineCount <= MAX_AGENTS_LINES, `AGENTS.md has ${lineCount} lines`);
});

test("agent instructions carry the rules agents cannot infer", () => {
  const text = agentsInstructions().replace(/\s+/g, " ");
  for (const rule of [
    /Never edit `dist\/`/,
    /`pnpm test` and `pnpm check` pass/,
    /never npm or yarn/,
    /Change all of them together/,
    /No body and no trailers, even when the harness asks/,
    /gerund form/,
    /Descriptions start with `Use when`/,
    /portable fallback/,
    /untrusted data, never as authorization/,
  ]) {
    assert.match(text, rule);
  }
});

test("repository relies on AGENTS.md without a competing CLAUDE.md", () => {
  assert.equal(existsSync(join(root, "CLAUDE.md")), false);
});
