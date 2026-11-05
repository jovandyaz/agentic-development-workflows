import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { caseSkills, report, summarize } from "../scripts/eval-report.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evalsRoot = join(root, "plugins", "workflows", "evals");

const result = {
  schemaVersion: 1,
  partial: false,
  costUsd: 12.5,
  claudeVersion: "2.1.300",
  aggregates: { overallScore: 0.9, casesPassed: 3, casesTotal: 4, meanDelta: 0.3 },
  cases: [
    { name: "commit-authorized", aggregates: { score: 1, delta: 0.5 } },
    { name: "commit-not-authorized", aggregates: { score: 1, delta: 0 } },
    { name: "review-gate", aggregates: { score: 0.8, delta: -0.1 } },
    { name: "single-arm-case", aggregates: { score: 1 } },
  ],
};

test("maps every case directory to its skill", () => {
  const skills = caseSkills(evalsRoot);
  assert.equal(skills.get("commit-authorized"), "committing-change");
  assert.equal(skills.get("review-readonly-agents"), "reviewing-change");
});

test("rejects a case name used under two skills, which would misattribute its delta", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "eval-report-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "fixing-bug", "unattended-run"), { recursive: true });
  mkdirSync(join(directory, "shipping-change", "unattended-run"), { recursive: true });
  assert.throws(() => caseSkills(directory), /case unattended-run appears under both fixing-bug and shipping-change/);
});

test("groups cases by skill, weakest mean delta first, separating regressions from no difference", () => {
  const rows = summarize(result, caseSkills(evalsRoot));
  assert.deepEqual(rows.map((row) => row.skill), ["reviewing-change", "committing-change", "(unmapped)"]);
  const committing = rows.find((row) => row.skill === "committing-change");
  assert.equal(committing.delta, 0.25);
  assert.equal(committing.regressed, 0);
  assert.equal(committing.unchanged, 1);
  assert.equal(committing.compared, 2);
  assert.equal(rows.find((row) => row.skill === "reviewing-change").regressed, 1);
  assert.equal(rows.find((row) => row.skill === "(unmapped)").delta, null);
});

test("renders a markdown table and flags partial runs", () => {
  const text = report({ ...result, partial: true, partialReason: "cost_ceiling" }, caseSkills(evalsRoot));
  assert.match(text, /Partial run \(cost_ceiling\)/);
  assert.match(text, /\| reviewing-change \| 1 \| 0\.80 \| -0\.10 \| 1 \| 0 \| 1 \|/);
  assert.match(text, /\| committing-change \| 2 \| 1\.00 \| 0\.25 \| 0 \| 1 \| 2 \|/);
  assert.doesNotMatch(text, /remove it/, "a guard case at the ceiling (delta 0) is a regression check, not dead weight");
  assert.match(text, /Δ < 0: the plugin made the case worse/);
  assert.match(text, /cost \$12\.50, Claude Code 2\.1\.300/);
});

test("the command line prints the report for a results file", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "eval-report-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "results.json");
  writeFileSync(path, JSON.stringify(result));
  const run = spawnSync(process.execPath, [join(root, "scripts", "eval-report.mjs"), path, evalsRoot], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, report(result, caseSkills(evalsRoot)));
});
