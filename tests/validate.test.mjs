import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
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

function runValidator(directory) {
  return spawnSync(process.execPath, [join(directory, "scripts", "validate.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
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
    "assessing-code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace(
    `metadata:\n  author: jovandyaz\n  version: "${version}"`,
    `metadata:\n  author: jovandyaz\ncompatibility:\n  version: "${version}"`,
  );
  writeFileSync(skillPath, text);

  const result = runValidator(directory);
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
    "assessing-code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace("\n---\n", "\nX: true\n---\n");
  writeFileSync(skillPath, text);

  const result = runValidator(directory);
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
    "assessing-code-quality",
    "SKILL.md",
  );
  const text = readFileSync(skillPath, "utf8").replace(
    "metadata:\n  author: jovandyaz\n",
    "metadata:\n  author: jovandyaz\n# Release metadata is synchronized.\n",
  );
  writeFileSync(skillPath, text);

  const result = runValidator(directory);
  assert.equal(result.status, 0, result.stderr);
});

test("rejects a missing package release version explicitly", (t) => {
  const directory = fixture(t);
  const packagePath = join(directory, "package.json");
  const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"));
  packageManifest.version = null;
  writeFileSync(packagePath, `${JSON.stringify(packageManifest, null, 2)}\n`);

  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json: version must be a non-empty strict semver string/);
});

test("rejects a malformed package release version explicitly", (t) => {
  const directory = fixture(t);
  const packagePath = join(directory, "package.json");
  const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"));
  packageManifest.version = "v2";
  writeFileSync(packagePath, `${JSON.stringify(packageManifest, null, 2)}\n`);

  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json: version must be a non-empty strict semver string/);
});

test("rejects a skill without a native eval suite", (t) => {
  const directory = fixture(t);
  rmSync(join(directory, "plugins", "workflows", "evals", "committing-change"), {
    recursive: true,
  });
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evals[\\/]committing-change: missing eval suite/);
});

test("rejects an eval case without graders", (t) => {
  const directory = fixture(t);
  rmSync(
    join(directory, "plugins", "workflows", "evals", "committing-change", "commit-authorized", "graders"),
    { recursive: true },
  );
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit-authorized: expected at least one grader/);
});

test("rejects a legacy per-skill evals directory", (t) => {
  const directory = fixture(t);
  const legacy = join(directory, "plugins", "workflows", "skills", "committing-change", "evals");
  mkdirSync(legacy);
  writeFileSync(join(legacy, "evals.json"), "{}\n");
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /legacy evals directory/);
});

test("rejects an eval suite for an unknown skill", (t) => {
  const directory = fixture(t);
  mkdirSync(join(directory, "plugins", "workflows", "evals", "unknown-skill", "case-one"), {
    recursive: true,
  });
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown eval suite unknown-skill/);
});

test("rejects a suite with fewer than three cases", (t) => {
  const directory = fixture(t);
  const suite = join(directory, "plugins", "workflows", "evals", "committing-change");
  for (const name of readdirSync(suite).slice(2)) {
    rmSync(join(suite, name), { recursive: true });
  }
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evals[\\/]committing-change: expected at least 3 eval cases/);
});

function evalPath(directory, ...segments) {
  return join(directory, "plugins", "workflows", "evals", ...segments);
}

function replaceInFile(path, search, replacement) {
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(search), `${path} contains ${search}`);
  writeFileSync(path, text.replace(search, replacement));
}

function assertReported(result, pattern) {
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^FAIL: \d+ validation problem/m);
  assert.match(result.stderr, pattern);
}

test("reports a file at the eval suite root", (t) => {
  const directory = fixture(t);
  rmSync(evalPath(directory), { recursive: true });
  writeFileSync(evalPath(directory), "not a directory\n");
  assertReported(runValidator(directory), /evals: eval suite root must be a directory/);
});

test("reports a file where an eval suite belongs", (t) => {
  const directory = fixture(t);
  rmSync(evalPath(directory, "committing-change"), { recursive: true });
  writeFileSync(evalPath(directory, "committing-change"), "not a directory\n");
  assertReported(
    runValidator(directory),
    /evals[\\/]committing-change: eval suite must be a directory/,
  );
});

test("reports a file where an eval case belongs", (t) => {
  const directory = fixture(t);
  writeFileSync(evalPath(directory, "committing-change", "stray-case"), "not a directory\n");
  assertReported(runValidator(directory), /stray-case: eval case must be a directory/);
});

test("ignores hidden files such as .DS_Store inside an eval suite", (t) => {
  const directory = fixture(t);
  writeFileSync(evalPath(directory, "committing-change", ".DS_Store"), "");
  const result = runValidator(directory);
  assert.equal(result.status, 0, result.stderr);
});

test("reports a directory where case.yaml belongs", (t) => {
  const directory = fixture(t);
  const caseFile = evalPath(directory, "committing-change", "commit-authorized", "case.yaml");
  rmSync(caseFile);
  mkdirSync(caseFile);
  assertReported(runValidator(directory), /commit-authorized: case\.yaml must be a file/);
});

test("reports a file where an eval case's graders belong", (t) => {
  const directory = fixture(t);
  const graders = evalPath(directory, "committing-change", "commit-authorized", "graders");
  rmSync(graders, { recursive: true });
  writeFileSync(graders, "not a directory\n");
  assertReported(
    runValidator(directory),
    /commit-authorized[\\/]graders: graders must be a directory/,
  );
});

test("rejects a scaffold script outside the case directory", (t) => {
  const directory = fixture(t);
  replaceInFile(
    evalPath(directory, "committing-change", "commit-authorized", "case.yaml"),
    "scaffold_script: fixture.sh",
    "scaffold_script: ../commit-not-authorized/fixture.sh",
  );
  assertReported(
    runValidator(directory),
    /commit-authorized: scaffold_script must be a relative path inside the case directory/,
  );
});

test("rejects an absolute scaffold script path", (t) => {
  const directory = fixture(t);
  const caseDirectory = evalPath(directory, "committing-change", "commit-authorized");
  replaceInFile(
    join(caseDirectory, "case.yaml"),
    "scaffold_script: fixture.sh",
    `scaffold_script: "${join(caseDirectory, "fixture.sh").replaceAll("\\", "/")}"`,
  );
  assertReported(
    runValidator(directory),
    /commit-authorized: scaffold_script must be a relative path inside the case directory/,
  );
});

test("rejects a missing scaffold script", (t) => {
  const directory = fixture(t);
  rmSync(evalPath(directory, "committing-change", "commit-authorized", "fixture.sh"));
  assertReported(
    runValidator(directory),
    /commit-authorized: scaffold_script fixture\.sh not found in the case directory/,
  );
});

test("rejects a case name that differs from its directory", (t) => {
  const directory = fixture(t);
  replaceInFile(
    evalPath(directory, "committing-change", "commit-authorized", "case.yaml"),
    "name: commit-authorized",
    "name: commit-renamed",
  );
  assertReported(
    runValidator(directory),
    /commit-authorized: case\.yaml name must match directory/,
  );
});

test("rejects an eval case without prompt.md or case.yaml", (t) => {
  const directory = fixture(t);
  const evalCase = join(
    directory,
    "plugins",
    "workflows",
    "evals",
    "committing-change",
    "commit-authorized",
  );
  rmSync(join(evalCase, "prompt.md"));
  rmSync(join(evalCase, "case.yaml"));
  const result = runValidator(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit-authorized: missing prompt\.md or case\.yaml/);
});
