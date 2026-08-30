---
name: verifying-change
description: Use when implementation or review is complete, before claiming success, committing, opening a pull request, merging, or releasing a change.
license: MIT
metadata:
  author: jovandyaz
  version: "0.1.0"
---

# Verifying A Change

Evidence must be fresh, complete, and matched to each claim.

## Dependency Gate

Resolve Superpowers before acting. If unavailable, stop with the matching
instruction at https://github.com/obra/superpowers#installation. Claude Code
uses `/plugin install superpowers@claude-plugins-official`.

For any user-visible web path, Playwright MCP is required. If unavailable, stop
and print the client setup from https://github.com/microsoft/playwright-mcp.
Claude Code: `claude mcp add playwright npx @playwright/mcp@0.0.79`.
Codex: `codex mcp add playwright npx "@playwright/mcp@0.0.79"`.
Other MCP clients use command `npx` with argument `@playwright/mcp@0.0.79`.

## Verification Matrix

Map every acceptance criterion and changed risk to direct evidence before
running commands.

| Surface | Required evidence |
| --- | --- |
| UI | Playwright MCP interaction on desktop and mobile, accessibility snapshot, screenshot, console errors, and failed network requests |
| HTTP/API | Representative success and failure requests using `curl --fail-with-body`, plus response status and body assertions |
| Library/CLI | Direct invocation covering the changed behavior and error path |
| All code | Focused tests, broader affected tests, typecheck/lint where relevant, and a real build when buildability is claimed |

Use the repository's documented commands and package manager. Do not treat lint,
typecheck, targeted tests, or a previous run as proof of another claim.

## Gate

1. Use `verification-before-completion` to identify and run each full command.
2. Read complete output, exit status, failure count, browser console, and network
   failures. Reproduce the original bug or acceptance path directly.
3. Inspect version-control status and diff for accidental files or scope creep.
4. Record each command or browser action, result, and what claim it proves.

If any check fails:

1. Use systematic-debugging to prove the cause.
2. Make the smallest test-backed fix.
3. Run reviewing-pr on the resulting diff and resolve confirmed blockers.
4. Run verifying-change again from the full matrix; do not resume from the
   failed check or reuse stale evidence.

Report passed, failed, and not-run checks separately. Never soften a failure
into a success claim.
