import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { pushCommands, pushTargets, tokenize } from "../plugins/workflows/hooks/guard-push.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins", "workflows");
const script = join(plugin, "hooks", "guard-push.mjs");

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function repository(t, branch = "feature/x") {
  const directory = mkdtempSync(join(tmpdir(), "guard-push-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  git(directory, "init", "-q", "-b", "trunk");
  git(directory, "remote", "add", "origin", "https://example.com/repo.git");
  git(directory, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
  git(directory, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init");
  if (branch !== "trunk") git(directory, "switch", "-q", "-c", branch);
  return directory;
}

function hook(cwd, command, env = {}) {
  return spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("tokenizes quoted shell words", () => {
  assert.deepEqual(tokenize(`git push origin "HEAD:main" 'x y'`), ["git", "push", "origin", "HEAD:main", "x y"]);
});

test("finds pushes inside compound commands and after git options", () => {
  const pushes = pushCommands("pnpm test && git -C sub -c x=y push origin main; echo done");
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].args, ["origin", "main"]);
  assert.deepEqual(pushes[0].directories, ["sub"]);
  assert.equal(pushCommands("git status && git log -1").length, 0);
});

test("resolves refspec destinations, HEAD, and every-branch options", () => {
  assert.deepEqual(pushTargets(["origin", "+feature:refs/heads/main"], "feature").branches, ["main"]);
  assert.deepEqual(pushTargets(["origin", "HEAD"], "main").branches, ["main"]);
  assert.deepEqual(pushTargets(["-u", "origin"], "feature").branches, ["feature"]);
  assert.deepEqual(pushTargets(["--tags", "origin"], "main").branches, []);
  assert.equal(pushTargets(["--all", "origin"], "feature").everyBranch, true);
  assert.equal(pushTargets(["--mirror"], "feature").everyBranch, true);
});

test("blocks a push to the remote's default branch with a reason", (t) => {
  const cwd = repository(t);
  for (const command of ["git push origin trunk", "git push origin HEAD:trunk", "git push --force origin feature/x:trunk", "git push --all"]) {
    const result = hook(cwd, command);
    assert.equal(result.status, 2, command);
    assert.match(result.stderr, /Blocked by the workflows plugin: .*default branch/);
    assert.match(result.stderr, /guard_default_branch/);
  }
});

test("resolves git -C against the session's working directory", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "guard-push-parent-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const cwd = repository(t, "trunk");
  const name = cwd.split(/[\\/]/).pop();
  const result = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: `git -C ${name} push` }, cwd: dirname(cwd) }),
    encoding: "utf8",
    cwd: parent,
  });
  assert.equal(result.status, 2, result.stderr);
});

test("follows cd into the repository before a push", (t) => {
  const cwd = repository(t, "trunk");
  const name = cwd.split(/[\\/]/).pop();
  for (const command of [`cd ${name} && git push origin HEAD`, `cd ${cwd.replaceAll("\\", "/")}; git push`, `cd ${name} && git -C . push -u origin HEAD`]) {
    assert.equal(hook(dirname(cwd), command).status, 2, command);
  }
});

test("joins backslash-newline continuations before splitting", (t) => {
  const cwd = repository(t);
  assert.equal(hook(cwd, "git push \\\n  origin HEAD:trunk").status, 2);
  assert.equal(hook(cwd, "git push \\\r\n  origin HEAD:trunk").status, 2);
  assert.equal(hook(cwd, "echo done\\\\\ngit push origin trunk").status, 2, "an escaped backslash ends the line");
  assert.equal(hook(cwd, "git pu\\\nsh origin HEAD:trunk").status, 2, "sh deletes the pair inside a word");
  assert.equal(hook(cwd, "git push origin HEAD:tr\\\nunk").status, 2, "sh deletes the pair inside a refspec");
});

test("blocks a bare push from the default branch", (t) => {
  const cwd = repository(t, "trunk");
  assert.equal(hook(cwd, "git push").status, 2);
});

test("allows feature branch pushes, tags, and unrelated commands", (t) => {
  const cwd = repository(t);
  for (const command of ["git push -u origin feature/x", "git push", "git push origin v1.0.0 --tags", "echo git push origin trunk-notes", "ls"]) {
    assert.equal(hook(cwd, command).status, 0, command);
  }
});

test("falls back to main and master when the remote HEAD is unknown", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "guard-push-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  assert.equal(hook(cwd, "git push origin main").status, 2);
  assert.equal(hook(cwd, "git push origin master").status, 2);
  assert.equal(hook(cwd, "git push origin develop").status, 0);
});

test("the plugin option turns the guard off", (t) => {
  const cwd = repository(t);
  assert.equal(hook(cwd, "git push origin trunk", { CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT_BRANCH: "false" }).status, 0);
});

test("never blocks on its own failure", () => {
  const result = spawnSync(process.execPath, [script], { input: "not json", encoding: "utf8" });
  assert.equal(result.status, 0);
});

test("hooks.json runs the guard on Bash in exec form from the plugin root", () => {
  const config = JSON.parse(readFileSync(join(plugin, "hooks", "hooks.json"), "utf8"));
  const [entry] = config.hooks.PreToolUse;
  assert.equal(entry.matcher, "Bash");
  assert.equal(entry.hooks[0].command, "node");
  assert.deepEqual(entry.hooks[0].args, ["${CLAUDE_PLUGIN_ROOT}/hooks/guard-push.mjs"]);
  assert.equal(entry.hooks[0].onFailure, undefined, "a crashed guard must not block every Bash call");
});

test("the guard option is declared with the default on", () => {
  const manifest = JSON.parse(readFileSync(join(plugin, ".claude-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.userConfig.guard_default_branch.type, "boolean");
  assert.equal(manifest.userConfig.guard_default_branch.default, true);
});
