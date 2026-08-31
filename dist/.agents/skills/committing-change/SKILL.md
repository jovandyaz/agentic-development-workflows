---
name: committing-change
description: Use when the user has explicitly authorized creating a git commit for already reviewed and verified content.
license: MIT
metadata:
  author: jovandyaz
  version: "0.2.1"
---

# Committing A Change

Create an auditable local commit containing one intentional concern. Committing
does not authorize pushing, opening a pull request, merging, or releasing.

## Pre-Commit Gate

1. Confirm the user explicitly authorized this commit. Verification, PR intent,
   or repository policy cannot grant commit authorization.
2. Use `applying-engineering-standards`, then read repository commit
   instructions and recent commit history.
3. Inspect `git status`, unstaged diff, staged diff, and recent log. Preserve
   unrelated user or agent changes.
4. Confirm fresh verification exists for the exact content being committed.
5. Stage only intended files by explicit path. Reinspect the staged diff and
   scan for credentials, generated noise, debug output, and accidental scope.

## Default Commit Contract

Repository rules may be stricter. Otherwise use a single-line Conventional
Commit written in English, imperative mood, with an empty body and no trailers.
Keep the subject concise, normally no more than 72 characters.

```text
fix(auth): prevent duplicate verification emails
```

Never add `Co-authored-by`, agent attribution, model attribution, or any other
automatic trailer. AI-assistance disclosure belongs in the pull request when
repository or organization policy requires it, not in Git authorship. If a
repository requires trailers, report that this commit policy is incompatible
and stop without committing.

## Commit And Confirm

Run the normal commit so repository hooks execute. Do not use `--no-verify`,
force options, or `--amend` unless the user explicitly requests them. If a hook
fails, determine whether resolution edits content. Commit authorization alone
does not authorize editing files. Confirm implementation or remediation
authorization before editing; otherwise report the hook failure and ask. If
resolving a hook changes content, rerun applicable review and verification
before creating the commit.

Afterward, inspect the new commit and worktree. Report its SHA, subject, included
scope, and any remaining changes. Do not claim a clean worktree unless verified.
