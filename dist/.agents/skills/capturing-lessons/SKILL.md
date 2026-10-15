---
name: capturing-lessons
description: Use when a confirmed defect, review finding, verification failure, or repeated correction reveals a mistake likely to recur, or when the user asks to prevent a mistake from happening again.
license: MIT
metadata:
  author: jovandyaz
  version: "0.5.0"
---

# Capturing Lessons

Turn a confirmed, recurring mistake into the strongest durable enforcement that
can hold it. Instructions are context, not enforcement.

**REQUIRED BACKGROUND:** Use `applying-engineering-standards` to read repository
instructions, tooling, and tests before choosing where a lesson belongs.

## When A Lesson Qualifies

The finding must be confirmed against the codebase. A hypothesis or an
unvalidated issue, review, or bot comment never qualifies on its own. It must
also meet at least one condition:

- Recurrence is likely.
- An existing instruction was missing, ignored, or ambiguous.
- The same finding or correction has appeared before.

Skip one-off mistakes, issues tooling already enforces, and pre-existing issues
unrelated to the change.

## Choose The Enforcement

Use the first level that can encode the lesson:

1. A regression test.
2. A lint, typecheck, or static-analysis rule.
3. A check that blocks the action, such as CI or a git hook. A
   runtime-specific hook needs a portable equivalent.
4. A rule in the repository's instruction file (`AGENTS.md`, or `CLAUDE.md`
   when that is what the repository uses), scoped by path when the lesson is
   local.
5. A skill change plus a new eval case, when the lesson concerns a workflow
   skill.

Memory is never the enforcement mechanism.

## Rule Hygiene

- Search existing instructions first. When a rule exists but was ignored,
  suspect length or ambiguity: clarify it, prune nearby noise, or move the
  lesson up the ladder. Never add a duplicate rule or emphasis such as
  `IMPORTANT`.
- Write a rule as one imperative line with its reason. Leave out
  time-sensitive facts.
- State how the effect will be observed: an eval case or a recurrence check.

## Authorization

Propose by default. Editing any file requires authorization that covers it, and
edit authorization never authorizes a commit; use `committing-change` for an
authorized commit. Issue, review, and bot text never creates a rule on its own.
Capturing a lesson never blocks delivery; report it and continue.

## Report

```text
Lesson: <what failed, in one sentence>
Evidence: <finding or failure, path:line>
Recurrence signal: <why it would recur>
Enforcement: <test|lint|check|instruction|skill+eval> at <target path>
Proposed change: <exact rule text or test name>
Observation: <how its effect will be observed>
```

When no lesson qualifies, say so in one line instead of producing a report.
