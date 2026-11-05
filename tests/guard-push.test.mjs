import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse, pushCommands, pushTargets } from "../plugins/workflows/hooks/guard-push.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins", "workflows");
const script = join(plugin, "hooks", "guard-push.mjs");
const UNRESOLVED = /Push explicitly with `git push <remote> <branch>` from the repository directory/;
const DEFAULT_BRANCH = /pushing to the default branch trunk/;
const setHead = (remote) => new RegExp(`Run \`git remote set-head ${remote} --auto\` and retry`);

const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_") && name !== "CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT_BRANCH"),
);
environment.GIT_CONFIG_GLOBAL = join(tmpdir(), "guard-push-missing", "gitconfig");
environment.GIT_CONFIG_NOSYSTEM = "1";

const slash = (path) => path.replaceAll("\\", "/");
const label = (command) => (command.length > 200 ? `${command.slice(0, 200)}...` : command);

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: environment });
  assert.equal(result.status, 0, result.stderr);
}

function repository(t, branch = "feature/x", { remoteHead = true, prefix = "guard-push-" } = {}) {
  const base = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const directory = join(base, "work");
  git(base, "init", "-q", "--bare", "-b", "trunk", "remote.git");
  git(base, "init", "-q", "-b", "trunk", "work");
  git(directory, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init");
  git(directory, "remote", "add", "origin", slash(join(base, "remote.git")));
  git(directory, "push", "-q", "-u", "origin", "trunk");
  if (remoteHead) git(directory, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
  if (branch !== "trunk") git(directory, "switch", "-q", "-c", branch);
  return directory;
}

function track(directory, branch, upstream = branch) {
  git(directory, "config", `branch.${branch}.remote`, "origin");
  git(directory, "config", `branch.${branch}.merge`, `refs/heads/${upstream}`);
}

function hook(cwd, command, env = {}) {
  return spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }),
    encoding: "utf8",
    env: { ...environment, ...env },
    timeout: 9000,
  });
}

function expectBlocked(cwd, commands, pattern) {
  for (const command of commands) {
    const result = hook(cwd, command);
    assert.equal(result.status, 2, `${label(command)}\n${result.stderr}`);
    assert.match(result.stderr, pattern, label(command));
    assert.match(result.stderr, /guard_default_branch/, label(command));
  }
}

function expectAllowed(cwd, commands) {
  for (const command of commands) {
    const result = hook(cwd, command);
    assert.equal(result.status, 0, `${label(command)}\n${result.stderr}`);
  }
}

test("tokenizes quoted shell words", () => {
  assert.deepEqual(parse(`git push origin "HEAD:main" 'x y'`)[0].words, ["git", "push", "origin", "HEAD:main", "x y"]);
  assert.deepEqual(
    parse("echo 'a\\\nb' \"c\\\nd\" e\\\nf")[0].words,
    ["echo", "a\\\nb", "cd", "ef"],
    "single quotes keep a backslash-newline",
  );
});

test("finds pushes inside compound commands and after git options", () => {
  const pushes = pushCommands("pnpm test && git -C sub -c x=y push origin main; echo done", root);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].args, ["origin", "main"]);
  assert.equal(pushes[0].directory, join(root, "sub"));
  assert.equal(pushCommands("git status && git log -1", root).length, 0);
});

test("reads refspecs and every-branch options", () => {
  assert.deepEqual(pushTargets(["origin", "+feature:refs/heads/main"]).refspecs, ["+feature:refs/heads/main"]);
  assert.equal(pushTargets(["-u", "origin"]).remote, "origin");
  assert.equal(pushTargets(["--tags", "origin"]).tags, true);
  assert.equal(pushTargets(["--all", "origin"]).everyBranch, true);
  assert.equal(pushTargets(["--mirror"]).everyBranch, true);
  assert.equal(pushTargets(["--mir"]).everyBranch, true, "git accepts an unambiguous prefix");
  assert.equal(pushTargets(["-uo", "ci.skip", "origin"]).remote, "origin", "-o takes the next word as its value");
  assert.equal(pushTargets(["-uoci.skip", "origin"]).remote, "origin");
});

