---
name: fixing-bug
description: Use when behavior is broken, a test fails, an error is reported, a regression appears, or the cause of a defect is not yet proven.
license: MIT
metadata:
  author: jovandyaz
  version: "0.2.0"
---

# Fixing A Bug

Fix the proven cause, not the nearest symptom.

## Dependency Gate

Resolve Superpowers before acting. If unavailable, stop and print the matching
installation instruction from https://github.com/obra/superpowers#installation.
For Claude Code use `/plugin install superpowers@claude-plugins-official`.
Missing Superpowers is a blocker; do not substitute ad-hoc debugging.

If the fix changes any UI, also resolve Anthropic's `frontend-design`. If it is
missing, stop and print:
`pnpm dlx skills@1.5.23 add https://github.com/anthropics/skills/archive/3b3fad96af16a10759d930941b4520ba0c40edae.tar.gz --skill frontend-design`.
Claude Code may use `/plugin install frontend-design@claude-plugins-official`.

## Workflow

1. Use `applying-engineering-standards`, then capture the report, environment,
   expected behavior, actual behavior, and a
   deterministic reproduction. If reproduction is impossible, collect evidence
   instead of editing speculatively.
2. Use `systematic-debugging`. Read errors and recent changes, trace the bad
   state backward to its origin, compare a working path, and state one testable
   hypothesis.
3. Use `test-driven-development` to add the smallest regression test. Observe
   it fail for the expected reason before changing production code.
4. Implement one minimal cause-level fix. Run the regression test, then relevant
   neighboring tests. For UI fixes, apply `frontend-design` without replacing
   an established design system. Do not combine unrelated cleanup with the fix.
5. If the hypothesis fails, return to evidence. After three failed hypotheses,
   stop and question the architecture or assumptions with the user.
6. Run `reviewing-pr`. Validate feedback with `receiving-code-review`, fix each
   confirmed blocker, and repeat review until clean.
7. Run `verifying-change` to reproduce the original path and execute the broader
   checks justified by the affected surface.

Distinguish a temporary mitigation from a permanent fix. Do not commit, push,
publish, or open a pull request unless explicitly asked. Pass a no-commit
constraint to every subskill and subagent and omit their normal commit steps.
When a commit is authorized, use `committing-change`; PR publication remains a
separate authorization handled after `verifying-change`.
