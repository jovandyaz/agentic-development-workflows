#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = join(root, "plugins", "workflows", "skills");
const defaultOutput = join(root, "dist", ".agents", "skills");
const manifestName = ".agentic-workflows-manifest.json";
const manifestSource = "jovandyaz/agentic-development-workflows";
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class UserError extends Error {}

function fail(message) {
  throw new UserError(message);
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseArgs(args) {
  const options = {
    check: false,
    recover: false,
    source: defaultSource,
    output: defaultOutput,
    install: false,
  };

  function valueAfter(option, index) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value`);
    return value;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--recover") options.recover = true;
    else if (arg === "--source") options.source = resolve(valueAfter(arg, index++));
    else if (arg === "--output") options.output = resolve(valueAfter(arg, index++));
    else if (arg === "--install-dir") {
      options.output = resolve(valueAfter(arg, index++));
      options.install = true;
    } else if (arg === "--install-global") {
      options.output = join(homedir(), ".agents", "skills");
      options.install = true;
    } else if (arg === "--install-claude-global") {
      options.output = join(homedir(), ".claude", "skills");
      options.install = true;
    } else if (arg === "--install-repo") {
      options.output = join(resolve(valueAfter(arg, index++)), ".agents", "skills");
      options.install = true;
    } else {
      fail(`unknown argument ${arg}`);
    }
  }

  if (!existsSync(options.source)) fail(`source does not exist: ${options.source}`);
  return options;
}

function canonicalPotentialPath(path) {
  let existing = resolve(path);
  const missing = [];
  while (!existsSync(existing)) {
    missing.unshift(basename(existing));
    const parent = dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  return resolve(realpathSync(existing), ...missing);
}

function assertSeparatedPaths(source, output) {
  const canonicalSource = realpathSync(source);
  const canonicalOutput = canonicalPotentialPath(output);
  const overlaps =
    canonicalSource === canonicalOutput ||
    canonicalSource.startsWith(`${canonicalOutput}${sep}`) ||
    canonicalOutput.startsWith(`${canonicalSource}${sep}`);
  if (overlaps) fail("source and output directories must not overlap");
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) {
    fail(`${output}: output directory must not be a symlink`);
  }
}

function* walkFiles(directory) {
  if (lstatSync(directory).isSymbolicLink()) {
    fail(`${directory}: symlinks are not supported`);
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) fail(`${path}: symlinks are not supported`);
    if (entry.isDirectory()) yield* walkFiles(path);
    else yield path;
  }
}

function frontmatter(text, path) {
  const normalized = text.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) fail(`${path}: missing YAML frontmatter`);
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) fail(`${path}: unterminated YAML frontmatter`);
  return normalized.slice(4, end);
}

function collectSkills(source) {
  const skills = new Map();
  const entries = readdirSync(source, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!skillNamePattern.test(entry.name)) {
      fail(`${entry.name}: invalid skill directory name`);
    }

    const directory = join(source, entry.name);
    const skillPath = join(directory, "SKILL.md");
    if (!existsSync(skillPath)) fail(`${directory}: missing SKILL.md`);
    for (const ignored of walkFiles(directory)) void ignored;

    const metadata = frontmatter(readFileSync(skillPath, "utf8"), skillPath);
    const name = metadata.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    if (name !== entry.name) {
      fail(`${skillPath}: name "${name ?? ""}" must match its directory`);
    }
    skills.set(entry.name, directory);
  }
  if (skills.size === 0) fail(`${source}: no skills found`);
  return skills;
}

function hashDirectory(directory) {
  const hash = createHash("sha256");
  const files = Array.from(walkFiles(directory), (file) => ({
    file,
    path: relative(directory, file).split(sep).join("/"),
  })).sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  for (const { file, path } of files) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return `sha256-${hash.digest("hex")}`;
}

function manifestFor(skills) {
  return {
    source: manifestSource,
    skills: Object.fromEntries(
      Array.from(skills, ([name, directory]) => [
        name,
        { integrity: hashDirectory(directory) },
      ]),
    ),
  };
}

function manifestText(skills) {
  return `${JSON.stringify(manifestFor(skills), null, 2)}\n`;
}

function readOwnership(output) {
  const manifestPath = join(output, manifestName);
  const manifestStats = lstatOrNull(manifestPath);
  if (!manifestStats) return {};
  if (manifestStats.isSymbolicLink()) {
    fail(`${manifestPath}: ownership manifest must not be a symlink`);
  }

  let installed;
  try {
    installed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`${manifestPath}: invalid ownership manifest (${error.message})`);
  }
  if (!installed || typeof installed !== "object" || Array.isArray(installed)) {
    fail(`${manifestPath}: ownership manifest root must be an object`);
  }
  if (installed.source !== manifestSource) {
    fail(`${manifestPath}: unexpected manifest source "${installed.source ?? ""}"`);
  }
  if (!installed.skills || typeof installed.skills !== "object" || Array.isArray(installed.skills)) {
    fail(`${manifestPath}: ownership manifest must contain a skills object`);
  }

  for (const [name, entry] of Object.entries(installed.skills)) {
    if (!skillNamePattern.test(name)) {
      fail(`${manifestPath}: invalid owned skill name "${name}"`);
    }
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !/^sha256-[a-f0-9]{64}$/.test(entry.integrity ?? "")
    ) {
      fail(`${manifestPath}: invalid ownership entry for "${name}"`);
    }
    const directory = join(output, name);
    if (lstatOrNull(directory) && hashDirectory(directory) !== entry.integrity) {
      fail(`${directory}: integrity does not match ownership manifest`);
    }
  }
  return installed.skills;
}

function check(skills, output) {
  const drift = [];
  const expected = new Map();
  for (const [name, directory] of skills) {
    for (const file of walkFiles(directory)) {
      expected.set(join(name, relative(directory, file)), readFileSync(file));
    }
  }
  expected.set(manifestName, Buffer.from(manifestText(skills)));

  for (const [path, content] of expected) {
    const installed = join(output, path);
    if (!existsSync(installed)) drift.push(`${path}: missing`);
    else if (!readFileSync(installed).equals(content)) drift.push(`${path}: differs`);
  }

  if (existsSync(output)) {
    for (const file of walkFiles(output)) {
      const path = relative(output, file);
      if (!expected.has(path)) drift.push(`${path}: unexpected`);
    }
  }

  if (drift.length > 0) {
    console.error(`DRIFT: ${drift.length} difference(s)`);
    for (const item of drift) console.error(`  ${item}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${skills.size} portable skills are in sync at ${output}`);
}

function assertInstallable(skills, output, owned) {
  for (const name of skills.keys()) {
    if (lstatOrNull(join(output, name)) && !Object.hasOwn(owned, name)) {
      fail(`${join(output, name)} exists and is not owned by agentic-development-workflows`);
    }
  }
}

function writeJournal(lockPath, journal) {
  const temporary = `${lockPath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(journal, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, lockPath);
}

function createLock(lockPath) {
  const lock = openSync(lockPath, "wx");
  try {
    writeFileSync(
      lock,
      `${JSON.stringify({
        version: 1,
        source: manifestSource,
        pid: process.pid,
        createdAt: new Date().toISOString(),
        phase: "starting",
        stage: null,
        hadManifest: false,
        expected: null,
        swaps: [],
      })}\n`,
    );
  } catch (error) {
    closeSync(lock);
    rmSync(lockPath, { force: true });
    throw error;
  }
  closeSync(lock);
}

function acquireLock(lockPath) {
  try {
    createLock(lockPath);
    return;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }

  if (lstatSync(lockPath).isSymbolicLink()) {
    fail(`${lockPath}: installer lock must not be a symlink`);
  }
  let owner;
  try {
    owner = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (error) {
    fail(`${lockPath}: invalid installer lock (${error.message})`);
  }
  if (!Number.isInteger(owner?.pid) || owner.pid <= 0) {
    fail(`${lockPath}: invalid installer lock owner`);
  }
  fail(
    `${lockPath}: installation lock belongs to PID ${owner.pid}; run the same command with --recover after verifying no installer is running`,
  );
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function readJournal(lockPath) {
  if (lstatSync(lockPath).isSymbolicLink()) fail(`${lockPath}: installer lock must not be a symlink`);
  let journal;
  try {
    journal = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (error) {
    fail(`${lockPath}: invalid installer journal (${error.message})`);
  }
  if (
    journal?.version !== 1 ||
    journal.source !== manifestSource ||
    !Number.isInteger(journal.pid) ||
    !Array.isArray(journal.swaps)
  ) {
    fail(`${lockPath}: invalid installer journal schema`);
  }
  if (journal.stage && !/^\.agentic-workflows-stage-[A-Za-z0-9]+$/.test(journal.stage)) {
    fail(`${lockPath}: invalid installer staging directory`);
  }
  for (const swap of journal.swaps) {
    if (!skillNamePattern.test(swap?.name ?? "") || typeof swap.hadDestination !== "boolean") {
      fail(`${lockPath}: invalid installer swap entry`);
    }
  }
  return journal;
}

function expectedInstallationMatches(output, expected) {
  if (!expected || expected.source !== manifestSource || !expected.skills) return false;
  const manifestPath = join(output, manifestName);
  if (!existsSync(manifestPath) || lstatSync(manifestPath).isSymbolicLink()) return false;
  let current;
  try {
    current = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return false;
  }
  if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
  return Object.entries(expected.skills).every(([name, entry]) => {
    if (!skillNamePattern.test(name) || !/^sha256-[a-f0-9]{64}$/.test(entry?.integrity ?? "")) {
      return false;
    }
    const directory = join(output, name);
    return existsSync(directory) && hashDirectory(directory) === entry.integrity;
  });
}

function rollbackJournal(output, journal) {
  if (!journal.stage) return;
  const stage = join(output, journal.stage);
  const backupRoot = join(stage, "backup");
  for (const swap of [...journal.swaps].reverse()) {
    const destination = join(output, swap.name);
    const backup = join(backupRoot, swap.name);
    if (existsSync(backup)) {
      rmSync(destination, { recursive: true, force: true });
      renameSync(backup, destination);
    } else if (!swap.hadDestination) {
      rmSync(destination, { recursive: true, force: true });
    }
  }

  const manifestPath = join(output, manifestName);
  const manifestBackup = join(stage, "manifest.backup");
  if (existsSync(manifestBackup)) {
    rmSync(manifestPath, { force: true });
    renameSync(manifestBackup, manifestPath);
  } else if (!journal.hadManifest) {
    rmSync(manifestPath, { force: true });
  }
}

function recoverInstallation(output) {
  const lockPath = join(output, ".agentic-workflows-install.lock");
  if (!existsSync(lockPath)) fail(`${lockPath}: no interrupted installation to recover`);
  const journal = readJournal(lockPath);
  if (processIsRunning(journal.pid)) {
    fail(`${lockPath}: refusing recovery while PID ${journal.pid} is running`);
  }

  if (expectedInstallationMatches(output, journal.expected)) {
    console.log(`OK: finalized interrupted installation at ${output}`);
  } else {
    rollbackJournal(output, journal);
    console.log(`OK: rolled back interrupted installation at ${output}`);
  }
  if (journal.stage) rmSync(join(output, journal.stage), { recursive: true, force: true });
  unlinkSync(lockPath);
}

function install(skills, output, action) {
  mkdirSync(output, { recursive: true });
  const lockPath = join(output, ".agentic-workflows-install.lock");
  acquireLock(lockPath);

  let stage;
  const journal = readJournal(lockPath);
  let committed = false;
  try {
    const owned = readOwnership(output);
    assertInstallable(skills, output, owned);

    stage = mkdtempSync(join(output, ".agentic-workflows-stage-"));
    journal.stage = basename(stage);
    journal.hadManifest = Boolean(lstatOrNull(join(output, manifestName)));
    journal.phase = "staging";
    writeJournal(lockPath, journal);
    const stagedSkills = new Map();
    const newRoot = join(stage, "new");
    const backupRoot = join(stage, "backup");
    mkdirSync(newRoot);
    mkdirSync(backupRoot);

    for (const [name, directory] of skills) {
      const before = hashDirectory(directory);
      const staged = join(newRoot, name);
      cpSync(directory, staged, { recursive: true, errorOnExist: true });
      const after = hashDirectory(directory);
      const copied = hashDirectory(staged);
      if (before !== after || after !== copied) {
        fail(`${directory}: source changed while preparing installation`);
      }
      stagedSkills.set(name, staged);
    }
    journal.expected = manifestFor(stagedSkills);
    const stagedManifest = `${JSON.stringify(journal.expected, null, 2)}\n`;
    journal.phase = "swapping";
    writeJournal(lockPath, journal);

    const targets = new Set([...Object.keys(owned), ...skills.keys()]);
    for (const name of targets) {
      const destination = join(output, name);
      const backup = join(backupRoot, name);
      const hadDestination = Boolean(lstatOrNull(destination));
      journal.swaps.push({ name, hadDestination });
      writeJournal(lockPath, journal);
      if (hadDestination) renameSync(destination, backup);
      const staged = stagedSkills.get(name);
      if (staged) renameSync(staged, destination);
    }

    journal.phase = "swapped";
    writeJournal(lockPath, journal);
    const manifestPath = join(output, manifestName);
    const manifestBackup = join(stage, "manifest.backup");
    if (journal.hadManifest) renameSync(manifestPath, manifestBackup);
    const manifestTemp = join(stage, "manifest.pending");
    writeFileSync(manifestTemp, stagedManifest, { flag: "wx" });
    journal.phase = "committing";
    writeJournal(lockPath, journal);
    renameSync(manifestTemp, manifestPath);
    journal.phase = "committed";
    writeJournal(lockPath, journal);
    committed = true;
  } catch (error) {
    if (!committed) {
      try {
        rollbackJournal(output, journal);
      } catch (rollbackError) {
        fail(
          `${error.message}; automatic rollback failed: ${rollbackError.message}. Preserve the lock and run with --recover`,
        );
      }
    }
    if (stage) rmSync(stage, { recursive: true, force: true });
    if (existsSync(lockPath)) unlinkSync(lockPath);
    throw error;
  }

  if (stage) rmSync(stage, { recursive: true, force: true });
  if (existsSync(lockPath)) unlinkSync(lockPath);
  console.log(`OK: ${action} ${skills.size} portable skills at ${output}`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  assertSeparatedPaths(options.source, options.output);
  if (options.recover) {
    recoverInstallation(options.output);
  } else {
    const skills = collectSkills(options.source);
    if (options.check) check(skills, options.output);
    else install(skills, options.output, options.install ? "installed" : "emitted");
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