test("takes --repo as the remote only without a positional repository", (t) => {
  assert.equal(pushTargets(["--repo=upstream", "origin", "main"]).remote, "origin");
  assert.equal(pushTargets(["--repo", "upstream", "origin"]).remote, "origin");
  assert.equal(pushTargets(["--repo=upstream"]).remote, "upstream");
  assert.equal(pushTargets(["--repo", "upstream", "-u"]).remote, "upstream");
  const cwd = repository(t);
  track(cwd, "feature/x");
  expectAllowed(cwd, ["git push --repo=missing origin HEAD:main", "git push --repo=origin"]);
  expectBlocked(cwd, ["git push --repo=missing"], UNRESOLVED);
});

test("blocks a push to the remote's default branch with a reason", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["git push origin trunk", "git push origin HEAD:trunk", "git push --force origin feature/x:trunk"], DEFAULT_BRANCH);
  expectBlocked(cwd, ["git push --all"], /pushing every branch includes the default branch/);
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
    env: environment,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, DEFAULT_BRANCH);
});

test("follows cd into the repository before a push, including a quoted path with spaces", (t) => {
  for (const prefix of ["guard-push-", "guard push "]) {
    const cwd = repository(t, "trunk", { prefix });
    const name = cwd.split(/[\\/]/).pop();
    expectBlocked(
      dirname(cwd),
      [`cd "${name}" && git push origin HEAD`, `cd "${slash(cwd)}"; git push`, `cd '${slash(cwd)}' && git -C . push -u origin HEAD`],
      DEFAULT_BRANCH,
    );
  }
});

test("keeps the directory when cd runs in a pipeline or in the background", (t) => {
  const cwd = repository(t, "trunk");
  expectBlocked(cwd, ["cd .. & git push origin HEAD", "cd .. | cat; git push origin HEAD"], DEFAULT_BRANCH);
  expectBlocked(cwd, ["true | cd ..; git push origin HEAD"], UNRESOLVED);
});

test("blocks a push after a cd it cannot stat", (t) => {
  const cwd = repository(t, "trunk");
  const file = slash(script);
  expectBlocked(
    cwd,
    [`cd ${file}/x; git push origin trunk`, `pushd ${file}/x; git push origin trunk`, `git -C ${file}/x push origin trunk`],
    UNRESOLVED,
  );
});

test(
  "blocks a push after a cd into a directory it cannot read",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  (t) => {
    const cwd = repository(t, "trunk");
    const locked = mkdtempSync(join(tmpdir(), "guard-push-locked-"));
    chmodSync(locked, 0);
    t.after(() => {
      chmodSync(locked, 0o700);
      rmSync(locked, { recursive: true, force: true });
    });
    expectBlocked(cwd, [`cd ${locked}/x; git push origin trunk`], UNRESOLVED);
  },
);

test("joins backslash-newline continuations before splitting", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      "git push \\\n  origin HEAD:trunk",
      "echo done\\\\\ngit push origin trunk",
      "git pu\\\nsh origin HEAD:trunk",
      "git push origin HEAD:tr\\\nunk",
      `git push origin "HEAD:tr\\\nunk"`,
    ],
    DEFAULT_BRANCH,
  );
  expectBlocked(cwd, ["git push \\\r\n  origin HEAD:trunk"], UNRESOLVED);
  expectBlocked(cwd, ["echo a \\\r\ngit push origin trunk"], DEFAULT_BRANCH);
});

test("keeps a backslash-newline in comments and quoted heredocs", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      "# push the branch \\\ngit push origin trunk",
      "cat <<'EOF' >f\nRUN a \\\nEOF\ngit push origin trunk",
      "cat <<EOF >f\nRUN a \\\nEOF\nEOF\ngit push origin trunk",
    ],
    DEFAULT_BRANCH,
  );
});

test("finds a push in a substitution inside an unquoted heredoc", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["cat <<EOF\n$(git push origin feature/x)\nEOF", "cat <<EOF\n`git push origin feature/x`\nEOF"], UNRESOLVED);
  expectAllowed(cwd, ["cat <<'EOF'\n$(git push origin feature/x)\nEOF", "cat <<EOF\n$(date)\nEOF"]);
});

test("skips escaped quotes inside ANSI-C quoting", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["echo $'it\\'s'; git push origin trunk"], DEFAULT_BRANCH);
  expectBlocked(cwd, ["git $'push' origin feature/x"], UNRESOLVED);
});

