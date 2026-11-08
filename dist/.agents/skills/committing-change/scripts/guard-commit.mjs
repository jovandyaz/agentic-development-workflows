#!/usr/bin/env node
// Codex ranks a user's request above skill text, so only a hook keeps attribution trailers out of commits.

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const KEYS = "co-authored-by|co-developed-by|assisted-by|generated-by|claude-session";
const TRAILER = new RegExp(`(?:${KEYS})[ \\t]*:|--trailer[\\s=]+["']?(?:${KEYS})\\b|generated with \\[?(?:claude code|codex)\\b`, "i");
// A commit the segment parser did not recognize, such as one inside a construct it does not model, is still caught here.
const RAW_COMMIT = /(?:^|[\s;&|({!`])git\s(?:[^\n;&|]*?\s)?(?:commit|commit-tree|merge|interpret-trailers)\b(?!-)/;
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const PREFIXES = new Set([
  "env", "command", "time", "nohup", "exec", "sudo", "nice", "timeout", "xargs",
  "!", "if", "then", "else", "elif", "do", "while", "until",
]);
const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);
const VALUE_FLAGS = "mFtCc";
const MAX_BYTES = 1 << 20;
const REASON =
  "a commit may not carry Co-authored-by, Claude-Session, or other agent attribution, even when the user asks for it. " +
  "Commit without the trailer and name the omitted trailer in your report; to remove one, write the cleaned message to a file and commit with -F";
const unreadable = (source) =>
  `the guard cannot read the commit message file ${source}. Write the message to a literal path before the commit and commit with -F <path>`;

const hasTrailer = (segment) => TRAILER.test(segment.text) || segment.bodies.some((body) => TRAILER.test(body));

// Heredoc bodies belong to the segment that opened them, so a trailer written through one is checked with its commit.
export function segments(script) {
  const out = [];
  let text = "";
  let bodies = [];
  let pending = [];
  let separator = null;
  let quote = null;
  let depth = 0;
  let index = 0;
  const close = (next) => {
    out.push({ text, bodies, separator });
    text = "";
    bodies = [];
    separator = next;
  };
  while (index < script.length) {
    const char = script[index];
    if (quote) {
      text += char;
      if (char === "\\" && quote === '"') {
        text += script[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      text += char;
      index += 1;
      continue;
    }
    if (char === "\\") {
      text += char + (script[index + 1] ?? "");
      index += 2;
      continue;
    }
    if (char === "(" && script[index - 1] === "$") depth += 1;
    else if (char === ")" && depth > 0) depth -= 1;
    if (depth === 0) {
      const heredoc = /^<<-?[ \t]*(['"]?)([\w.-]+)\1/.exec(script.slice(index));
      if (heredoc) {
        pending.push(heredoc[2]);
        text += heredoc[0];
        index += heredoc[0].length;
        continue;
      }
      if (char === "\n") {
        index += 1;
        for (const delimiter of pending) {
          const lines = [];
          while (index < script.length) {
            const end = script.indexOf("\n", index) === -1 ? script.length : script.indexOf("\n", index);
            const line = script.slice(index, end);
            index = end + 1;
            if (line.replace(/^\t+/, "") === delimiter) break;
            lines.push(line);
          }
          bodies.push(lines.join("\n"));
        }
        pending = [];
        close("\n");
        continue;
      }
      const operator = ["&&", "||", "|&", ";", "|", "&", "(", ")", "{", "}"].find((candidate) => script.startsWith(candidate, index));
      const standalone = /^[\s;&|()]?$/.test(script[index - 1] ?? "") && /^[\s;&|()]?$/.test(script[index + 1] ?? "");
      const redirection = operator === "&" && ("<>".includes(script[index - 1] ?? "") || script[index + 1] === ">");
      if (operator && !redirection && (!"{}".includes(operator) || standalone)) {
        close(operator);
        index += operator.length;
        continue;
      }
    }
    text += char;
    index += 1;
  }
  close(null);
  return out.filter((segment) => segment.text.trim() || segment.bodies.length);
}

const WORD = /(?:[^\s'"\\]|\\.|'[^']*'|"(?:[^"\\]|\\.)*")+/g;

export function words(text) {
  return (text.match(WORD) ?? []).map((word) =>
    word.replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"|\\(.)/g, (_, single, double, escaped) =>
      single ?? (double !== undefined ? double.replace(/\\(["\\$`])/g, "$1") : escaped),
    ),
  );
}

