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