test("reads << inside (( )) as a shift, not a heredoc", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["(( x = 1 << 2 ))\ngit push origin trunk", "echo $(( 1 << 2 ))\ngit push origin trunk"], DEFAULT_BRANCH);
});

test("blocks a bare push from the default branch", (t) => {
  const cwd = repository(t, "trunk");
  expectBlocked(cwd, ["git push"], DEFAULT_BRANCH);
});

test("allows feature branch pushes, tags, and unrelated commands", (t) => {
  const cwd = repository(t);
  track(cwd, "feature/x");
  expectAllowed(cwd, ["git push -u origin feature/x", "git push", "git push origin v1.0.0 --tags", "echo git push origin trunk-notes", "ls"]);
});

test("resolves the current-branch idioms in a push", (t) => {
  const cwd = repository(t);
  track(cwd, "feature/x");
  expectAllowed(cwd, [
    "git push -u origin $(git branch --show-current)",
    `git push origin "$(git rev-parse --abbrev-ref HEAD)"`,
    `git push origin "HEAD:$(git branch --show-current)"`,
  ]);
  expectBlocked(dirname(cwd), ["git -C work push origin $(git branch --show-current)"], UNRESOLVED);
  git(cwd, "switch", "-q", "trunk");
  expectBlocked(cwd, ["git push origin $(git branch --show-current)"], DEFAULT_BRANCH);
});

test("forgets the current branch after a checkout earlier in the command", (t) => {
  const cwd = repository(t);
  track(cwd, "feature/x");
  expectBlocked(
    cwd,
    ["git checkout trunk && git merge feature/x && git push", "git switch trunk; git push origin HEAD", "git branch -m trunk && git push origin @"],
    UNRESOLVED,
  );
  expectBlocked(cwd, ["git checkout -B trunk && git push origin HEAD", "git switch -c trunk; git push origin $(git branch --show-current)"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git checkout -b feature/y && git push -u origin HEAD", "git checkout -- README.md && git push", "git switch trunk && git push origin feature/x"]);
});

test("blocks a push it cannot resolve statically", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      `bash -c "git push origin feature/x"`,
      "sh -c 'cd .. && git push origin trunk'",
      `zsh -lc "git push"`,
      `eval "git push origin trunk"`,
      "echo $(git push origin trunk)",
      "echo `git push origin trunk`",
      "git push origin $(git symbolic-ref --short HEAD)",
      `git push origin "$BRANCH"`,
      "git push ${REMOTE} feature/x",
      `git -C "$REPO" push origin feature/x`,
      "cd $REPO && git push origin feature/x",
      "cd -P . && git push origin feature/x",
      "cd missing; git push origin feature/x",
      "git -C '/r;x' push origin HEAD:trunk",
      "git push origin {feature/x,trunk}",
      "git push origin {trunk,x{y}}",
      "echo trunk | xargs git push origin",
      "env -C .. git push origin feature/x",
      "sudo -u someone git push origin feature/x",
      "GIT_DIR=../other/.git git push origin feature/x",
      "export GIT_WORK_TREE=..; git push origin feature/x",
      `echo "git push origin trunk" | bash`,
      "bash <<'EOF'\ngit push origin trunk\nEOF",
      "G=git; $G push origin trunk",
      "git $SUBCOMMAND origin trunk",
      "find . -maxdepth 0 -exec git push origin trunk \\;",
      "git submodule foreach git push origin trunk",
      "git -c remote.origin.url=../other.git push origin HEAD:main",
    ],
    UNRESOLVED,
  );
});

test("treats other shells and interpreters as hiding a push", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      `/bin/bash -c "git push origin feature/x"`,
      `fish -c "git push origin feature/x"`,
      `mksh -c "git push origin feature/x"`,
      `ash -c "git push origin feature/x"`,
      `python3 -c "import subprocess; subprocess.run(['git', 'push', 'origin', 'feature/x'])"`,
      `node -e "require('child_process').execSync('git push origin feature/x')"`,
      `perl -e 'system("git push origin feature/x")'`,
      `ruby -e 'system("git", "push", "origin", "feature/x")'`,
    ],
    UNRESOLVED,
  );
  expectAllowed(cwd, [`python3 -c "print('done')"`, `node -e "console.log(1)"`]);
});

