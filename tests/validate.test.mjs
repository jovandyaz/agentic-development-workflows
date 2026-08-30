import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "workflow-validator-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "scripts"));
  cpSync(join(root, "scripts", "validate.mjs"), join(directory, "scripts", "validate.mjs"));
  cpSync(join(root, ".claude-plugin"), join(directory, ".claude-plugin"), {
    recursive: true,
  });
  cpSync(join(root, "plugins"), join(directory, "plugins"), { recursive: true });
  for (const name of ["package.json", "dependencies.lock.json"]) {
    cpSync(join(root, name), join(directory, name));
  }
  return directory;
}

test("rejects a version outside the metadata block", (t) => {
  const directory = fixture(t);
  const skillPath = join(
    directory,
    "plugins",
    "workflows",
    "skills",
    "code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace(
    'metadata:\n  author: jovandyaz\n  version: "0.2.0"',
    'metadata:\n  author: jovandyaz\ncompatibility:\n  version: "0.2.0"',
  );
  writeFileSync(skillPath, text);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /metadata version must equal 0\.2\.0/);
});
