---
name: developing-feature
description: Use when implementing a new capability, changing product behavior, adding an integration, or beginning feature work before writing implementation code.
license: MIT
metadata:
  author: jovandyaz
  version: "0.3.0"
---

# Developing A Feature

Orchestrate existing skills; do not replace their discipline.

## Dependency Gate

Resolve Superpowers before acting. If unavailable, stop and print the matching
installation instruction from https://github.com/obra/superpowers#installation.
For Claude Code use `/plugin install superpowers@claude-plugins-official`.

If the change creates or changes UI, also resolve Anthropic's
`frontend-design`. If missing, stop and print:
`pnpm dlx skills@1.5.23 add https://github.com/anthropics/skills/archive/3b3fad96af16a10759d930941b4520ba0c40edae.tar.gz --skill frontend-design`.
Claude Code may instead use
`/plugin install frontend-design@claude-plugins-official`.

Missing required dependencies are blockers, not reasons to approximate them.

## Workflow

1. Inspect the repository, instructions, existing behavior, and relevant tests.
   Use `applying-engineering-standards` before making design or library choices.
2. Use `brainstorming`. Clarify the user, outcome, constraints, acceptance
   criteria, and non-goals. If a design is already approved, validate that it is
   still applicable without reopening settled choices. Otherwise obtain design
   approval before implementation. Record commit authorization and PR
   publication authorization separately; neither implies merge or deployment
   authorization.
3. For UI work, use `frontend-design` after product intent is clear. Preserve an
   existing design system unless the approved brief explicitly replaces it.
4. Use `using-git-worktrees` when isolation is appropriate, then use
   `writing-plans` to produce small tasks with acceptance and verification.
   When applicable, identify API/data compatibility, migration, rollback,
   rollout, observability, and agent-eval gates for the affected boundaries.
   Prefer a small PR or independently valid stack.
5. Use `subagent-driven-development` for independent tasks and
   `test-driven-development` for every behavior change. Each implementer gets
   the approved requirement, exact task, relevant paths, and no session history.
   Unless the user authorized commits, pass a no-commit constraint to every
   subskill and subagent and omit their commit steps.
6. After implementation, run `reviewing-pr`. Validate every finding with
   `receiving-code-review`; fix confirmed blocking findings one at a time and
   rerun `reviewing-pr` until none remain.
7. Run `verifying-change` only after review is clean.

Use `committing-change` for every authorized commit. Let `verifying-change`
handoff to `shipping-change` only when PR publication was already authorized.

Do not commit, push, publish, or open a pull request unless explicitly asked.
Report what changed, fresh verification evidence, and unresolved risks.