test("expands git aliases from the repository's configuration", (t) => {
  const cwd = repository(t);
  git(cwd, "config", "alias.p", "push");
  git(cwd, "config", "alias.pp", "p");
  git(cwd, "config", "alias.st", "status");
  git(cwd, "config", "alias.lg", "log --grep=push");
  git(cwd, "config", "alias.sync", "!git push origin HEAD:trunk");
  git(cwd, "config", "alias.publish", "!git p origin HEAD");
  expectBlocked(cwd, ["git p origin HEAD:trunk", "git pp origin HEAD:trunk", "git P origin HEAD:trunk"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git p origin feature/x", "git p --dry-run origin trunk", "git st", "cd $REPO && git status"]);
  expectBlocked(
    cwd,
    [
      "git lg",
      "git sync",
      "git publish",
      "cd $REPO && git p origin feature/x",
      "git -c alias.q=push q origin feature/x",
      "git config alias.q push && git q origin feature/x",
      "git subtree push --prefix=dist origin trunk",
    ],
    UNRESOLVED,
  );
});

test("treats a mention of git push as text, not a push", (t) => {
  const cwd = repository(t);
  expectAllowed(cwd, [
    `bash -c "npm test"`,
    "git log --grep=push",
    "echo git push origin trunk",
    `grep "git push" README.md`,
    `git commit -m "git push origin main"`,
    "echo 'done; git push origin trunk'",
    "git commit -F - <<'EOF'\ngit push origin trunk\nEOF",
    `git commit -m "$(cat <<'EOF'\nfix: don't git push origin trunk (ever)\nEOF\n)"`,
    "docker push registry.example.com/app:trunk",
    "git push origin feature/x # never trunk",
    "x=$(git rev-parse HEAD) && git push origin feature/x",
  ]);
});

test("allows dry runs", (t) => {
  const cwd = repository(t, "trunk");
  expectAllowed(cwd, ["git push --dry-run origin trunk", "git push -n origin HEAD:trunk", "git push --all -n", `bash -c "git push --dry-run"`]);
});

test("lets the last dry-run option win", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["git push --dry-run --no-dry-run origin HEAD:trunk", "git push -n --no-dry origin HEAD:trunk"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git push --no-dry-run --dry-run origin HEAD:trunk", "git push --dry origin HEAD:trunk"]);
});

test("reads short option bundles like git", (t) => {
  const cwd = repository(t);
  expectAllowed(cwd, [
    "git push -nu origin HEAD:trunk",
    "git push -fn origin trunk",
    "git push -uo ci.skip origin feature/x",
    "git push -uoci.skip origin feature/x",
  ]);
  expectBlocked(cwd, ["git push -fu origin HEAD:trunk", "git push -uo ci.skip origin HEAD:trunk", "git push -on origin HEAD:trunk"], DEFAULT_BRANCH);
  expectBlocked(cwd, ["git push -uz origin feature/x", "git push --frobnicate origin feature/x", "git push --d origin feature/x"], UNRESOLVED);
});

test("sees through command, env, sudo, and time prefixes", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      "command git push origin trunk",
      "env git push origin trunk",
      "sudo git push origin trunk",
      "time git push origin trunk",
      "FOO=1 git push origin trunk",
      "! git push origin trunk",
      "if true; then git push origin trunk; fi",
    ],
    DEFAULT_BRANCH,
  );
  expectAllowed(cwd, [
    "command git push origin feature/x",
    "env FOO=1 git push origin feature/x",
    "sudo git push origin feature/x",
    "/usr/bin/git push origin feature/x",
  ]);
});

test("sees through timeout, nice, noglob, /usr/bin/env, and zsh =git", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      "timeout 30 git push origin trunk",
      "nice git push origin trunk",
      "noglob git push origin trunk",
      "/usr/bin/env git push origin trunk",
      "=git push origin trunk",
    ],
    DEFAULT_BRANCH,
  );
  expectAllowed(cwd, ["timeout 30s git push origin feature/x"]);
});

test("splits commands only at unquoted separators", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      `echo "a && b"; git push origin trunk`,
      "echo ok\ngit push origin trunk",
      "git push origin feature/x & git push origin trunk",
      "true || git push origin trunk",
      "ls | git push origin trunk",
    ],
    DEFAULT_BRANCH,
  );
  expectAllowed(cwd, [
    "echo 'x; git push origin trunk' && git push origin feature/x",
    "git push origin feature/x 2>&1 | tee push.log",
    "git push origin feature/x >/dev/null 2>&1",
  ]);
  const parent = dirname(cwd);
  expectBlocked(parent, ["(cd work && git push origin HEAD:trunk)"], DEFAULT_BRANCH);
  expectAllowed(parent, ["(cd work && git push origin feature/x)", "(cd work); git -C work push origin HEAD"]);
});

