import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "sync-portable.mjs");
const canonical = join(root, "plugins", "workflows", "skills");

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "agentic-workflows-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runFrom(cwd, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("emits exactly five byte-identical portable skills", (t) => {
  const output = tempDir(t);
  const result = run("--output", output);
  assert.equal(result.status, 0, result.stderr);

  const expected = [
    "code-quality",
    "developing-feature",
    "fixing-bug",
    "reviewing-pr",
    "verifying-change",
  ];
  const manifest = JSON.parse(
    readFileSync(join(output, ".agentic-workflows-manifest.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(manifest.skills), expected);

  for (const name of expected) {
    assert.equal(
      readFileSync(join(output, name, "SKILL.md"), "utf8"),
      readFileSync(join(canonical, name, "SKILL.md"), "utf8"),
    );
  }
});

test("check detects changed, missing, and unexpected files", (t) => {
  const output = tempDir(t);
  assert.equal(run("--output", output).status, 0);

  appendFileSync(join(output, "code-quality", "SKILL.md"), "\ndrift\n");
  rmSync(join(output, "fixing-bug", "SKILL.md"));
  writeFileSync(join(output, "unexpected.txt"), "unexpected\n");

  const result = run("--check", "--output", output);
  assert.equal(result.status, 1);
  const stderr = result.stderr.replaceAll("\\", "/");
  assert.match(stderr, /code-quality\/SKILL\.md: differs/);
  assert.match(stderr, /fixing-bug\/SKILL\.md: missing/);
  assert.match(stderr, /unexpected\.txt: unexpected/);
});

test("rejects unsafe skill names before replacing output", (t) => {
  const fixture = tempDir(t);
  const source = join(fixture, "skills");
  const output = join(fixture, "output");
  mkdirSync(join(source, "valid-skill"), { recursive: true });
  writeFileSync(
    join(source, "valid-skill", "SKILL.md"),
    "---\nname: wrong-name\ndescription: Use when testing.\n---\n",
  );
  mkdirSync(output);
  writeFileSync(join(output, "sentinel"), "keep\n");

  const result = run("--source", source, "--output", output);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must match its directory/);
  assert.equal(readFileSync(join(output, "sentinel"), "utf8"), "keep\n");
});

test("refuses to overwrite unowned global skills", (t) => {
  const target = tempDir(t);
  const existing = join(target, "code-quality");
  mkdirSync(existing);
  writeFileSync(join(existing, "SKILL.md"), "unrelated\n");

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not owned by agentic-development-workflows/);
  assert.equal(readFileSync(join(existing, "SKILL.md"), "utf8"), "unrelated\n");
});

test("check rejects an unexpected copied skill directory", (t) => {
  const output = tempDir(t);
  assert.equal(run("--output", output).status, 0);
  cpSync(join(output, "code-quality"), join(output, "stale-skill"), {
    recursive: true,
  });

  const result = run("--check", "--output", output);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr.replaceAll("\\", "/"),
    /stale-skill\/SKILL\.md: unexpected/,
  );
});

test("rejects a missing option value without deleting the current directory", (t) => {
  const cwd = tempDir(t);
  const sentinel = join(cwd, "sentinel");
  writeFileSync(sentinel, "keep\n");

  const result = runFrom(cwd, "--output");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--output requires a value/);
  assert.equal(readFileSync(sentinel, "utf8"), "keep\n");
});

test("rejects unsafe ownership manifest keys without deleting outside target", (t) => {
  const fixture = tempDir(t);
  const target = join(fixture, "skills");
  const victim = join(fixture, "victim");
  mkdirSync(target);
  mkdirSync(victim);
  writeFileSync(join(victim, "sentinel"), "keep\n");
  writeFileSync(
    join(target, ".agentic-workflows-manifest.json"),
    JSON.stringify({
      source: "jovandyaz/agentic-development-workflows",
      skills: { "../victim": {} },
    }),
  );

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid owned skill name/);
  assert.equal(readFileSync(join(victim, "sentinel"), "utf8"), "keep\n");
});

test("does not treat inherited object keys as owned skill names", (t) => {
  const fixture = tempDir(t);
  const source = join(fixture, "source");
  const target = join(fixture, "target");
  mkdirSync(join(source, "constructor"), { recursive: true });
  writeFileSync(
    join(source, "constructor", "SKILL.md"),
    "---\nname: constructor\ndescription: Use when testing ownership.\n---\n",
  );
  mkdirSync(join(target, "constructor"), { recursive: true });
  writeFileSync(join(target, "constructor", "SKILL.md"), "unrelated\n");

  const result = run("--source", source, "--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not owned by agentic-development-workflows/);
  assert.equal(
    readFileSync(join(target, "constructor", "SKILL.md"), "utf8"),
    "unrelated\n",
  );
});

test("rejects a foreign ownership manifest", (t) => {
  const target = tempDir(t);
  writeFileSync(
    join(target, ".agentic-workflows-manifest.json"),
    JSON.stringify({ source: "another-project", skills: {} }),
  );

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unexpected manifest source/);
});

