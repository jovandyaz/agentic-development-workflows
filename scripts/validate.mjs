#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins", "workflows");
const skillsRoot = join(plugin, "skills");
const evalsRoot = join(plugin, "evals");
const EVAL_RESULTS_DIRECTORY = "results";
const MIN_EVAL_CASES = 3;
const expectedSkills = [
  "applying-engineering-standards",
  "assessing-code-quality",
  "capturing-lessons",
  "committing-change",
  "developing-feature",
  "fixing-bug",
  "reviewing-change",
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

function topLevelField(line) {
  return line.match(/^([A-Za-z0-9_-]+):(?:\s|$)/)?.[1] ?? null;
}

function metadataVersion(frontmatter) {
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line === "metadata:");
  if (start < 0) return null;
  for (const line of lines.slice(start + 1)) {
    if (topLevelField(line)) break;
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/^  version:\s*["']?([^"']+?)["']?\s*$/);
    if (match) return match[1];
  }
  return null;
}

function validateSkill(path, expectedVersion) {
  const text = readFileSync(path, "utf8");
  const metadata = parseFrontmatter(text, path);
  const location = relative(root, path);
  const fields = [];
  for (const line of metadata.split("\n")) {
    if (!line || /^\s/.test(line) || line.startsWith("#")) continue;
    const field = topLevelField(line);
    if (!field) {
      fail(`${location}: malformed top-level frontmatter line "${line}"`);
      continue;
    }
    fields.push(field);
  }
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
  if (expectedVersion !== null && metadataVersion(metadata) !== expectedVersion) {
    fail(`${location}: metadata version must equal ${expectedVersion}`);
  }
  if (text.split("\n").length > 500) fail(`${location}: exceeds 500 lines`);

  if (existsSync(join(dirname(path), "evals"))) {
    fail(`${location}: legacy evals directory; move cases to ${relative(root, join(evalsRoot, name))}`);
  }
}

function isDirectory(path) {
  return lstatSync(path).isDirectory();
}

function isFile(path) {
  return existsSync(path) && lstatSync(path).isFile();
}

function yamlScalar(raw) {
  const value = raw.trim();
  return value.match(/^(["'])(.*)\1$/)?.[2] ?? value;
}

function caseYamlFields(path) {
  const fields = { name: null, scaffoldScript: null };
  let section = null;
  for (const line of readFileSync(path, "utf8").replaceAll("\r\n", "\n").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const field = topLevelField(line);
    if (field) {
      section = field;
      if (field === "name") fields.name = yamlScalar(line.slice(line.indexOf(":") + 1));
      continue;
    }
    const scaffold = line.match(/^\s+scaffold_script:(.*)$/);
    if (section === "context" && scaffold) fields.scaffoldScript = yamlScalar(scaffold[1]);
  }
  return fields;
}

function validateCaseYaml(directory, location) {
  const path = join(directory, "case.yaml");
  if (!existsSync(path)) return;
  if (!isFile(path)) {
    fail(`${location}: case.yaml must be a file`);
    return;
  }
  const { name, scaffoldScript } = caseYamlFields(path);
  if (name !== null && name !== basename(directory)) {
    fail(`${location}: case.yaml name must match directory`);
  }
  if (scaffoldScript === null) return;
  const script = resolve(directory, scaffoldScript);
  const inside = relative(directory, script);
  if (
    isAbsolute(scaffoldScript) ||
    isAbsolute(inside) ||
    inside === ".." ||
    inside.startsWith(`..${sep}`)
  ) {
    fail(`${location}: scaffold_script must be a relative path inside the case directory`);
  } else if (!isFile(script)) {
    fail(`${location}: scaffold_script ${scaffoldScript} not found in the case directory`);
  }
}

function validateEvalCase(directory) {
  const location = relative(root, directory);
  if (!existsSync(join(directory, "prompt.md")) && !existsSync(join(directory, "case.yaml"))) {
    fail(`${location}: missing prompt.md or case.yaml`);
  }
  validateCaseYaml(directory, location);
  const graders = join(directory, "graders");
  if (existsSync(graders) && !isDirectory(graders)) {
    fail(`${relative(root, graders)}: graders must be a directory`);
    return;
  }
  const graderFiles = existsSync(graders)
    ? readdirSync(graders).filter((file) => file.endsWith(".md"))
    : [];
  if (graderFiles.length === 0) fail(`${location}: expected at least one grader`);
}

function validateEvalSuite(name) {
  const suite = join(evalsRoot, name);
  const location = relative(root, suite);
  if (!existsSync(suite)) {
    fail(`${location}: missing eval suite`);
    return;
  }
  if (!isDirectory(suite)) {
    fail(`${location}: eval suite must be a directory`);
    return;
  }
  const cases = [];
  for (const entry of readdirSync(suite, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) cases.push(join(suite, entry.name));
    else fail(`${relative(root, join(suite, entry.name))}: eval case must be a directory`);
  }
  if (cases.length < MIN_EVAL_CASES) {
    fail(`${location}: expected at least ${MIN_EVAL_CASES} eval cases`);
  }
  for (const directory of cases) validateEvalCase(directory);
}

const marketplace = readJson(join(root, ".claude-plugin", "marketplace.json"));
const manifest = readJson(join(plugin, ".claude-plugin", "plugin.json"));
const packageManifest = readJson(join(root, "package.json"));
const expectedVersion = packageManifest?.version;
const hasValidExpectedVersion =
  typeof expectedVersion === "string" && /^\d+\.\d+\.\d+$/.test(expectedVersion);
if (!hasValidExpectedVersion) {
  fail("package.json: version must be a non-empty strict semver string");
}
if (marketplace?.plugins?.length !== 1 || marketplace.plugins[0]?.name !== "workflows") {
  fail("marketplace must register exactly the workflows plugin");
}
if (marketplace?.plugins?.[0]?.source !== "./plugins/workflows") {
  fail("marketplace workflows source is invalid");
}
if (manifest?.name !== "workflows" || !/^\d+\.\d+\.\d+$/.test(manifest?.version ?? "")) {
  fail("plugin manifest must have name workflows and a strict semver version");
}
if (
  hasValidExpectedVersion &&
  (manifest?.version !== expectedVersion || marketplace?.metadata?.version !== expectedVersion)
) {
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
  validateSkill(
    join(skillsRoot, name, "SKILL.md"),
    hasValidExpectedVersion ? expectedVersion : null,
  );
}

if (!existsSync(evalsRoot)) {
  fail(`${relative(root, evalsRoot)}: missing eval suite directory`);
} else if (!isDirectory(evalsRoot)) {
  fail(`${relative(root, evalsRoot)}: eval suite root must be a directory`);
} else {
  for (const entry of readdirSync(evalsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === EVAL_RESULTS_DIRECTORY) continue;
    if (!expectedSkills.includes(entry.name)) {
      fail(`${relative(root, evalsRoot)}: unknown eval suite ${entry.name}`);
    }
  }
  for (const name of expectedSkills) validateEvalSuite(name);
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