test("reads @ as HEAD", (t) => {
  const cwd = repository(t);
  expectAllowed(cwd, ["git push origin @", "git push origin @:feature/y"]);
  expectBlocked(cwd, ["git push origin @:trunk"], DEFAULT_BRANCH);
  git(cwd, "switch", "-q", "trunk");
  expectBlocked(cwd, ["git push origin @"], DEFAULT_BRANCH);
});

test("resolves a push without a refspec the way git does", (t) => {
  const cwd = repository(t);
  expectBlocked(cwd, ["git push", "git push origin"], UNRESOLVED);
  git(cwd, "config", "push.default", "current");
  expectAllowed(cwd, ["git push", "git push origin"]);
  git(cwd, "config", "push.default", "upstream");
  track(cwd, "feature/x", "trunk");
  expectBlocked(cwd, ["git push", "git push origin"], DEFAULT_BRANCH);
  git(cwd, "config", "push.default", "simple");
  track(cwd, "feature/x");
  expectAllowed(cwd, ["git push", "git push origin"]);
  git(cwd, "config", "remote.pushDefault", "fork");
  expectBlocked(cwd, ["git push", "git push origin"], UNRESOLVED);
});

test("honors push.autoSetupRemote for a branch without an upstream", (t) => {
  const cwd = repository(t);
  git(cwd, "config", "push.autoSetupRemote", "true");
  expectAllowed(cwd, ["git push", "git push origin"]);
  git(cwd, "switch", "-q", "trunk");
  git(cwd, "config", "--unset", "branch.trunk.merge");
  expectBlocked(cwd, ["git push"], DEFAULT_BRANCH);
});

