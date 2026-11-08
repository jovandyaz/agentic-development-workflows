import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { blockedCommit } from "../plugins/workflows/skills/committing-change/scripts/guard-commit.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "plugins", "workflows", "skills", "committing-change", "scripts", "guard-commit.mjs");
const TRAILER = "fix: x\n\nCo-authored-by: Codex <codex@openai.com>\n";

function run(input) {
  return spawnSync(process.execPath, [script], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });
}

function directory(t) {
  const path = mkdtempSync(join(tmpdir(), "guard-commit-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  mkdirSync(join(path, "repo"));
  writeFileSync(join(path, "msg.txt"), TRAILER);
  writeFileSync(join(path, "repo", "inner.txt"), TRAILER);
  writeFileSync(join(path, "clean.txt"), "fix: x\n");
  return path;
}

test("a commit that writes an attribution trailer inline is blocked", (t) => {
  const cwd = directory(t);
  for (const command of [
    "git commit -m 'fix(auth): reject non-string tokens' -m 'Co-authored-by: Codex <codex@openai.com>'",
    "git commit -m \"$(printf 'fix: x\\n\\nCO-AUTHORED-BY: Claude <noreply@anthropic.com>')\"",
    "git commit -m \"$(cat <<'EOF'\nfix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nEOF\n)\"",
    'git commit --trailer "Co-authored-by: Claude <noreply@anthropic.com>" -m "fix: x"',
    "git commit --trailer=co-authored-by=Codex -m 'fix: x'",
    "git -c user.name=x -C repo commit -m 'fix: x' -m 'Claude-Session: https://claude.ai/code/session_1'",
    "git commit -F - <<'EOF'\nfix: x\n\nCo-authored-by: Codex <codex@openai.com>\nEOF",
    "git commit --amend -m 'fix: x' -m $'Co-authored-by: A <a@x>\\nCo-authored-by: B <b@x>'",
    "git commit -m 'fix: x' -m '🤖 Generated with [Claude Code](https://claude.com/claude-code)'",
    "git commit -m 'fix: x' -m 'Assisted-by: Codex'",
    "git interpret-trailers --in-place --trailer 'Co-authored-by: Codex <c@x>' .git/COMMIT_EDITMSG",
    "GIT_EDITOR=true git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'",
    "git commit-tree HEAD^{tree} -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'",
    "bash -lc 'git commit -m \"fix: x\" -m \"Co-authored-by: Codex <c@x>\"'",
    "(git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>')",
    "{ git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'; }",
    "if true; then git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'; fi",
    "sleep 1 & git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'",
    "sudo -u me git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'",
    "timeout 10 git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'",
    "eval \"git commit -m 'fix: x' -m 'Co-authored-by: Codex <c@x>'\"",
  ]) {
    assert.ok(blockedCommit(command, cwd), command);
  }
});

test("a trailer kept in a message file is blocked wherever git reads it from", (t) => {
  const cwd = directory(t);
  writeFileSync(join(homedir(), ".guard-commit-test-msg"), TRAILER);
  t.after(() => rmSync(join(homedir(), ".guard-commit-test-msg"), { force: true }));
  for (const command of [
    "git commit -F msg.txt",
    "git commit --file=msg.txt",
    "git commit -aF msg.txt",
    "git commit -t msg.txt",
    'git commit -F "msg.txt"',
    "git -C repo commit -F inner.txt",
    "cd repo && git commit -F inner.txt",
    "git commit -F ~/.guard-commit-test-msg",
    'git commit -F "$HOME/.guard-commit-test-msg"',
    "git commit -F - < msg.txt",
    "cat msg.txt | git commit -F -",
    "printf 'fix: x\\n\\nCo-authored-by: C <c@x>\\n' | git commit -F -",
    "git -c commit.template=msg.txt commit",
    "cat > new.txt <<'EOF'\nfix: x\n\nCo-authored-by: Codex <c@x>\nEOF\ngit commit -F new.txt",
    "printf 'fix: x\\n\\nCo-authored-by: C <c@x>\\n' > new.txt && git commit -F new.txt",
    "printf 'fix: x\\n\\nCo-authored-by: C <c@x>\\n' | tee new.txt >/dev/null; git commit -F new.txt",
    "cat > clean.txt <<'EOF'\nfix: x\n\nCo-authored-by: Codex <c@x>\nEOF\ngit commit -F clean.txt",
  ]) {
    assert.ok(blockedCommit(command, cwd), command);
  }
});

test("a message file the guard cannot locate stops the commit instead of passing it", (t) => {
  const cwd = directory(t);
  assert.match(blockedCommit('git commit -F "$MSG"', cwd), /cannot read the commit message file/);
  assert.match(blockedCommit('cd "$(mktemp -d)" && git commit -F msg.txt', cwd), /cannot read the commit message file/);
  assert.match(blockedCommit("git commit -F missing.txt", cwd), /cannot read the commit message file/);
});

test("clean commits and commands that only inspect trailers are allowed", (t) => {
  const cwd = directory(t);
  for (const command of [
    "git commit -m 'fix(auth): reject non-string tokens'",
    "git commit -m 'fix: block Co-authored-by trailers in commits'",
    "git commit -F clean.txt",
    "cat > new.txt <<'EOF'\nfix: x\nEOF\ngit commit -F new.txt",
    "printf 'fix: x\\n' > new.txt && git commit -F new.txt",
    "node --test 2>&1 | tail -5 &",
    "git commit -m 'fix: x' >/dev/null 2>&1",
    "test -f ${TMPDIR}/x && git commit -m 'fix: x'",
    "git commit -s -m 'fix: x'",
    "git commit-graph write",
    "git commit -m 'fix: x' && git log -1 --format=%B | grep -ci 'co-authored-by:'",
    "git log -1 --format=%B | git interpret-trailers --parse | grep -i 'co-authored-by:'",
    "git show -s --format=%B HEAD | grep 'Co-authored-by:' || echo 'no trailer'",
    "grep -n 'Co-authored-by:' .git/hooks/commit-msg",
    "git log --format=%B | grep -c 'Co-authored-by:'",
    "git commit -m x; tail -F /dev/null",
    "cd /tmp && git status",
  ]) {
    assert.equal(blockedCommit(command, cwd), null, command);
  }
});

test("the hook exits 2 with a reason and fails open on input it cannot read", (t) => {
  const cwd = directory(t);
  const blocked = run({ tool_name: "Bash", cwd, tool_input: { command: "git commit -m x -m 'Co-authored-by: A <a@x>'" } });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /may not carry Co-authored-by/);
  assert.equal(run({ tool_name: "Bash", cwd, tool_input: { command: "git commit -m 'fix: x'" } }).status, 0);
  assert.equal(run({ tool_name: "Write", cwd, tool_input: { content: "Co-authored-by: A" } }).status, 0);
  assert.equal(run("not json").status, 0);
  assert.equal(run("null").status, 0);
});

test("the README hook snippet parses, names the shipped script, and gives a check that prints 2", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const section = readme.slice(readme.indexOf("### Commit attribution in Codex CLI"));
  const snippet = JSON.parse(section.match(/```json\n([\s\S]*?)```/)[1]);
  const [entry] = snippet.hooks.PreToolUse;
  assert.equal(entry.matcher, "Bash");
  assert.match(entry.hooks[0].command, /^node \/\S+\/committing-change\/scripts\/guard-commit\.mjs$/);
  assert.match(section, /echo \$\?/);
});
