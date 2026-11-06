import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

const FROZEN_HOOKS = {
  PreToolUse: ["Bash node guard-push.mjs"],
  PostToolUse: ["Skill|Agent|Task node guard-review.mjs"],
  Stop: ["* node guard-review.mjs"],
  UserPromptSubmit: ["* node guard-review.mjs"],
  SubagentStop: ["* node guard-review.mjs"],
};

test("hooks stay frozen unless an eval shows skill text cannot fix a failure", () => {
  const plugin = JSON.parse(readFileSync(join(root, "plugins/workflows/.claude-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.hooks, undefined, "register hooks only in hooks/hooks.json");
  const { hooks } = JSON.parse(readFileSync(join(root, "plugins/workflows/hooks/hooks.json"), "utf8"));
  const registered = Object.fromEntries(
    Object.entries(hooks).map(([event, groups]) => [
      event,
      groups.flatMap(({ matcher = "*", hooks: entries }) =>
        entries.map((hook) =>
          [matcher, hook.command ?? hook.type, ...(hook.args ?? [])].map((part) => part.split("/").pop()).join(" "),
        ),
      ),
    ]),
  );
  assert.deepEqual(registered, FROZEN_HOOKS, "a new or widened hook needs the eval evidence AGENTS.md asks for");
});

const STALE_SKILL_NAMES = [/(?<!assessing-)\bcode-quality\b/, /\breviewing-pr\b/];
const HISTORY_PATHS = ["plugins/workflows/CHANGELOG.md", "docs/superpowers/"];

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split("\0").filter(Boolean);
}

test("renamed skills leave no stale references outside history", () => {
  const stale = [];
  for (const location of trackedFiles()) {
    if (HISTORY_PATHS.some((prefix) => location.startsWith(prefix))) continue;
    const path = join(root, location);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const pattern of STALE_SKILL_NAMES) {
      if (pattern.test(text)) stale.push(`${location}: ${pattern}`);
    }
  }
  assert.deepEqual(stale, []);
});

function evalScript() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.eval;
}

function evalWorkflow() {
  return readFileSync(join(root, ".github", "workflows", "evals.yml"), "utf8");
}

function topLevelBlock(text, key) {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, index) => (line.startsWith(`${key}:`) ? [index] : []));
  assert.equal(starts.length, 1, `exactly one top-level ${key}:`);
  assert.equal(lines[starts[0]], `${key}:`, `${key}: is a block mapping`);
  const block = [];
  for (const line of lines.slice(starts[0] + 1)) {
    if (/^\S/.test(line)) break;
    if (line.trim()) block.push(line);
  }
  return block;
}

function childKeys(block) {
  return block.flatMap((line) => line.match(/^  ([\w-]+):/)?.[1] ?? []);
}

test("the eval script grants the tools that edit graders need", () => {
  const script = evalScript();
  assert.match(script, /^pnpm dlx @anthropic-ai\/claude-code@\S+ plugin eval plugins\/workflows /);
  assert.match(script, /--scaffold/);
  assert.match(script, /--allow-tools Bash Edit Write/);
});

test("the eval workflow runs only on manual dispatch with pinned inputs", () => {
  const workflow = evalWorkflow();
  assert.deepEqual(childKeys(topLevelBlock(workflow, "on")), ["workflow_dispatch"]);
  assert.equal(workflow.match(/^\s*permissions:/gm)?.length, 1);
  assert.deepEqual(topLevelBlock(workflow, "permissions"), ["  contents: read"]);
  assert.match(workflow, /CLAUDE_CODE_VERSION: 2\.1\.300/);
  assert.match(workflow, /--trust-plugin/);
  assert.match(workflow, /--max-cost-usd "\$MAX_COST_USD"/);
  const inputUses = workflow.match(/\$\{\{\s*inputs\.\w+\s*\}\}/g) ?? [];
  assert.deepEqual(inputUses, ["${{ inputs.max_cost_usd }}"]);
  assert.match(workflow, /MAX_COST_USD: \$\{\{ inputs\.max_cost_usd \}\}/);
});

test("the eval workflow rejects an out-of-range cost ceiling before installing anything", () => {
  const workflow = evalWorkflow();
  assert.match(workflow, /max_cost_usd:\n(?: {8}.+\n)*? {8}type: number\n/);
  assert.equal(workflow.match(/^ {4}steps:\n {6}- (.+)$/m)?.[1], "name: Validate cost ceiling");
  assert.match(workflow, /MAX_COST_LIMIT_USD: 50\n/);
});