test("checks the remote's configured push refspecs and push mode", (t) => {
  const cwd = repository(t);
  git(cwd, "config", "remote.origin.push", "refs/heads/*:refs/heads/*");
  expectBlocked(cwd, ["git push", "git push origin"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git push origin feature/x"]);
  git(cwd, "config", "remote.origin.push", "HEAD");
  expectAllowed(cwd, ["git push origin"]);
  git(cwd, "config", "--unset", "remote.origin.push");
  git(cwd, "config", "push.default", "matching");
  expectBlocked(cwd, ["git push origin"], DEFAULT_BRANCH);
  git(cwd, "config", "push.default", "current");
  git(cwd, "config", "remote.origin.mirror", "true");
  expectBlocked(cwd, ["git push origin"], /every branch/);
});

test("maps a refspec without a destination the way git does", (t) => {
  const cwd = repository(t);
  git(cwd, "config", "remote.origin.push", "refs/heads/feature/x:refs/heads/trunk");
  expectBlocked(cwd, ["git push origin feature/x"], DEFAULT_BRANCH);
  git(cwd, "config", "--unset", "remote.origin.push");
  git(cwd, "config", "push.default", "upstream");
  track(cwd, "feature/x", "trunk");
  expectBlocked(cwd, ["git push origin feature/x"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git push origin --delete feature/x"]);
});

test("selects the repository with -C, --git-dir, and --work-tree", (t) => {
  const parent = dirname(repository(t));
  expectAllowed(parent, [
    "git -C work push origin HEAD",
    "git --git-dir=work/.git push origin HEAD",
    "git --git-dir work/.git --work-tree work push origin HEAD",
    "git --work-tree=work --git-dir=work/.git push origin HEAD",
  ]);
  expectBlocked(parent, ["git --git-dir=work/.git push origin HEAD:trunk"], DEFAULT_BRANCH);
  expectBlocked(parent, ["git push origin HEAD"], UNRESOLVED);
});

test("maps Git Bash drive paths on Windows", { skip: process.platform !== "win32" }, (t) => {
  const cwd = repository(t, "trunk");
  const drive = `/${cwd[0].toLowerCase()}${slash(cwd.slice(2))}`;
  expectBlocked(dirname(cwd), [`cd ${drive} && git push origin HEAD`, `git -C ${drive} push origin HEAD`], DEFAULT_BRANCH);
});

test("asks for git remote set-head when no remote HEAD is recorded", (t) => {
  const cwd = repository(t, "feature/x", { remoteHead: false });
  const remote = slash(join(dirname(cwd), "remote.git"));
  expectBlocked(cwd, ["git push origin HEAD:trunk", "git push origin feature/x", `git push ${remote} HEAD:main`], setHead("origin"));
  expectBlocked(cwd, [`git push ${slash(join(dirname(cwd), "other.git"))} HEAD:main`], UNRESOLVED);
  git(cwd, "remote", "set-head", "origin", "--auto");
  expectBlocked(cwd, ["git push origin HEAD:trunk"], DEFAULT_BRANCH);
  expectAllowed(cwd, ["git push origin feature/x"]);
});

test("never contacts the remote or runs commands from its configuration", (t) => {
  const cwd = repository(t, "feature/x", { remoteHead: false });
  const markers = ["upload-pack", "ssh"].map((name) => slash(join(dirname(cwd), `${name}.ran`)));
  git(cwd, "config", "remote.origin.uploadpack", `touch '${markers[0]}'; git-upload-pack`);
  git(cwd, "config", "core.sshCommand", `touch '${markers[1]}'; false`);
  git(cwd, "remote", "add", "upstream", "ssh://git.invalid/repo.git");
  expectBlocked(cwd, ["git push origin HEAD:trunk", "git push origin HEAD:main"], setHead("origin"));
  expectBlocked(cwd, ["git push upstream HEAD:main"], setHead("upstream"));
  for (const marker of markers) assert.equal(existsSync(marker), false, `${marker} ran before approval`);
});

test("maps a URL target to its configured remote", (t) => {
  const cwd = repository(t);
  const moved = slash(join(dirname(cwd), "moved.git"));
  git(cwd, "remote", "set-url", "origin", moved);
  expectAllowed(cwd, [`git push ${moved} HEAD:main`]);
  expectBlocked(cwd, [`git push ${moved} HEAD:trunk`], DEFAULT_BRANCH);
});

test("blocks when the repository or its default branch cannot be found", (t) => {
  const cwd = repository(t, "feature/x", { remoteHead: false });
  git(cwd, "remote", "set-url", "origin", slash(join(dirname(cwd), "missing.git")));
  expectBlocked(cwd, ["git push origin develop"], setHead("origin"));
  const empty = mkdtempSync(join(tmpdir(), "guard-push-"));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  expectBlocked(empty, ["git push origin main", "git push origin develop"], UNRESOLVED);
});

test("blocks wildcard, matching, and deletion refspecs that reach the default branch", (t) => {
  const cwd = repository(t);
  expectBlocked(
    cwd,
    [
      "git push origin 'refs/heads/*:refs/heads/*'",
      `git push origin "+refs/heads/*:refs/heads/*"`,
      "git push origin 'refs/heads/t*:refs/heads/t*'",
      "git push origin :",
      "git push origin +:",
      "git push origin :trunk",
      "git push origin --delete trunk",
      "git push -d origin trunk",
      "git push origin HEAD:heads/trunk",
    ],
    DEFAULT_BRANCH,
  );
  expectAllowed(cwd, [
    "git push origin 'refs/heads/feature/*:refs/heads/feature/*'",
    "git push origin 'refs/tags/*:refs/tags/*'",
    "git push origin :old",
    "git push origin --delete old",
  ]);
});

test("blocks a push it cannot finish analysing", (t) => {
  const cwd = repository(t);
  const nested = (inner) => `echo ${"$(".repeat(100000)}${inner}${")".repeat(100000)}`;
  expectBlocked(cwd, [nested("git push origin feature/x")], UNRESOLVED);
  expectAllowed(cwd, [nested("true")]);
});

test("checks brace expansion in linear time", (t) => {
  const cwd = repository(t);
  expectAllowed(cwd, [`git push origin {${"a,".repeat(200000)}`]);
});

test("the plugin option turns the guard off", (t) => {
  const cwd = repository(t);
  assert.equal(hook(cwd, "git push origin trunk", { CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT_BRANCH: "false" }).status, 0);
});

test("lets unparsable hook input through", () => {
  const result = spawnSync(process.execPath, [script], { input: "not json", encoding: "utf8", env: environment });
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
