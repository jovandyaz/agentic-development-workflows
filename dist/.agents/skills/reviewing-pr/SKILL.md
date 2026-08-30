---
name: reviewing-pr
description: Use when reviewing a pull request, branch, commit range, staged changes, or completed implementation before merge or release.
license: MIT
metadata:
  author: jovandyaz
  version: "0.1.0"
---

# Reviewing A Pull Request

Use independent contexts and evidence. The workflow is read-only by default.

## Dependency Gate

Resolve Superpowers and Matt Pocock's `code-review` before inspecting the diff.
If Superpowers is missing, stop with the runtime-specific instruction at
https://github.com/obra/superpowers#installation. Claude Code uses
`/plugin install superpowers@claude-plugins-official`.

If Matt Pocock's skill is missing, stop and print:
`pnpm dlx skills@1.5.23 add https://github.com/mattpocock/skills/archive/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76.tar.gz --skill code-review --skill setup-matt-pocock-skills`.
Claude Code may use `/plugin install mattpocock-skills`. If that skill requests
its setup step, stop and request `/setup-matt-pocock-skills` before continuing.

## Scope

Resolve the requirements or spec, repository instructions, base revision, head
revision, and complete diff. Confirm both revisions and reject an empty diff.
For local work without a supplied base, ask rather than guessing. Never edit
code, post comments, approve, merge, or change pull-request state.

## Ordered Review Pipeline

### 1. First gate: code-quality

**No other review lens starts until code-quality returns.** Dispatch a fresh
read-only subagent with the exact scope and require it to use `code-quality`.
Collect its maintainability findings and grade before starting the next stage.

### 2. Superpowers review

Use `requesting-code-review` with a fresh subagent. Give it the change summary,
requirements, base, and head. Apply `receiving-code-review` to verify every
reported issue against the actual codebase; do not accept feedback blindly.

### 3. Standards and spec review

Invoke Matt Pocock's `code-review` once; that skill owns its fresh parallel
Standards and Spec subagents. Keep those axes separate so conformance cannot
hide incorrect behavior, or vice versa. A missing spec must be reported, never
invented.

### 4. Anthropic review

On Claude Code, use the official Anthropic `code-review` plugin as an additional
lens when available. Its command publishes a GitHub comment: invoke that command
only when the user explicitly authorizes publication. Otherwise keep this phase
read-only and report it as skipped because publication was not authorized. This
optional Claude-only phase never blocks other runtimes.

## Synthesis

Deduplicate only findings with the same cause and impact. Validate file and line
references, exclude pre-existing issues, and retain the strongest evidence.
Report findings first by severity with location, impact, evidence, and smallest
safe fix. Follow with open questions, the code-quality grade, lenses executed,
and verification gaps. If no findings remain, state that explicitly.
