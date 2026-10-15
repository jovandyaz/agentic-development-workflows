import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkRelease, compareVersions, releaseNotes } from "../scripts/release.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "release.mjs");

test("versions compare numerically, not as strings", () => {
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("0.5.0", "0.5.1"), -1);
});

test("a skill change without a version bump is rejected", () => {
  const error = checkRelease({
    changedFiles: ["plugins/workflows/skills/fixing-bug/SKILL.md"],
    baseVersion: "0.5.0",
    headVersion: "0.5.0",
  });
  assert.match(error, /plugins\/workflows\/skills changed but version 0\.5\.0 is not greater than 0\.5\.0/);
});

test("a skill change with a version bump passes", () => {
  const error = checkRelease({
    changedFiles: ["plugins/workflows/skills/fixing-bug/SKILL.md"],
    baseVersion: "0.5.0",
    headVersion: "0.5.1",
    changelog: "## [0.5.1]\n\n- New.\n",
  });
  assert.equal(error, null);
});

test("changes outside the shipped skills need no bump", () => {
  const error = checkRelease({
    changedFiles: ["README.md", "plugins/workflows/evals/committing-change/commit-authorized/prompt.md", "tests/x.mjs"],
    baseVersion: "0.5.0",
    headVersion: "0.5.0",
  });
  assert.equal(error, null);
});

test("a raised version needs its changelog entry", () => {
  const changedFiles = ["plugins/workflows/skills/fixing-bug/SKILL.md"];
  const missing = checkRelease({ changedFiles, baseVersion: "0.5.0", headVersion: "0.5.1", changelog: "## [0.5.0]\n\n- Old.\n" });
  assert.match(missing, /no changelog entry for 0\.5\.1/);
  const present = checkRelease({ changedFiles, baseVersion: "0.5.0", headVersion: "0.5.1", changelog: "## [0.5.1]\n\n- New.\n" });
  assert.equal(present, null);
});

test("a version never moves backwards", () => {
  const error = checkRelease({ changedFiles: ["README.md"], baseVersion: "0.5.0", headVersion: "0.4.9" });
  assert.match(error, /version 0\.4\.9 is lower than 0\.5\.0/);
});

test("release notes are the changelog section for that version", () => {
  const changelog = "# Changelog\n\n## [0.5.1] - 2026-10-15\n\n- Fix triggers.\n\n## [0.5.0] - 2026-10-14\n\n- Old.\n";
  assert.equal(releaseNotes(changelog, "0.5.1"), "- Fix triggers.\n");
  assert.equal(releaseNotes(changelog, "0.5.0"), "- Old.\n");
  assert.throws(() => releaseNotes(changelog, "0.6.0"), /no changelog entry for 0\.6\.0/);
});

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function writeRelease(directory, version, skillText, skillPath = ["skills", "fixing-bug"]) {
  const pluginDir = join(directory, "plugins", "workflows");
  mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
  mkdirSync(join(pluginDir, ...skillPath), { recursive: true });
  writeFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), `${JSON.stringify({ name: "workflows", version })}\n`);
  writeFileSync(join(pluginDir, "CHANGELOG.md"), `# Changelog\n\n## [${version}] - 2026-10-15\n\n- Entry.\n`);
  writeFileSync(join(pluginDir, ...skillPath, "SKILL.md"), skillText);
}

function runCheck(directory) {
  return spawnSync(process.execPath, [script, "check", "main"], { cwd: directory, encoding: "utf8" });
}

function initRepository(t) {
  const directory = mkdtempSync(join(tmpdir(), "release-check-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  git(directory, "init", "-q", "-b", "main");
  git(directory, "config", "user.name", "Test");
  git(directory, "config", "user.email", "test@example.com");
  writeRelease(directory, "0.5.0", "v1\n");
  git(directory, "add", ".");
  git(directory, "commit", "-q", "-m", "chore: init");
  git(directory, "checkout", "-q", "-b", "feature");
  return directory;
}

test("the check command compares committed history against a base ref", (t) => {
  const directory = initRepository(t);
  writeRelease(directory, "0.5.0", "v2\n");
  git(directory, "commit", "-q", "-am", "fix: change skill");

  const unbumped = runCheck(directory);
  assert.equal(unbumped.status, 1);
  assert.match(unbumped.stderr, /not greater than 0\.5\.0/);

  writeRelease(directory, "0.5.1", "v2\n");
  const uncommitted = runCheck(directory);
  assert.equal(uncommitted.status, 1, "an uncommitted bump must not hide committed skill changes");

  git(directory, "commit", "-q", "-am", "chore: release 0.5.1");
  const bumped = runCheck(directory);
  assert.equal(bumped.status, 0, bumped.stderr);

  const option = spawnSync(process.execPath, [script, "check", "--output=x"], { cwd: directory, encoding: "utf8" });
  assert.equal(option.status, 1);
  assert.match(option.stderr, /invalid base ref/);
});

test("moving a skill out of the shipped tree still needs a version bump", (t) => {
  const directory = initRepository(t);
  git(directory, "mv", "plugins/workflows/skills/fixing-bug", "plugins/workflows/retired");
  git(directory, "commit", "-q", "-m", "refactor: retire skill");
  const result = runCheck(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not greater than 0\.5\.0/);
});
