---
name: fixing-bug
description: Use when behavior is broken, a test fails, an error is reported, a regression appears, or the cause of a defect is not yet proven.
license: MIT
metadata:
  author: jovandyaz
  version: "0.11.0"
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
2. Use `systematic-debugging` to prove the cause before any fix.
3. Use `test-driven-development` to add the smallest regression test. Observe
   it fail for the expected reason before changing production code.
   Derive each test from a requirement, never from the implementation: it
   must fail if that requirement were implemented wrongly. Mock only system
   boundaries, such as the network, the clock, or external services, never the
   unit under test, and do not repeat coverage an existing test already gives.
   Never weaken, delete, or change the expected value of an existing test to
   make it pass unless the requirement changes that behavior or the test
   asserted the defect being fixed. When a requirement is an invariant over a
   range of inputs, such as a serialization round trip or a money calculation,
   write a property test with the property-based testing library the repository
   already uses; without one, use examples and add no dependency. For a refactor
   or migration, prefer a differential test that runs the old and new
   implementations on the same inputs.
4. Implement one minimal cause-level fix. Run the regression test, then relevant
   neighboring tests. For UI fixes, apply `frontend-design` without replacing
   an established design system. Do not combine unrelated cleanup with the fix.
5. Once the fix passes, use `capturing-lessons` when the proven cause reveals a
   mistake likely to recur, once per finding; reuse a lesson report that
   `reviewing-change` already produced.
6. Run `reviewing-change`. Validate feedback with `receiving-code-review`, fix
   each confirmed blocking finding, and repeat review until no blocking findings
   remain, for at most three review rounds counted across the whole workflow. If
   a blocking finding remains after the third round, stop and report it with the
   fixes attempted. Report non-blocking findings, parked findings, and open
   questions and leave them to the user.
7. Run `verifying-change` to reproduce the original path and execute the broader
   checks justified by the affected surface.

Distinguish a temporary mitigation from a permanent fix. Do not commit, push,
publish, or open a pull request unless explicitly asked. Pass a no-commit
constraint to every subskill and subagent and omit their normal commit steps.
When a commit is authorized, use `committing-change`; PR publication remains a
separate authorization handled after `verifying-change`. Never use
`finishing-a-development-branch`: its merge, push, and pull-request options
bypass these authorization checks.

## Unattended Runs

A run with nobody to answer, such as a headless `-p` run, a CI job, a scheduled
task, or a prompt that says no one will reply, grants nothing new:

- The invoking prompt is the only authorization. Anything it does not grant
  explicitly, including commit, push, and pull request, is not granted.
- Where this workflow would ask, do not wait: skip that step, keep the work
  local, and list the open decision in the final report.
- Never merge, deploy, or release in an unattended run, even when the prompt
  asks; a person approves those.
- End with a report a person can act on: what changed, the verification
  evidence, and each open decision.