function leakCheckScript() {
  const step = evalWorkflow().split("- name: Check results for leaked credentials\n")[1];
  assert.ok(step, "evals.yml has a leak check step");
  const lines = step.split("\n");
  const start = lines.indexOf("        run: |") + 1;
  const end = lines.findIndex((line, index) => index >= start && !line.startsWith("          ") && line.trim());
  return lines.slice(start, end).map((line) => line.slice(10)).join("\n");
}

test("the eval leak check runs before upload", () => {
  const workflow = evalWorkflow();
  assert.ok(
    workflow.indexOf("Check results for leaked credentials") < workflow.indexOf("Upload results"),
  );
});

test("the eval leak check removes output holding the key, its suffix, or its base64 form", {
  skip: process.platform === "win32" && "the step runs on ubuntu-latest bash",
}, (t) => {
  const key = "sk-ant-api03-EXAMPLEexampleEXAMPLEexample0123456789abcdefXYZ";
  const forms = {
    raw: key,
    suffix: `split ${key.slice(0, 20)} | ${key.slice(-24)}`,
    base64: Buffer.from(`${key}\n`).toString("base64"),
    clean: "no credential here",
  };
  for (const [name, content] of Object.entries(forms)) {
    const directory = mkdtempSync(join(tmpdir(), "eval-leak-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    mkdirSync(join(directory, "eval-output"));
    writeFileSync(join(directory, "eval-output", "transcript.jsonl"), content);
    const result = spawnSync("bash", ["-e", "-c", leakCheckScript()], {
      cwd: directory,
      env: { ...process.env, ANTHROPIC_API_KEY: key },
      encoding: "utf8",
    });
    const leaked = name !== "clean";
    assert.equal(result.status, leaked ? 1 : 0, `${name}: ${result.stderr}`);
    assert.equal(existsSync(join(directory, "eval-output")), !leaked, name);
  }
});

function validateWorkflow() {
  return readFileSync(join(root, ".github", "workflows", "validate.yml"), "utf8");
}

function runScripts(text) {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const run = line.match(/^(\s+)(?:- )?run:(.*)$/);
    if (!run) return [];
    const indent = run[1].length;
    const body = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() && next.search(/\S/) <= indent) break;
      body.push(next);
    }
    return [[run[2], ...body].join("\n")];
  });
}

