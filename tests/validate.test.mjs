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
  const version = JSON.parse(
    readFileSync(join(directory, "package.json"), "utf8"),
  ).version;
  const skillPath = join(
    directory,
    "plugins",
    "workflows",
    "skills",
    "code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace(
    `metadata:\n  author: jovandyaz\n  version: "${version}"`,
    `metadata:\n  author: jovandyaz\ncompatibility:\n  version: "${version}"`,
  );
  writeFileSync(skillPath, text);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`metadata version must equal ${version.replaceAll(".", "\\.")}`));
});

test("rejects unsupported uppercase top-level fields", (t) => {
  const directory = fixture(t);
  const skillPath = join(
    directory,
    "plugins",
    "workflows",
    "skills",
    "code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace("\n---\n", "\nX: true\n---\n");
  writeFileSync(skillPath, text);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported field X/);
});

test("allows comments inside the metadata block", (t) => {
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
    "metadata:\n  author: jovandyaz\n",
    "metadata:\n  author: jovandyaz\n# Release metadata is synchronized.\n",
  );
  writeFileSync(skillPath, text);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("rejects a missing package release version explicitly", (t) => {
  const directory = fixture(t);
  const packagePath = join(directory, "package.json");
  const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"));
  packageManifest.version = null;
  writeFileSync(packagePath, `${JSON.stringify(packageManifest, null, 2)}\n`);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json: version must be a non-empty strict semver string/);
});

test("rejects a malformed package release version explicitly", (t) => {
  const directory = fixture(t);
  const packagePath = join(directory, "package.json");
  const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"));
  packageManifest.version = "v2";
  writeFileSync(packagePath, `${JSON.stringify(packageManifest, null, 2)}\n`);

  const result = spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json: version must be a non-empty strict semver string/);
});
