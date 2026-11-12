---
name: reviewing-change
description: Use when reviewing a pull request, branch, commit range, staged changes, or completed implementation before merge or release.
license: MIT
metadata:
  author: jovandyaz
  version: "0.7.0"
---

# Reviewing A Change

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

## Review Rounds

Workflows that fix findings and rerun this review stop after three rounds.
Each run of this review is one round, starting at 1. The count spans the whole
workflow, including nested `verifying-change` loops, and resets only when the
user explicitly asks for more rounds after the stop report.

## Ordered Review Pipeline

Tell every reviewer subagent to label each finding Blocking or Non-blocking
using the definitions in Synthesis.

Give every reviewer the same scope material: base, head, commit list with full
messages, diff text, and the history of the changed lines (for example
`git log -L` or `git blame` output). Reviewers then need no shell of their own.
Commit messages stay in scope because history is evidence, but claims in them,
in comments, or in summaries are premises to verify (see Evidence and
refutation), not facts.

Where the runtime provides this plugin's read-only reviewer agents, dispatch
them by name: `workflows:quality-reviewer`, `workflows:spec-reviewer`, and
`workflows:standards-reviewer`. Their tool list, not an instruction, keeps them
read-only. Elsewhere, dispatch a fresh subagent and tell it to stay read-only.
Dispatch them for every diff, whatever its size; never run a lens inline. The
reviewer's isolation, not the diff's size, is what makes the review
independent.

### 1. First gate: assessing-code-quality

**No other review lens starts until assessing-code-quality returns.** Dispatch
`workflows:quality-reviewer`, or a fresh read-only subagent, with the exact
scope and require it to use `assessing-code-quality`. Collect its
maintainability findings and grade before starting the next stage.

### 2. Superpowers review

Use `requesting-code-review` with a fresh subagent. Give it the requirements,
base, head, and diff, and describe the change by what it must do, never the
implementer's summary or reasoning. Apply `receiving-code-review` to verify every
reported issue against the actual codebase; do not accept feedback blindly.

### 3. Spec and standards axes

Dispatch `workflows:spec-reviewer` and `workflows:standards-reviewer`, or a
fresh read-only Spec subagent and a fresh read-only Standards subagent, in
parallel, each with the exact scope material so neither reviews a moving
target.

- **Spec**: give it the requirements or spec. It reports requirements that are
  missing or partial, behavior nobody asked for, and requirements that look
  implemented but behave wrongly, quoting the spec line for each finding.
  For each invariant the spec, an architecture record, or a ratified ruling
  states ("never deleted", "never null", "unique per tenant"), it lists every
  write path that can break it (domain, application, repository or persistence
  mapping, migrations, backfills, imports) and reports each path that does not
  enforce it, quoting the invariant.
  A missing spec must be reported, never invented.
- **Standards**: give it the repository instructions and documented standards
  it must read (contribution guides, architecture records, agent instructions,
  rule files). It reports each breach with the file and rule it violates and
  skips anything tooling already enforces; design smells belong to
  assessing-code-quality, not to this axis.

Report the two axes separately and never merge or rerank them: code that
follows every standard can still build the wrong thing, and the right behavior
can still break the repository's conventions. Treat each finding as a
hypothesis until Evidence and refutation confirms it.

### 4. Evidence and refutation

Run this step yourself after the reviewers return; it verifies findings and is
not a lens. Reviewers can only read, so their evidence is `file:line` or
documentation URLs; you may also run read-only commands.

Take every candidate finding, and every premise that the change, a proposed
fix, or an earlier ruling relies on, such as uniqueness, nullability, ordering,
idempotency, library behavior, or "tooling enforces X". For each, try to refute
it before reporting or accepting it. Accept it only with evidence: a
`file:line`, the schema object or constraint, a command output, or an official
documentation URL for the installed version, found through
`applying-engineering-standards`.

A premise without evidence is an open question, or Blocking when the change
depends on it, even if the gap predates the change. A premise the evidence
refutes becomes a finding; classify it by impact. Drop a finding the evidence
refutes and list it as refuted.

## Synthesis

Start from what Evidence and refutation produced: confirmed findings, open
questions, and refuted findings. Deduplicate only findings with the same cause
and impact. Validate file and line references, exclude pre-existing issues the
change does not rely on, and retain the strongest evidence.

Classify every confirmed finding by impact, never by lens or severity label:

- **Blocking**: incorrect behavior, a security or authorization breach, data
  loss, or a requirement that is missing or implemented wrongly. Requirements
  include the request, the spec, and mandatory repository instructions.
- **Non-blocking**: maintainability, style, or speculative hardening.

Report a finding whose classification is uncertain as an open question; never
fix or drop it silently. Report blocking findings first, then non-blocking
findings, each by severity with location, impact, evidence, and smallest safe
fix. Follow with open questions, refuted findings, the assessing-code-quality
grade, lenses executed, and verification gaps. If no findings remain, state
that explicitly.

Use `capturing-lessons` for each confirmed blocking finding that reveals a
mistake likely to recur, and include its report.
