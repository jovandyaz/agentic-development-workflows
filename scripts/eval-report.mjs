#!/usr/bin/env node
// Summarize a `claude plugin eval --json` result per skill, weakest first.
// Usage: node scripts/eval-report.mjs <results.json> [evals-root]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function caseSkills(evalsRoot) {
  const skills = new Map();
  for (const skill of readdirSync(evalsRoot, { withFileTypes: true })) {
    if (!skill.isDirectory() || skill.name === "results") continue;
    for (const entry of readdirSync(join(evalsRoot, skill.name), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const owner = skills.get(entry.name);
      if (owner && owner !== skill.name) throw new Error(`case ${entry.name} appears under both ${owner} and ${skill.name}`);
      skills.set(entry.name, skill.name);
    }
  }
  return skills;
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const number = (value, digits = 2) => (value === null || value === undefined ? "n/a" : value.toFixed(digits));

export function summarize(result, skills) {
  const groups = new Map();
  for (const entry of result.cases ?? []) {
    const skill = skills.get(entry.name) ?? "(unmapped)";
    if (!groups.has(skill)) groups.set(skill, []);
    groups.get(skill).push(entry);
  }
  return [...groups].map(([skill, cases]) => {
    const deltas = cases.map((entry) => entry.aggregates?.delta).filter((value) => typeof value === "number");
    return {
      skill,
      cases: cases.length,
      score: mean(cases.map((entry) => entry.aggregates?.score).filter((value) => typeof value === "number")),
      delta: mean(deltas),
      regressed: deltas.filter((value) => value < 0).length,
      unchanged: deltas.filter((value) => value === 0).length,
      compared: deltas.length,
    };
  }).sort((a, b) => (a.delta ?? Infinity) - (b.delta ?? Infinity) || a.skill.localeCompare(b.skill));
}

export function report(result, skills) {
  const lines = ["## Eval report by skill", ""];
  if (result.partial) lines.push(`> Partial run (${result.partialReason ?? "unknown reason"}): leave it out of trends.`, "");
  const aggregates = result.aggregates ?? {};
  lines.push(
    `Suite: ${aggregates.casesPassed ?? "?"}/${aggregates.casesTotal ?? "?"} cases passed, overall score ${number(aggregates.overallScore)}, ` +
      `mean Δ ${number(aggregates.meanDelta)}, cost $${number(result.costUsd)}, Claude Code ${result.claudeVersion ?? "unknown"}.`,
    "",
    "| Skill | Cases | Score with plugin | Mean Δ | Δ < 0 | Δ = 0 | Compared |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const row of summarize(result, skills)) {
    lines.push(
      `| ${row.skill} | ${row.cases} | ${number(row.score)} | ${number(row.delta)} | ${row.regressed} | ${row.unchanged} | ${row.compared} |`,
    );
  }
  lines.push(
    "",
    "Δ is the with-plugin score minus the no-plugin score. Δ < 0: the plugin made the case worse; investigate its trigger or instructions.",
    "Δ = 0 with a full score is a regression check the baseline already passes; Δ = 0 below a full score means the skill adds nothing measurable there.",
  );
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [resultsPath, evalsRoot = join(root, "plugins", "workflows", "evals")] = process.argv.slice(2);
  if (!resultsPath || !existsSync(resultsPath)) {
    console.error("usage: node scripts/eval-report.mjs <results.json> [evals-root]");
    process.exit(1);
  }
  process.stdout.write(report(JSON.parse(readFileSync(resultsPath, "utf8")), caseSkills(evalsRoot)));
}