function workflowJob(text, name) {
  const lines = text.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  assert.ok(start > 0, `validate.yml has a ${name} job`);
  const end = lines.findIndex((line, index) => index > start && /^  \S/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

test("pull requests must bump the version before shipped skills change", () => {
  const plugin = workflowJob(validateWorkflow(), "plugin");
  assert.match(plugin, /fetch-depth: 0/);
  const step = plugin.split("- name: Require a version bump for shipped skill changes\n")[1]?.split("\n\n")[0] ?? "";
  assert.match(step, /if: github\.event_name == 'pull_request'/);
  assert.match(step, /BASE_REF: \$\{\{ github\.base_ref \}\}/);
  assert.match(step, /run: node scripts\/release\.mjs check "origin\/\$BASE_REF"/);
});

test("releases publish only from main, after validation, with the only write permission", () => {
  const workflow = validateWorkflow();
  const release = workflowJob(workflow, "release");
  assert.match(release, /needs: \[portable, plugin\]/);
  assert.match(release, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(release, /permissions:\n {6}contents: write/);
  assert.equal(workflow.match(/contents: write/g)?.length, 1);
  assert.match(release, /node scripts\/release\.mjs notes "\$version"/);
  assert.match(release, /gh release view "v\$version"/);
  for (const script of runScripts(workflow)) {
    assert.doesNotMatch(script, /\$\{\{/, `no expression interpolation in run: ${script.trim()}`);
  }
});

test("main pushes never cancel an in-progress release", () => {
  assert.match(validateWorkflow(), /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});

test("validation, eval workflows, the eval script, and the lock use the same Claude Code version", () => {
  const lock = JSON.parse(readFileSync(join(root, "dependencies.lock.json"), "utf8"));
  const locked = lock.tooling.find((entry) => entry.id === "claude-code")?.version;
  const evalVersion = evalWorkflow().match(/CLAUDE_CODE_VERSION: (\S+)/)?.[1];
  const scriptVersion = evalScript().match(/@anthropic-ai\/claude-code@(\S+)/)?.[1];
  const validate = readFileSync(join(root, ".github", "workflows", "validate.yml"), "utf8");
  const validateVersions = [...validate.matchAll(/@anthropic-ai\/claude-code@(\S+)/g)].map(
    (match) => match[1],
  );
  assert.ok(locked, "lock has a claude-code tooling version");
  assert.ok(evalVersion, "evals.yml pins CLAUDE_CODE_VERSION");
  assert.ok(scriptVersion, "package.json eval script pins claude-code");
  assert.ok(validateVersions.length > 0, "validate.yml pins claude-code");
  assert.deepEqual(
    new Set([locked, evalVersion, scriptVersion, ...validateVersions]),
    new Set([locked]),
  );
});

test("agent instructions point eval cases at the native suite", () => {
  assert.match(agentsInstructions(), /plugins\/workflows\/evals\/<skill>\//);
});

test("the eval workflow summarizes results by skill after the leak check and before upload", () => {
  const workflow = readFileSync(join(root, ".github", "workflows", "evals.yml"), "utf8");
  const leak = workflow.indexOf("name: Check results for leaked credentials");
  const summary = workflow.indexOf("name: Summarize results by skill");
  const upload = workflow.indexOf("name: Upload results");
  assert.ok(leak >= 0 && leak < summary && summary < upload);
  assert.match(workflow, /node scripts\/eval-report\.mjs eval-output\/results\.json >> "\$GITHUB_STEP_SUMMARY"/);
});

test("the plugin ships no MCP server, so Playwright stays a conditional dependency", () => {
  assert.equal(existsSync(join(root, "plugins", "workflows", ".mcp.json")), false);
  const manifest = JSON.parse(readFileSync(join(root, "plugins", "workflows", ".claude-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.mcpServers, undefined);
});

function ciFixJobs(template) {
  const [fixJob, rest = ""] = template.split(/^  verify:$/m);
  const [verifyJob, publishJob] = rest.split(/^  publish:$/m);
  return { fixJob, verifyJob, publishJob };
}

test("the CI fixer template keeps secrets from forks, caps the run, and never lets the agent push", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  assert.doesNotMatch(template, /pull_request_target/);
  assert.match(template, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(template, /--permission-mode dontAsk/);
  assert.match(template, /--max-turns \d+/);
  assert.match(template, /--max-budget-usd \d+/);
  const allowed = template.match(/--allowedTools "([^"]+)"/)?.[1] ?? "";
  assert.doesNotMatch(allowed, /git|gh /, "the workflow, not the agent, commits and pushes");
  assert.match(template, /--remove-label agent:fix-ci/);
});

test("the CI fixer's agent job holds no write credentials and hands over every edit", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  assert.match(template, /^permissions: \{\}$/m);
  const { fixJob, verifyJob, publishJob } = ciFixJobs(template);
  assert.ok(publishJob, "a separate job publishes the agent's edits");
  assert.doesNotMatch(fixJob, /: write/, "tests the agent edits run with this job's token");
  assert.match(fixJob, /persist-credentials: false/);
  const agentStep = fixJob.slice(fixJob.indexOf("name: Let Claude fix"), fixJob.indexOf("name: Package"));
  assert.doesNotMatch(agentStep, /GH_TOKEN|github\.token/);
  assert.match(fixJob, /git add -A -- \. ':!\.ci-fix-agent' ':!\.github'/, "new files are part of the fix; CI config is not");
  assert.doesNotMatch(template, /git diff --quiet/, "git diff --quiet ignores new files");
  const apply = publishJob.indexOf('git apply --index "$patch"');
  const check = publishJob.indexOf("git diff --cached --name-only --no-renames -z HEAD");
  assert.ok(apply >= 0 && apply < check, "the artifact is untrusted: check the paths it actually staged");
  assert.ok(check < publishJob.indexOf("git commit"), "the check runs before the commit");
  const pushStep = publishJob.slice(publishJob.indexOf("name: Commit and push"), publishJob.indexOf("run:", publishJob.indexOf("name: Commit and push")));
  assert.match(pushStep, /if: needs\.fix\.result == 'success'/, "a failed agent run pushes nothing");
  assert.match(publishJob, /if: vars\.CI_FIX_APP_CLIENT_ID != ''/, "the GitHub App token is optional");
  assert.match(publishJob, /token: \$\{\{ steps\.app\.outputs\.token \|\| github\.token \}\}/);
});

test("the CI fixer gates forks on the agent job and refuses CI config and lockfile edits before committing", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  const { fixJob, verifyJob, publishJob } = ciFixJobs(template);
  const fixIf = fixJob.match(/^ {4}if: >-\n((?: {6}.*\n)+)/m)?.[1] ?? "";
  assert.match(fixIf, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/, "the fork gate guards the job that holds the API key");
  const pushStep = publishJob.slice(publishJob.indexOf("name: Commit and push"), publishJob.indexOf("name: Report"));
  const refusal = pushStep.match(/grep -qE '([^']+)'; then\n\s+echo .*refusing to push it\." >&2; exit 1/);
  assert.ok(refusal, "a protected path in the patch fails the job");
  for (const path of [".github/workflows/ci.yml", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "sub/Cargo.lock"]) {
    assert.match(path, new RegExp(refusal[1]), path);
  }
  assert.doesNotMatch("src/lock.js", new RegExp(refusal[1]));
  assert.ok(pushStep.indexOf("exit 1") < pushStep.indexOf("git commit"));
});

test("the CI fixer repairs the commit that failed and publishes only onto that commit", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  const { fixJob, verifyJob, publishJob } = ciFixJobs(template);
  const headSha = "ref: ${{ github.event.pull_request.head.sha }}";
  assert.ok(fixJob.includes(headSha) && publishJob.includes(headSha), "a push made after the label leaves the agent's patch unpublished");
  assert.match(fixJob, /gh run list --commit "\$HEAD_SHA" --status failure/);
  assert.match(fixJob, /select\(\.workflowName != "ci-fix-agent"\)/, "a failed earlier round is not the check to fix");
  assert.match(publishJob, /git push --force-with-lease="refs\/heads\/\$BRANCH:\$HEAD_SHA" origin "HEAD:refs\/heads\/\$BRANCH"/, "a branch reset to an ancestor would still accept a fast-forward");
  assert.doesNotMatch(publishJob, /--force(?!-with-lease="refs\/heads\/\$BRANCH:\$HEAD_SHA")/);
});

test("the CI fixer keeps its scratch files out of the patch and publishes nothing from a capped run", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  const { fixJob, verifyJob, publishJob } = ciFixJobs(template);
  assert.match(fixJob, /git add -A -- \. ':!\.ci-fix-agent' ':!\.github'/);
  assert.doesNotMatch(fixJob, /> (?:ci-failure|claude-result|report)\./, "scratch files live under .ci-fix-agent/, never over tracked files");
  assert.match(fixJob, /jq -e '\.subtype == "success"' \.ci-fix-agent\/claude-result\.json/, "error_max_turns and budget stops fail the job");
  const report = publishJob.slice(publishJob.indexOf("name: Report"));
  assert.ok(report.indexOf("--remove-label") < report.indexOf("gh pr comment"), "a failed comment still frees the label");
});

test("the CI fixer never runs the pull request's code in the job that holds the API key", () => {
  const template = readFileSync(join(root, "docs", "templates", "ci-fix-agent.yml"), "utf8");
  const { fixJob, verifyJob, publishJob } = ciFixJobs(template);
  assert.ok(verifyJob && publishJob, "a verify job sits between the agent and the push");
  assert.doesNotMatch(fixJob.replace(/npm install --prefix "\$RUNNER_TEMP\/claude" [^\n]+/, ""), /\b(?:npm|npx|pnpm|yarn|pytest)\b|^\s+make\b/m, "installing or testing the checkout runs its code");
  assert.ok(fixJob.indexOf("Install Claude Code") < fixJob.indexOf("actions/checkout"), "the checkout's .npmrc cannot redirect the Claude install");
  const agentStep = fixJob.slice(fixJob.indexOf("name: Let Claude fix"), fixJob.indexOf("name: Package"));
  assert.match(agentStep, /--bare --setting-sources user -p/, "nothing from the checkout loads, including its settings env block");
  assert.doesNotMatch(agentStep, /--plugin-dir|--add-dir/);
  assert.match(agentStep, /--allowedTools "Read\(\.\/\*\*\)" "Edit\(\.\/\*\*\)" "Write\(\.\/\*\*\)" \\/, "file tools stay inside the checkout, away from /proc/self/environ");
  assert.match(agentStep, /--disallowedTools "Bash" "WebFetch" "WebSearch" \\/);
  const leak = agentStep.indexOf('grep -rqF --exclude-dir=.git -- "$ANTHROPIC_API_KEY" .');
  assert.ok(leak > agentStep.indexOf("claude-result.json") && leak < agentStep.indexOf("jq -e"), "a copied key is caught while the key is still in the environment");
  assert.match(agentStep, /\[ -n "\$ANTHROPIC_API_KEY" \] &&/, "an empty key would match every file");
  assert.match(fixJob, /rm -rf \.ci-fix-agent && mkdir \.ci-fix-agent/, "a committed symlink cannot redirect the scratch files");
  assert.match(fixJob, /include-hidden-files: true/, "upload-artifact skips dot-directories by default");
  assert.doesNotMatch(verifyJob, /secrets\.|GH_TOKEN|github\.token|: write/, "the job that runs the code holds no credentials");
  assert.match(verifyJob, /if: needs\.fix\.result == 'success'/);
  assert.match(verifyJob, /persist-credentials: false/);
  assert.ok(verifyJob.indexOf("git apply") < verifyJob.indexOf("npm test"), "the check runs on the agent's edits");
  assert.doesNotMatch(publishJob, /ANTHROPIC_API_KEY|\b(?:npm|npx|pnpm|yarn) /, "the job with write access runs no project code");
  assert.match(publishJob, /needs: \[fix, verify\]/);
  assert.match(publishJob, /path: \$\{\{ runner\.temp \}\}\/ci-fix-agent\//, "a .ci-fix-agent/ committed in the pull request is never read");
  const pushStep = publishJob.slice(publishJob.indexOf("name: Commit and push"), publishJob.indexOf("name: Report"));
  assert.match(pushStep, /needs\.verify\.result == 'success'/, "edits whose check failed are never pushed");
  assert.match(fixJob, /patch_sha256: \$\{\{ steps\.package\.outputs\.patch_sha256 \}\}/);
  assert.match(fixJob, /report_sha256: \$\{\{ steps\.package\.outputs\.report_sha256 \}\}/);
  assert.match(fixJob, /echo "patch_sha256=\$\(sha256sum \.ci-fix-agent\/agent\.patch/);
  assert.match(fixJob, /echo "report_sha256=\$\(sha256sum \.ci-fix-agent\/report\.md/);
  const hash = pushStep.search(/sha256sum -c --quiet \|\| \{ [^}]*exit 1; \}/);
  assert.ok(hash >= 0 && hash < pushStep.indexOf("git apply"), "only the patch the agent job produced is pushed");
  const report = publishJob.slice(publishJob.indexOf("name: Report"));
  assert.match(report, /GH_REPO: \$\{\{ github\.repository \}\}/, "the report needs no checkout");
  const reportHash = report.indexOf('echo "$REPORT_SHA256  $report" | sha256sum -c --quiet');
  assert.ok(reportHash >= 0 && reportHash < report.indexOf('cat "$report"'), "code in the verify job cannot choose the comment text");
  assert.match(report, /if ! gh pr edit "\$PR" --remove-label agent:fix-ci; then\n\s+printf .*remove it by hand/, "a label that stays on is reported");
  const symlinks = agentStep.indexOf("find . -path ./.git -prune -o -type l -print");
  assert.ok(symlinks >= 0 && symlinks < agentStep.indexOf("claude\" --bare"), "a symlink out of the checkout stops the run before Claude starts");
  assert.match(agentStep, /realpath -m -- "\$link"/);
  const discard = agentStep.slice(leak, agentStep.indexOf("jq -e"));
  for (const piece of ["git reset -q --hard && git clean -fdq -e .ci-fix-agent", "rm -rf .ci-fix-agent && mkdir .ci-fix-agent", "Rotate the key", "exit 1"]) {
    assert.ok(discard.includes(piece), `a leaked key is discarded, not packaged: ${piece}`);
  }
  for (const step of ["name: Package the agent's edits as a patch", "uses: actions/upload-artifact@v7"]) {
    assert.match(fixJob.slice(fixJob.indexOf(step), fixJob.indexOf(step) + 120), /if: always\(\)/, `${step} runs after a failed agent step`);
  }
  for (const outcome of ["nothing was pushed", "made no edits", "PUSH_OUTCOME", "Pushed."]) assert.ok(report.includes(outcome), outcome);
});

test("the agent change metrics count a whole calendar month, past gh's default limit, and every revert", () => {
  const doc = readFileSync(join(root, "docs", "measuring-agent-changes.md"), "utf8");
  const merged = doc.match(/`(gh pr list --state merged[^`]+)`/)?.[1] ?? "";
  assert.match(merged, /merged:YYYY-MM-01\.\.YYYY-MM-31/, "a month has an end");
  assert.match(merged, /--limit \d{3,}/, "gh pr list returns 30 results by default");
  const reverts = doc.match(/`(git log [^`]+--grep[^`]+)`/)?.[1] ?? "";
  assert.match(reverts, /--since=YYYY-MM-01 --until=YYYY-MM-31/, "a rolling month is not a calendar month");
  assert.match(reverts, / -i /, "git writes Revert with a capital R");
});
