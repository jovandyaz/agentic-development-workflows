#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHIPPED_PREFIX = "plugins/workflows/skills/";
const PLUGIN_MANIFEST = "plugins/workflows/.claude-plugin/plugin.json";
const CHANGELOG = "plugins/workflows/CHANGELOG.md";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** Returns 1, 0, or -1 as strict semver `left` is greater than, equal to, or lower than `right`. */
export function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

/** Returns an error message when the head version cannot ship the changed files, otherwise null. */
export function checkRelease({ changedFiles, baseVersion, headVersion, changelog = "" }) {
  const order = compareVersions(headVersion, baseVersion);
  if (order < 0) return `version ${headVersion} is lower than ${baseVersion}`;
  const shipsSkills = changedFiles.some((file) => file.startsWith(SHIPPED_PREFIX));
  if (shipsSkills && order === 0) {
    return `${SHIPPED_PREFIX.slice(0, -1)} changed but version ${headVersion} is not greater than ${baseVersion}; bump the release version so installed plugins receive the change`;
  }
  if (order > 0) {
    try {
      releaseNotes(changelog, headVersion);
    } catch (error) {
      return error.message;
    }
  }
  return null;
}

/** Returns the body of the changelog entry for `version`; throws when the entry is missing. */
export function releaseNotes(changelog, version) {
  const sections = changelog.split(/^## /m);
  const entry = sections.find((section) => section.startsWith(`[${version}]`));
  if (!entry) throw new Error(`no changelog entry for ${version}`);
  return `${entry.slice(entry.indexOf("\n") + 1).trim()}\n`;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function versionOf(manifestText) {
  const version = JSON.parse(manifestText).version;
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new Error(`${PLUGIN_MANIFEST}: version must be a strict semver string`);
  }
  return version;
}

function check(baseRef) {
  if (!baseRef || baseRef.startsWith("-")) throw new Error(`invalid base ref: ${baseRef ?? ""}`);
  const changedFiles = git("diff", "--name-only", "--no-renames", `${baseRef}...HEAD`)
    .split("\n")
    .filter(Boolean);
  const error = checkRelease({
    changedFiles,
    baseVersion: versionOf(git("show", `${baseRef}:${PLUGIN_MANIFEST}`)),
    headVersion: versionOf(git("show", `HEAD:${PLUGIN_MANIFEST}`)),
    changelog: git("show", `HEAD:${CHANGELOG}`),
  });
  if (error) throw new Error(error);
  console.log("OK: release version covers the shipped changes");
}

function main([command, argument]) {
  if (command === "check") return check(argument);
  if (command === "notes") return process.stdout.write(releaseNotes(readFileSync(CHANGELOG, "utf8"), argument));
  throw new Error("usage: release.mjs check <base-ref> | notes <version>");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}
