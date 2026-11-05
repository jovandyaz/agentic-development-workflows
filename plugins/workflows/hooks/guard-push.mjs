#!/usr/bin/env node
// PreToolUse hook: exit 2 for a Bash call that may push to the remote's default branch or whose push it cannot resolve.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GIT = /(?:^=?|[\\/])git(?:\.exe)?$/i;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const GIT_ENVIRONMENT = /^GIT_(DIR|WORK_TREE|COMMON_DIR|NAMESPACE|CONFIG\w*)=/;
const MENTIONS_GIT_PUSH = /\bgit\b[\s\S]*\bpush\b/;
const CURRENT_BRANCH = /^\s*git\s+(branch\s+--show-current|rev-parse\s+--abbrev-ref\s+HEAD)\s*$/;
const REDIRECT = /&>>?|<<<|<<-?|<>|[<>]&|>>|>\||[<>]/y;
const DURATION = /^\d+(\.\d+)?[smhd]?$/;
const TRUE = /^(true|yes|on|1)$/i;
// No shell word can hold a NUL, so this marker for the current branch never collides with one.
const BRANCH = "\0branch\0";
const HIDDEN = { hidden: true };
const MAX_DEPTH = 50;
// hooks.json kills the hook at 10 s and a killed hook does not block, so resolving stops well before that.
const BUDGET_MS = 8000;
// Skipping a prefix leaves its own options in command position, where they still count as hiding a push.
const PREFIXES = new Set([
  "!", "{", "if", "then", "else", "elif", "do", "while", "until", "time",
  "command", "exec", "env", "sudo", "nohup", "nice", "noglob", "timeout",
]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ash", "ksh", "mksh", "fish"]);
const INTERPRETERS = /^(python[\d.]*|node|perl|ruby)$/;
const PRINTERS = new Set(["echo", "printf"]);
const DIRECTORY_COMMANDS = new Set(["cd", "pushd", "popd"]);
const GIT_OPTIONS_WITH_VALUE = new Set([
  "-C", "-c", "--git-dir", "--work-tree",
  "--namespace", "--config-env", "--super-prefix", "--attr-source",
]);
const CONFIG_OPTIONS = new Set(["-c", "--config-env"]);
const REPOSITORY_OPTIONS = new Set(["--git-dir", "--work-tree"]);
// Every long option of `git push -h`: git takes any unambiguous prefix, so a missing one changes what an abbreviation means.
const PUSH_OPTIONS = [
  "verbose", "quiet", "repo", "all", "branches", "mirror", "delete", "tags", "dry-run", "porcelain",
  "force", "force-with-lease", "force-if-includes", "recurse-submodules", "thin", "receive-pack", "exec",
  "set-upstream", "progress", "prune", "no-verify", "verify", "follow-tags", "signed", "atomic",
  "push-option", "ipv4", "ipv6",
];
const PUSH_OPTIONS_WITH_VALUE = new Set(["repo", "recurse-submodules", "receive-pack", "exec", "push-option"]);
const PUSH_FLAGS = "vqdnfu46";
const SELECTS_EVERY_BRANCH = new Set(["all", "branches", "mirror"]);
const FEATURE_BRANCH = "Push a feature branch and open a pull request instead";
const EVERY_BRANCH = `pushing every branch includes the default branch. ${FEATURE_BRANCH}`;
const UNRESOLVED =
  "the guard cannot resolve where this push goes, so it may update the default branch. " +
  "Push explicitly with `git push <remote> <branch>` from the repository directory";
const unknownDefault = (remote) =>
  `the guard does not know the default branch of ${remote}. Run \`git remote set-head ${remote} --auto\` and retry`;

export function parse(command, depth = 0) {
  return scan(command, 0, false, depth).commands;
}

function scan(text, start, nested, depth) {
  if (depth > MAX_DEPTH) throw new Error("the command nests too deeply to analyse");
  const commands = [];
  let words = [];
  let substitutions = [];
  let heredocs = [];
  let word = "";
  let started = false;
  let quoted = false;
  let redirect = null;
  let parens = 0;
  let arithmetic = -1;

  const append = (chars, quote = false) => {
    word += chars;
    started = true;
    quoted ||= quote;
  };
  const clear = () => {
    word = "";
    started = false;
    quoted = false;
  };
  const endWord = () => {
    if (!started) return;
    if (redirect === "<<" || redirect === "<<-") heredocs.push({ delimiter: word, tabs: redirect === "<<-", expands: !quoted });
    else if (!redirect) words.push(word);
    redirect = null;
    clear();
  };
  const endCommand = (operator) => {
    endWord();
    redirect = null;
    if (words.length > 0 || substitutions.length > 0) commands.push({ words, substitutions, operator });
    words = [];
    substitutions = [];
  };
  const substitute = (open) => {
    const inner = scan(text, open + 1, true, depth + 1);
    substitutions.push(inner.commands);
    append(CURRENT_BRANCH.test(text.slice(open + 1, inner.end)) ? BRANCH : "$()");
    return inner.end;
  };
  const backtick = (open) => {
    let close = open + 1;
    while (close < text.length && text[close] !== "`") close += text[close] === "\\" ? 2 : 1;
    substitutions.push(parse(text.slice(open + 1, close), depth + 1));
    append("`");
    return close;
  };
  const expand = (from, end, closer) => {
    let index = from;
    for (; index < end && text[index] !== closer; index += 1) {
      const next = text[index + 1] ?? "";
      if (text[index] === "\\" && next === "\n") index += 1;
      else if (text[index] === "\\" && /[$`"\\]/.test(next)) append(text[++index], true);
      else if (text[index] === "$" && next === "(") index = substitute(index + 1);
      else if (text[index] === "`") index = backtick(index);
      else append(text[index], true);
    }
    return index;
  };
  const lineEnd = (from, joins) => {
    let end = text.indexOf("\n", from);
    while (joins && end > 0 && escaped(text, end)) end = text.indexOf("\n", end + 1);
    return end < 0 ? text.length : end;
  };
  const skipHeredocs = (newline) => {
    let end = newline;
    for (const { delimiter, tabs, expands } of heredocs) {
      const body = end + 1;
      let line = body;
      for (; line < text.length; line = end + 1) {
        end = lineEnd(line, expands);
        const content = expands ? text.slice(line, end).replaceAll("\\\n", "") : text.slice(line, end);
        if (content.replace(tabs ? /^\t+|\r$/g : /\r$/, "") === delimiter) break;
      }
      if (expands) expand(body, Math.min(line, text.length));
    }
    heredocs = [];
    clear();
    endCommand();
    return Math.min(end, text.length);
  };

  let index = start;
  for (; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "'") {
      const close = text.indexOf("'", index + 1);
      append(text.slice(index + 1, close < 0 ? text.length : close), true);
      index = close < 0 ? text.length : close;
    } else if (char === "$" && next === "'") {
      let close = index + 2;
      while (close < text.length && text[close] !== "'") close += text[close] === "\\" ? 2 : 1;
      append(text.slice(index, close), true);
      index = close;
    } else if (char === '"') {
      append("", true);
      index = expand(index + 1, text.length, '"');
    } else if (char === "\\") {
      if (next !== "\n") append(next ?? "\\", true);
      index += 1;
    } else if (char === "`") index = backtick(index);
    else if ((char === "$" || char === "<" || char === ">") && next === "(") index = substitute(index + 1);
    else if (char === "#" && !started) index = lineEnd(index, false) - 1;
    else if (arithmetic < 0 && (char === "<" || char === ">" || (char === "&" && next === ">"))) {
      if (!quoted && /^\d+$/.test(word)) clear();
      endWord();
      REDIRECT.lastIndex = index;
      redirect = REDIRECT.exec(text)[0];
      index += redirect.length - 1;
    } else if (char === "\n") {
      endCommand();
      index = skipHeredocs(index);
    } else if (char === ")" && nested && parens === 0) {
      endCommand();
      return { commands, end: index };
    } else if (char === "(" || char === ")") {
      endCommand();
      if (char === "(" && text[index - 1] === "(" && arithmetic < 0) arithmetic = parens;
      parens += char === "(" ? 1 : -1;
      if (parens <= arithmetic) arithmetic = -1;
      commands.push(char);
    } else if (char === "|" || char === "&") {
      endCommand(next === char ? undefined : char);
      if (next === "|" || next === "&") index += 1;
    } else if (char === ";") endCommand();
    else if (char === " " || char === "\t") endWord();
    else append(char);
  }
  endCommand();
  return { commands, end: index };
}

function escaped(text, index) {
  let count = 0;
  while (text[index - 1 - count] === "\\") count += 1;
  return count % 2 === 1;
}

export function pushCommands(command, cwd, run = gitRunner(Date.now() + BUDGET_MS)) {
  let builtins;
  let aliasesChanged = false;
  let head;
  const isBuiltin = (name) => (builtins ??= new Set((run(null, ["--list-cmds=builtins"]) ?? "").split(/\r?\n/))).has(name);
  const hides = (text, depth) => walk(parse(text, depth + 1), null, depth + 1).length > 0;

  const hidesPush = (program, name, args, depth) => {
    if (name === undefined || PRINTERS.has(program)) return false;
    if (program === "eval") return hides(args.join(" "), depth);
    // A shell or interpreter reading stdin runs text this parser only saw as data, so any mention of a push counts.
    const readsStdin = (operands) => operands.length === 0 && MENTIONS_GIT_PUSH.test(command);
    if (SHELLS.has(program)) {
      const operands = args.filter((arg) => !arg.startsWith("-"));
      if (args.some((arg) => /^-[a-z]*c/i.test(arg))) return operands.some((operand) => hides(operand, depth));
      return readsStdin(args.includes("-s") ? [] : operands);
    }
    if (INTERPRETERS.test(program)) {
      return args.some((arg) => /\bgit\b/.test(arg) && /\bpush\b/.test(arg)) || readsStdin(args.filter((arg) => !arg.startsWith("-")));
    }
    return mentionsGitPush(args) || (dynamic(name) && args.includes("push"));
  };

  const gitPush = (invocation, depth) => {
    const { directory, options, subcommand, args } = invocation;
    if (subcommand === "push") {
      const targets = pushTargets(args);
      return targets.dryRun && !targets.unknown && !args.some(dynamic) ? null : { ...invocation, targets, current: head };
    }
    if (subcommand === undefined) return null;
    const overrides = options.filter(([option]) => CONFIG_OPTIONS.has(option)).map(([, value]) => value);
    if (dynamic(subcommand) || mentionsGitPush(args) || definesAlias(overrides) || (subcommand === "subtree" && args.includes("push"))) {
      return HIDDEN;
    }
    if (isBuiltin(subcommand)) {
      aliasesChanged ||= subcommand === "config" && definesAlias(args);
      return null;
    }
    if (aliasesChanged || overrides.length > 0 || directory === null) return HIDDEN;
    const alias = aliasOf(readConfig(repositoryGit(run, directory, options)), subcommand);
    if (alias === undefined) return null;
    const mentionsPush = /\bpush\b/.test(alias);
    if (alias.startsWith("!")) return mentionsPush || hides(alias.slice(1), depth) ? HIDDEN : null;
    const [expansion, ...rest] = parse(alias, depth + 1);
    if (rest.length > 0 || !expansion?.words || expansion.substitutions.length > 0) return mentionsPush ? HIDDEN : null;
    const expanded = gitInvocation(directory, [...expansion.words, ...args]);
    if (mentionsPush && expanded.subcommand !== "push") return HIDDEN;
    return gitPush({ ...expanded, options: [...options, ...expanded.options] }, depth + 1);
  };

  const walk = (commands, start, depth) => {
    if (depth > MAX_DEPTH) throw new Error("the command nests too deeply to analyse");
    const pushes = [];
    const directories = [];
    let directory = start;
    let previous;
    for (const command of commands) {
      if (command === "(") directories.push(directory);
      else if (command === ")") directory = directories.length > 0 ? directories.pop() : directory;
      else {
        const branch = () => (head !== undefined ? head : directory !== null && run(directory, ["symbolic-ref", "-q", "--short", "HEAD"])) || "$()";
        const words = command.words.map((word) => (word.includes(BRANCH) ? word.replaceAll(BRANCH, branch()) : word));
        if (command.substitutions.some((nested) => walk(nested, null, depth + 1).length > 0)) pushes.push(HIDDEN);
        if (words.some((word) => GIT_ENVIRONMENT.test(word))) directory = null;
        const [name, ...args] = withoutPrefixes(words);
        const program = basename(name);
        if (DIRECTORY_COMMANDS.has(program)) {
          const subshell = command.operator === "|" || command.operator === "&";
          const unknown = previous?.operator === "|" || program === "popd" || (program === "pushd" && args.length === 0);
          if (!subshell) directory = unknown ? null : changeDirectory(directory, args);
        } else if (name !== undefined && GIT.test(name)) {
          const invocation = gitInvocation(directory, args);
          const push = gitPush(invocation, depth);
          if (push) pushes.push(push);
          const moved = headAfter(invocation);
          if (moved !== undefined) head = moved;
        } else if (hidesPush(program, name, args, depth)) pushes.push(HIDDEN);
      }
      previous = command;
    }
    return pushes;
  };

  return walk(parse(command), resolve(cwd), 0);
}

const basename = (word = "") => word.replace(/^.*[\\/]/, "");
const mentionsGitPush = (words) => words.some((word, index) => GIT.test(word) && words.includes("push", index + 1));
const definesAlias = (words) => words.some((word) => /^alias\./i.test(word ?? ""));
const expandHome = (path) => path.replace(/^~(?=$|[\\/])/, homedir());
const hostPath = (path) => (process.platform === "win32" ? path.replace(/^\/([a-z])(\/|$)/i, "$1:/") : path);
const splitOption = (arg) =>
  arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];

function dynamic(word = "") {
  const open = word.indexOf("{");
  const close = word.lastIndexOf("}");
  return /[$`]/.test(word) || (open >= 0 && close > open && /,|\.\./.test(word.slice(open, close)));
}

function withoutPrefixes(words) {
  let start = 0;
  while (start < words.length && (ASSIGNMENT.test(words[start]) || PREFIXES.has(basename(words[start])))) {
    start += basename(words[start]) === "timeout" && DURATION.test(words[start + 1] ?? "") ? 2 : 1;
  }
  return words.slice(start);
}

function headAfter({ subcommand, args }) {
  if (subcommand === "branch") return args.some((arg) => /^(-[mM]|--move)$/.test(arg)) ? null : undefined;
  if (subcommand !== "checkout" && subcommand !== "switch") return undefined;
  const created = args.findIndex((arg) => /^(-[bBcC]|--create|--force-create|--orphan)$/.test(arg));
  if (created >= 0) return args[created + 1] === undefined || dynamic(args[created + 1]) ? null : args[created + 1];
  return args.length === 0 || args.includes("--") ? undefined : null;
}

function changeDirectory(directory, [target, ...extra]) {
  if (directory === null || extra.length > 0 || target?.startsWith("-") || dynamic(target)) return null;
  const next = target === undefined ? homedir() : resolve(directory, hostPath(expandHome(target)));
  try {
    return statSync(next).isDirectory() ? next : null;
  } catch {
    return null;
  }
}

function gitInvocation(cwd, args) {
  let directory = cwd;
  const options = [];
  let index = 0;
  for (; index < args.length && args[index].startsWith("-"); index += 1) {
    const [name, attached] = splitOption(args[index]);
    const value = attached ?? (GIT_OPTIONS_WITH_VALUE.has(name) ? args[++index] : undefined);
    if (name !== "-C") options.push([name, value]);
    else if (directory !== null) directory = value === undefined || dynamic(value) ? null : resolve(directory, hostPath(expandHome(value)));
  }
  return { directory, options, subcommand: args[index], args: args.slice(index + 1) };
}

function longOption(name) {
  if (PUSH_OPTIONS.includes(name)) return { name, negated: false };
  if (name.startsWith("no-") && PUSH_OPTIONS.includes(name.slice(3))) return { name: name.slice(3), negated: true };
  const matches = [
    ...PUSH_OPTIONS.filter((option) => option.startsWith(name)).map((option) => ({ name: option, negated: false })),
    ...PUSH_OPTIONS.filter((option) => `no-${option}`.startsWith(name)).map((option) => ({ name: option, negated: true })),
  ];
  return matches.length === 1 ? matches[0] : null;
}

export function pushTargets(args) {
  const positional = [];
  const targets = { everyBranch: false, tags: false, dryRun: false, deletes: false, unknown: false };
  let repo;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--" || arg === "--end-of-options") {
      positional.push(...args.slice(index + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const [name, attached] = splitOption(arg);
      const option = longOption(name.slice(2));
      if (option === null) targets.unknown = true;
      else if (SELECTS_EVERY_BRANCH.has(option.name)) targets.everyBranch ||= !option.negated;
      else if (option.name === "dry-run") targets.dryRun = !option.negated;
      else if (option.name === "tags") targets.tags = !option.negated;
      else if (option.name === "delete") targets.deletes = !option.negated;
      else if (PUSH_OPTIONS_WITH_VALUE.has(option.name) && !option.negated) {
        const value = attached ?? args[++index];
        if (option.name === "repo") repo = value;
      }
    } else if (arg.length > 1 && arg.startsWith("-")) {
      for (const [at, flag] of [...arg.slice(1)].entries()) {
        if (flag === "o") {
          if (at === arg.length - 2) index += 1;
          break;
        }
        if (flag === "n") targets.dryRun = true;
        else if (flag === "d") targets.deletes = true;
        else if (!PUSH_FLAGS.includes(flag)) targets.unknown = true;
      }
    } else positional.push(arg);
  }
  const [remote = repo, ...refspecs] = positional;
  return { ...targets, remote, refspecs };
}

function gitRunner(deadline) {
  const results = new Map();
  return (directory, args) => {
    const key = JSON.stringify([directory, args]);
    if (!results.has(key)) results.set(key, git(directory, args, deadline));
    return results.get(key);
  };
}

function git(directory, args, deadline) {
  try {
    return execFileSync("git", directory === null ? args : ["-C", directory, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: Math.max(1, deadline - Date.now()),
    }).trim();
  } catch {
    return null;
  }
}

function repositoryGit(run, directory, options) {
  const repository = options.filter(([name]) => REPOSITORY_OPTIONS.has(name)).map(([name, value]) => `${name}=${value}`);
  return (args) => run(directory, [...repository, ...args]);
}

function readConfig(run) {
  const config = new Map();
  for (const entry of (run(["config", "-z", "--list"]) ?? "").split("\0")) {
    if (!entry) continue;
    const split = entry.indexOf("\n");
    const key = split < 0 ? entry : entry.slice(0, split);
    config.set(key, [...(config.get(key) ?? []), split < 0 ? "true" : entry.slice(split + 1)]);
  }
  return config;
}

const last = (config, key) => config.get(key)?.at(-1);
const aliasOf = (config, name) => last(config, `alias.${name}.command`) ?? last(config, `alias.${name.toLowerCase()}`);
const pushRemote = (config, branch) =>
  last(config, `branch.${branch}.pushremote`) ?? last(config, "remote.pushdefault") ?? last(config, `branch.${branch}.remote`) ?? "origin";

function configuredRemote(config, location, directory) {
  const names = new Set([...config.keys()].map((key) => key.match(/^remote\.(.+)\.[^.]+$/)?.[1]).filter(Boolean));
  if (names.has(location)) return location;
  const local = (url) => !/^[^/\\]{2,}:/.test(url);
  const same = (url) => url === location || (local(url) && local(location) && resolve(directory, url) === resolve(directory, location));
  const urls = (name) => [...(config.get(`remote.${name}.url`) ?? []), ...(config.get(`remote.${name}.pushurl`) ?? [])];
  return [...names].find((name) => urls(name).some(same)) ?? null;
}

function matches(pattern, ref) {
  const [prefix, suffix] = pattern.split("*");
  return suffix === undefined ? ref === pattern : ref.length >= prefix.length + suffix.length && ref.startsWith(prefix) && ref.endsWith(suffix);
}

function mapRefspec(refspec, config, remote) {
  const spec = refspec.replace(/^\+/, "");
  const ref = spec.startsWith("refs/") ? spec : `refs/heads/${spec.replace(/^heads\//, "")}`;
  if (/[:*]/.test(spec) || spec === "HEAD" || spec === "@" || !ref.startsWith("refs/heads/")) return refspec;
  for (const configured of config.get(`remote.${remote}.push`) ?? []) {
    const [source, target] = configured.replace(/^\+/, "").split(":");
    const [prefix, suffix = ""] = source.split("*");
    if (target && matches(source, ref)) return `${ref}:${target.replace("*", ref.slice(prefix.length, ref.length - suffix.length))}`;
  }
  const merge = config.get(`branch.${ref.slice("refs/heads/".length)}.merge`);
  return /^(upstream|tracking)$/.test(last(config, "push.default") ?? "") && merge?.length === 1 ? `${ref}:${merge[0]}` : refspec;
}

function implicitRefspecs(run, config, remote, current) {
  const configured = config.get(`remote.${remote}.push`) ?? [];
  if (configured.length > 0) return configured;
  const mode = last(config, "push.default");
  if (mode === "matching") return [":"];
  if (current === null) return null;
  const prefix = `refs/remotes/${remote}/`;
  const tracking = run(["for-each-ref", "--format=%(push)", `refs/heads/${current}`]);
  if (tracking?.startsWith(prefix)) return [`HEAD:refs/heads/${tracking.slice(prefix.length)}`];
  const autoSetup = TRUE.test(last(config, "push.autosetupremote") ?? "") && mode !== "nothing" && !config.has(`branch.${current}.merge`);
  return autoSetup && pushRemote(config, current) === remote ? [`HEAD:refs/heads/${current}`] : null;
}

function reachesBranch(refspec, current, branch) {
  const spec = refspec.replace(/^\+/, "");
  const colon = spec.lastIndexOf(":");
  const target = colon < 0 && (spec === "HEAD" || spec === "@") ? current : spec.slice(colon + 1);
  if (target === null) return null;
  if (target === "") return true;
  return [branch, `heads/${branch}`, `refs/heads/${branch}`].some((ref) => matches(target, ref));
}

function pushReason({ directory, options, args, targets, current: moved }, run) {
  if (targets.everyBranch) return EVERY_BRANCH;
  const overridden = options.some(([name, value]) => CONFIG_OPTIONS.has(name) || dynamic(value));
  if (targets.unknown || directory === null || overridden || args.some(dynamic)) return UNRESOLVED;
  const git = repositoryGit(run, directory, options);
  if (git(["rev-parse", "--git-dir"]) === null) return UNRESOLVED;
  const config = readConfig(git);
  const current = moved === undefined ? git(["symbolic-ref", "-q", "--short", "HEAD"]) : moved;
  const remote = configuredRemote(config, targets.remote ?? pushRemote(config, current), directory);
  if (remote && TRUE.test(last(config, `remote.${remote}.mirror`) ?? "")) return EVERY_BRANCH;
  if (targets.refspecs.length === 0 && targets.tags) return null;
  if (remote === null) return UNRESOLVED;
  const refspecs =
    targets.refspecs.length === 0
      ? implicitRefspecs(git, config, remote, current)
      : targets.refspecs.map((refspec) => (targets.deletes ? `:${refspec}` : mapRefspec(refspec, config, remote)));
  if (refspecs === null) return UNRESOLVED;
  const prefix = `refs/remotes/${remote}/`;
  const head = git(["symbolic-ref", "-q", `${prefix}HEAD`]);
  if (!head?.startsWith(prefix)) return unknownDefault(remote);
  const branch = head.slice(prefix.length);
  for (const refspec of refspecs) {
    const reaches = reachesBranch(refspec, current, branch);
    if (reaches === null) return UNRESOLVED;
    if (reaches) return `pushing to the default branch ${branch}. ${FEATURE_BRANCH}`;
  }
  return null;
}

export function blockedPush(command, cwd) {
  const deadline = Date.now() + BUDGET_MS;
  const run = gitRunner(deadline);
  try {
    for (const push of pushCommands(command, cwd, run)) {
      const reason = push === HIDDEN || Date.now() > deadline ? UNRESOLVED : pushReason(push, run);
      if (reason) return reason;
    }
    return null;
  } catch {
    return /push/i.test(command.replace(/[\\'"]/g, "")) ? UNRESOLVED : null;
  }
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
    `Blocked by the workflows plugin: ${reason}. ` +
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
