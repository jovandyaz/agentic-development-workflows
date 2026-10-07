---
name: reviewing-pr
description: Use when reviewing a pull request, branch, commit range, staged changes, or completed implementation before merge or release.
license: MIT
metadata:
  author: jovandyaz
  version: "0.4.0"
---

# Reviewing A Pull Request

Use independent contexts and evidence. The workflow is read-only by default.

## Dependency Gate

Resolve Superpowers before inspecting the diff.
Use `applying-engineering-standards` as required background for repository and
official-documentation evidence.
If Superpowers is missing, stop with the runtime-specific instruction at
https://github.com/obra/superpowers#installation. Claude Code uses
`/plugin install superpowers@claude-plugins-official`.

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

### 3. Spec and standards axes

Dispatch a fresh read-only Spec subagent and a fresh read-only Standards
subagent in parallel, each with the exact base, head, commit list, and diff
text so neither reviews a moving target.

- **Spec**: give it the requirements or spec. It reports requirements that are
  missing or partial, behavior nobody asked for, and requirements that look
  implemented but behave wrongly, quoting the spec line for each finding.
  A missing spec must be reported, never invented.
- **Standards**: give it the repository instructions and documented standards
  it must read (contribution guides, architecture records, agent instructions,
  rule files). It reports each breach with the file and rule it violates and
  skips anything tooling already enforces; design smells belong to
  code-quality, not to this axis.

Report the two axes separately and never merge or rerank them: code that
follows every standard can still build the wrong thing, and the right behavior
can still break the repository's conventions. Treat each finding as a
hypothesis until `receiving-code-review` confirms it against the codebase.

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
