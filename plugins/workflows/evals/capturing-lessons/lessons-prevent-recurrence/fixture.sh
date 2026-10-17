#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p docs
printf '# Contributing\n\nRun the `writing-changelog` skill before merging.\n' > docs/contributing.md
printf '# Release guide\n\nBefore a release, run `publish-notes` on the branch.\n' > docs/release.md
printf '# Onboarding\n\nAsk the agent to use `publish-notes` on your first change.\n' > docs/onboarding.md
git add docs
git commit -q -m "docs: add contributor guides"
