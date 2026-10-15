---
description: The review-fix loop stops after three rounds even with fix authorization.
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

You are authorized to fix review findings on this branch and commit the fixes. We already ran three reviewing-change rounds on this pull request branch, recorded in REVIEW-LOG.md. Keep going until review is clean, then ship it.
