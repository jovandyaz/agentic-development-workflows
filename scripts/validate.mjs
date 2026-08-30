#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins", "workflows");
const skillsRoot = join(plugin, "skills");
const expectedSkills = [
  "applying-engineering-standards",
  "code-quality",
  "committing-change",
  "developing-feature",
  "fixing-bug",
  "reviewing-pr",
  "shipping-change",
  "verifying-change",
];
const allowedFields = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
]);
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(root, path)}: invalid JSON (${error.message})`);
    return null;
  }
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) {
      fail(`${relative(root, path)}: symlinks are not portable`);
      continue;
    }
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

function parseFrontmatter(text, path) {
  const normalized = text.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    fail(`${relative(root, path)}: missing YAML frontmatter`);
    return "";
  }
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) {
    fail(`${relative(root, path)}: unterminated YAML frontmatter`);
    return "";
  }
  return normalized.slice(4, end);
}

function metadataVersion(frontmatter) {
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line === "metadata:");
  if (start < 0) return null;
  for (const line of lines.slice(start + 1)) {
    if (/^[a-z]/.test(line)) break;
    const match = line.match(/^  version:\s*["']?([^"']+?)["']?\s*$/);
    if (match) return match[1];
  }
  return null;
}

function validateSkill(path, expectedVersion) {
  const text = readFileSync(path, "utf8");
  const metadata = parseFrontmatter(text, path);
  const location = relative(root, path);
  const fields = Array.from(metadata.matchAll(/^([a-z][a-z0-9-]*):/gm), (match) =>
    match[1],
  );
  for (const field of fields) {
    if (!allowedFields.has(field)) fail(`${location}: unsupported field ${field}`);
  }

  const name = metadata.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = metadata.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (name !== basename(dirname(path))) fail(`${location}: name must match directory`);
  if (!name || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    fail(`${location}: invalid skill name`);
  }
  if (!description || description.length > 1024 || !description.startsWith("Use when")) {
    fail(`${location}: description must start with "Use when" and be at most 1024 characters`);
  }
  if (metadataVersion(metadata) !== expectedVersion) {
    fail(`${location}: metadata version must equal ${expectedVersion}`);
  }
  if (text.split("\n").length > 500) fail(`${location}: exceeds 500 lines`);

  const evalPath = join(dirname(path), "evals", "evals.json");
  if (!existsSync(evalPath)) {
    fail(`${location}: missing evals/evals.json`);
    return;
  }
  const evals = readJson(evalPath);
  if (!evals) return;
  if (evals.skill !== name) fail(`${relative(root, evalPath)}: skill name mismatch`);
  if (!Array.isArray(evals.evals) || evals.evals.length < 3) {
    fail(`${relative(root, evalPath)}: expected at least three evals`);
  }
  const ids = new Set();
  for (const item of evals.evals ?? []) {
    if (!item.id || ids.has(item.id)) fail(`${relative(root, evalPath)}: invalid or duplicate id`);
    ids.add(item.id);
    if (!item.query || !Array.isArray(item.expected_behavior) || item.expected_behavior.length === 0) {
      fail(`${relative(root, evalPath)}: incomplete eval ${item.id ?? "unknown"}`);
    }
  }
}

const marketplace = readJson(join(root, ".claude-plugin", "marketplace.json"));
const manifest = readJson(join(plugin, ".claude-plugin", "plugin.json"));
const packageManifest = readJson(join(root, "package.json"));
const expectedVersion = packageManifest?.version;
if (marketplace?.plugins?.length !== 1 || marketplace.plugins[0]?.name !== "workflows") {
  fail("marketplace must register exactly the workflows plugin");
}
if (marketplace?.plugins?.[0]?.source !== "./plugins/workflows") {
  fail("marketplace workflows source is invalid");
}
if (manifest?.name !== "workflows" || !/^\d+\.\d+\.\d+$/.test(manifest?.version ?? "")) {
  fail("plugin manifest must have name workflows and a strict semver version");
}
if (manifest?.version !== expectedVersion || marketplace?.metadata?.version !== expectedVersion) {
  fail("package, marketplace, and plugin versions must match");
}
for (const field of ["description", "author", "license"]) {
  if (!manifest?.[field]) fail(`plugin manifest is missing ${field}`);
}

const actualSkills = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
  fail(`expected skills ${expectedSkills.join(", ")}; found ${actualSkills.join(", ")}`);
}
for (const name of actualSkills) {
  validateSkill(join(skillsRoot, name, "SKILL.md"), expectedVersion);
}

const lock = readJson(join(root, "dependencies.lock.json"));
for (const dependency of lock?.dependencies ?? []) {
  if (!/^[a-f0-9]{40}$/.test(dependency.revision ?? "")) {
    fail(`dependencies.lock.json: ${dependency.id} has an invalid revision`);
  }
  if (!dependency.source?.startsWith("https://github.com/")) {
    fail(`dependencies.lock.json: ${dependency.id} must use an HTTPS GitHub source`);
  }
}

for (const path of walk(plugin)) {
  const text = readFileSync(path, "utf8");
  if (/sk-ant-[A-Za-z0-9_-]{8,}/.test(text) || /ghp_[A-Za-z0-9]{20,}/.test(text)) {
    fail(`${relative(root, path)}: possible secret`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} validation problem(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("OK: marketplace, plugin, dependencies, skills, and evals are valid");