test("refuses to overwrite a locally modified owned skill", (t) => {
  const target = tempDir(t);
  assert.equal(run("--install-dir", target).status, 0);
  const installed = join(target, "code-quality", "SKILL.md");
  appendFileSync(installed, "\nlocal change\n");

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /integrity does not match ownership manifest/);
  assert.match(readFileSync(installed, "utf8"), /local change/);
});

test("rejects a symlinked ownership manifest", (t) => {
  const fixture = tempDir(t);
  const target = join(fixture, "skills");
  const external = join(fixture, "external.json");
  mkdirSync(target);
  writeFileSync(external, JSON.stringify({ source: "external", skills: {} }));
  symlinkSync(external, join(target, ".agentic-workflows-manifest.json"));

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ownership manifest must not be a symlink/);
  assert.match(readFileSync(external, "utf8"), /external/);
});

test("rejects overlapping source and installation directories", (t) => {
  const fixture = tempDir(t);
  const source = join(fixture, "skills");
  mkdirSync(join(source, "test-skill"), { recursive: true });
  const skillPath = join(source, "test-skill", "SKILL.md");
  writeFileSync(
    skillPath,
    "---\nname: test-skill\ndescription: Use when testing overlap.\n---\n",
  );

  const result = run("--source", source, "--install-dir", source);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source and output directories must not overlap/);
  assert.match(readFileSync(skillPath, "utf8"), /test-skill/);
});

test("accepts CRLF Agent Skills frontmatter", (t) => {
  const fixture = tempDir(t);
  const source = join(fixture, "source");
  const output = join(fixture, "output");
  mkdirSync(join(source, "crlf-skill"), { recursive: true });
  const skillContent = "---\r\nname: crlf-skill\r\ndescription: Use when testing CRLF.\r\n---\r\n";
  writeFileSync(join(source, "crlf-skill", "SKILL.md"), skillContent);
  mkdirSync(join(source, "crlf-skill", "a"));
  writeFileSync(join(source, "crlf-skill", "a", "file"), "nested\n");
  writeFileSync(join(source, "crlf-skill", "a0"), "sibling\n");

  const result = run("--source", source, "--output", output);
  assert.equal(result.status, 0, result.stderr);
  const expectedHash = createHash("sha256");
  for (const [path, content] of [
    ["SKILL.md", Buffer.from(skillContent)],
    ["a/file", Buffer.from("nested\n")],
    ["a0", Buffer.from("sibling\n")],
  ]) {
    expectedHash.update(path).update("\0").update(content).update("\0");
  }
  const expected = expectedHash.digest("hex");
  const manifest = JSON.parse(
    readFileSync(join(output, ".agentic-workflows-manifest.json"), "utf8"),
  );
  assert.equal(manifest.skills["crlf-skill"].integrity, `sha256-${expected}`);
});

test("requires explicit recovery for an abandoned installer lock", (t) => {
  const target = tempDir(t);
  writeFileSync(
    join(target, ".agentic-workflows-install.lock"),
    JSON.stringify({
      version: 1,
      source: "jovandyaz/agentic-development-workflows",
      pid: 2147483647,
      createdAt: "2026-01-01T00:00:00.000Z",
      phase: "starting",
      stage: null,
      hadManifest: false,
      expected: null,
      swaps: [],
    }),
  );

  const result = run("--install-dir", target);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run the same command with --recover/);
  assert.equal(existsSync(join(target, ".agentic-workflows-install.lock")), true);

  const recovery = run("--install-dir", target, "--recover");
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.equal(existsSync(join(target, ".agentic-workflows-install.lock")), false);
  assert.equal(run("--install-dir", target).status, 0);
});

test("rolls back an interrupted directory and manifest swap", (t) => {
  const target = tempDir(t);
  assert.equal(run("--install-dir", target).status, 0);
  const skillPath = join(target, "code-quality", "SKILL.md");
  const manifestPath = join(target, ".agentic-workflows-manifest.json");
  const originalSkill = readFileSync(skillPath, "utf8");
  const originalManifest = readFileSync(manifestPath, "utf8");

  const stageName = ".agentic-workflows-stage-test123";
  const stage = join(target, stageName);
  const backup = join(stage, "backup", "code-quality");
  mkdirSync(join(stage, "backup"), { recursive: true });
  renameSync(join(target, "code-quality"), backup);
  mkdirSync(join(target, "code-quality"));
  writeFileSync(skillPath, "interrupted replacement\n");
  renameSync(manifestPath, join(stage, "manifest.backup"));
  writeFileSync(manifestPath, JSON.stringify({ source: "incomplete", skills: {} }));
  writeFileSync(
    join(target, ".agentic-workflows-install.lock"),
    JSON.stringify({
      version: 1,
      source: "jovandyaz/agentic-development-workflows",
      pid: 2147483647,
      createdAt: "2026-01-01T00:00:00.000Z",
      phase: "committing",
      stage: stageName,
      hadManifest: true,
      expected: null,
      swaps: [{ name: "code-quality", hadDestination: true }],
    }),
  );

  const recovery = run("--install-dir", target, "--recover");
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.equal(readFileSync(skillPath, "utf8"), originalSkill);
  assert.equal(readFileSync(manifestPath, "utf8"), originalManifest);
  assert.equal(existsSync(stage), false);
});