function expand(path) {
  const expanded = path
    .replace(/^~(?=\/|$)/, homedir())
    .replace(/\$\{?HOME\}?/g, homedir())
    .replace(/\$\{?TMPDIR\}?/g, process.env.TMPDIR ?? "/tmp");
  return /[$`]/.test(expanded) ? null : expanded;
}

function readCapped(path) {
  try {
    return statSync(path).isFile() ? readFileSync(path, "utf8").slice(0, MAX_BYTES) : "";
  } catch {
    return "";
  }
}

function program(args) {
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (/^[A-Za-z_]\w*=/.test(arg)) index += 1;
    else if (PREFIXES.has(arg)) {
      index += 1;
      while (index < args.length && /^(-\S*|\d+(\.\d+)?[smhd]?)$/.test(args[index])) index += 1;
    } else break;
  }
  return { name: basename(args[index] ?? ""), rest: args.slice(index + 1) };
}

function gitCommand(rest) {
  const directories = [];
  const templates = [];
  let index = 0;
  while (index < rest.length && rest[index].startsWith("-")) {
    const [option, attached] = rest[index].split(/=(.*)/s);
    const value = GIT_OPTIONS_WITH_VALUE.has(option) && attached === undefined ? rest[++index] : attached;
    if (option === "-C" && value !== undefined) directories.push(value);
    const template = option === "-c" && /^commit\.template=(.*)$/is.exec(value ?? "");
    if (template) templates.push(template[1]);
    index += 1;
  }
  return { subcommand: rest[index], args: rest.slice(index + 1), directories, templates };
}

function messagePaths(args) {
  const paths = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const long = /^--(file|template)(?:=(.*))?$/s.exec(arg);
    if (long) {
      paths.push(long[2] ?? args[++index]);
      continue;
    }
    if (!/^-[A-Za-z]/.test(arg)) continue;
    for (let position = 1; position < arg.length; position += 1) {
      if (!VALUE_FLAGS.includes(arg[position])) continue;
      const value = arg.slice(position + 1) || args[++index];
      if ("Ft".includes(arg[position])) paths.push(value);
      break;
    }
  }
  return paths.filter((path) => path !== undefined);
}

function writtenFiles(segment, feeders, directory) {
  if (directory === null) return [];
  const raw = segment.text.match(WORD) ?? [];
  const targets = [];
  for (const [index, word] of raw.entries()) {
    const redirect = /^\d?>>?\|?(.*)$/s.exec(word);
    const target = redirect && (redirect[1] || raw[index + 1]);
    if (target && !target.startsWith("&")) targets.push(words(target)[0]);
  }
  const { name, rest } = program(words(segment.text));
  if (name === "tee") targets.push(...rest.filter((arg) => !arg.startsWith("-")));
  const trailer = hasTrailer(segment) || feeders.some(hasTrailer);
  return targets.filter((target) => target !== undefined).map(expand).filter(Boolean).map((path) => ({ path: resolve(directory, path), trailer }));
}

function checkSegments(script, cwd) {
  const list = segments(script);
  const written = [];
  let directory = cwd;
  let recognized = false;
  for (const [position, segment] of list.entries()) {
    const feeders = [];
    for (let back = position; back > 0 && list[back].separator === "|"; back -= 1) feeders.push(list[back - 1]);
    written.push(...writtenFiles(segment, feeders, directory));
    const args = words(segment.text);
    const { name, rest } = program(args);
    if (name === "cd") {
      const target = rest[0] === undefined ? homedir() : expand(rest[0]);
      directory = target === null || directory === null ? null : resolve(directory, target);
      continue;
    }
    if (SHELLS.has(name) || name === "eval") {
      const flag = name === "eval" ? -1 : rest.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg));
      const inner = name === "eval" ? rest.join(" ") : rest[flag + 1];
      if ((name === "eval" || flag !== -1) && inner !== undefined) {
        const reason = checkSegments(inner, directory ?? cwd);
        if (reason) return reason;
        recognized ||= RAW_COMMIT.test(inner);
      }
      continue;
    }
    if (name !== "git") continue;
    recognized = true;
    const { subcommand, args: gitArgs, directories, templates } = gitCommand(rest);
    const writesTrailers = subcommand === "interpret-trailers" && gitArgs.includes("--in-place");
    if (!["commit", "commit-tree", "merge"].includes(subcommand) && !writesTrailers) continue;
    if (hasTrailer(segment)) return REASON;
    for (const raw of [...templates, ...messagePaths(gitArgs)]) {
      const sources = [];
      if (raw === "-") {
        if (feeders.some(hasTrailer)) return REASON;
        for (const feeder of feeders) {
          const feed = program(words(feeder.text));
          if (feed.name === "cat") sources.push(...feed.rest.filter((arg) => !arg.startsWith("-")));
        }
        const redirect = /(?:^|\s)0?<(?!<)\s*("[^"]+"|'[^']+'|[^\s;&|]+)/.exec(segment.text);
        if (redirect) sources.push(words(redirect[1])[0]);
      } else {
        sources.push(raw);
      }
      for (const source of sources) {
        const path = expand(source);
        if (path === null || (!isAbsolute(path) && directory === null)) return unreadable(source);
        const candidates = isAbsolute(path)
          ? [path]
          : [directory, ...directories.map((dir) => resolve(directory, expand(dir) ?? dir))].map((base) => resolve(base, path));
        const writers = written.filter((write) => candidates.includes(write.path));
        if (writers.some((write) => write.trailer)) return REASON;
        if (candidates.some((candidate) => TRAILER.test(readCapped(candidate)))) return REASON;
        if (!writers.length && !candidates.some((candidate) => existsSync(candidate))) return unreadable(source);
      }
    }
  }
  if (!recognized && RAW_COMMIT.test(script) && TRAILER.test(script)) return REASON;
  return null;
}

export function blockedCommit(command, cwd) {
  try {
    return checkSegments(command, cwd);
  } catch {
    return RAW_COMMIT.test(command) && TRAILER.test(command) ? REASON : null;
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.tool_name !== "Bash") return 0;
  const command = input.tool_input?.command;
  if (typeof command !== "string") return 0;
  const reason = blockedCommit(command, typeof input.cwd === "string" ? input.cwd : process.cwd());
  if (!reason) return 0;
  process.stderr.write(`Blocked by the committing-change guard: ${reason}.\n`);
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
