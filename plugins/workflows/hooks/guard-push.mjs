#!/usr/bin/env node
// PreToolUse hook: block a Bash call that pushes to the remote's default branch.
// Exit 2 blocks the call and returns stderr to the agent. Any internal failure
// exits 0, so a bug here never blocks unrelated work.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
const PUSH_OPTIONS_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);
const SELECTS_EVERY_BRANCH = new Set(["--all", "--branches", "--mirror"]);

export function tokenize(segment) {
  const tokens = [];
  let current = "";
  let quote = null;
  let started = false;
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && index + 1 < segment.length) current += segment[++index];
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === "\\" && index + 1 < segment.length) {
      current += segment[++index];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

export function pushCommands(command) {
  const pushes = [];
  // A `cd` changes the directory for every later segment, so later pushes resolve against it.
  const cdDirectories = [];
  // sh deletes a backslash-newline pair, even inside a word; `\\` before a newline is an escaped backslash instead.
  const joined = command.replace(/(?<!\\)((?:\\\\)*)\\\r?\n/g, "$1");
  for (const segment of joined.split(/&&|\|\||[;|\n]/)) {
    const tokens = tokenize(segment);
    if (tokens[0] === "cd" && tokens[1]) cdDirectories.push(tokens[1].replace(/^~(?=$|\/)/, homedir()));
    let index = tokens.findIndex((token) => token === "git" || token.endsWith("/git"));
    if (index < 0) continue;
    const directories = [...cdDirectories];
    index += 1;
    while (index < tokens.length && tokens[index].startsWith("-")) {
      const option = tokens[index];
      if (option === "-C") directories.push(tokens[index + 1] ?? ".");
      if (GIT_OPTIONS_WITH_VALUE.has(option)) index += 2;
      else index += 1;
    }
    if (tokens[index] === "push") pushes.push({ directories, args: tokens.slice(index + 1) });
  }
  return pushes;
}

export function pushTargets(args, currentBranch) {
  const positional = [];
  let everyBranch = false;
  let tagsOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      positional.push(...args.slice(index + 1));
      break;
    }
    if (SELECTS_EVERY_BRANCH.has(arg)) everyBranch = true;
    else if (arg === "--tags") tagsOnly = true;
    else if (PUSH_OPTIONS_WITH_VALUE.has(arg)) index += 1;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const [remote = null, ...refspecs] = positional;
  if (everyBranch) return { remote, everyBranch: true, branches: [] };
  if (refspecs.length === 0) return { remote, everyBranch: false, branches: tagsOnly ? [] : [currentBranch] };
  const branches = refspecs.map((refspec) => {
    const spec = refspec.replace(/^\+/, "");
    const destination = spec.includes(":") ? spec.slice(spec.indexOf(":") + 1) : spec;
    const name = destination === "HEAD" || destination === "" ? currentBranch : destination;
    return name?.replace(/^refs\/heads\//, "") ?? null;
  });
  return { remote, everyBranch: false, branches };
}

function git(directory, args) {
  try {
    return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function defaultBranches(directory, remote) {
  const head = git(directory, ["symbolic-ref", "--short", `refs/remotes/${remote ?? "origin"}/HEAD`]);
  if (head?.includes("/")) return [head.slice(head.indexOf("/") + 1)];
  return ["main", "master"];
}

export function blockedPush(command, cwd) {
  for (const push of pushCommands(command)) {
    const directory = resolve(cwd, ...push.directories);
    const current = git(directory, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const targets = pushTargets(push.args, current);
    const protectedBranches = defaultBranches(directory, targets.remote);
    if (targets.everyBranch) return `pushing every branch includes the default branch (${protectedBranches.join(", ")})`;
    const hit = targets.branches.find((branch) => branch && protectedBranches.includes(branch));
    if (hit) return `pushing to the default branch ${hit}`;
  }
  return null;
}

function main() {
  const option = process.env.CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT_BRANCH;
  if (option === "false" || option === "0") return 0;
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.tool_name !== "Bash") return 0;
  const command = input.tool_input?.command;
  if (typeof command !== "string") return 0;
  const reason = blockedPush(command, input.cwd ?? process.cwd());
  if (!reason) return 0;
  process.stderr.write(
    `Blocked by the workflows plugin: ${reason}. Push a feature branch and open a pull request instead. ` +
      "A person can turn this guard off with the plugin's guard_default_branch option.\n",
  );
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let code = 0;
  try {
    code = main();
  } catch {
    code = 0;
  }
  process.exit(code);
}
