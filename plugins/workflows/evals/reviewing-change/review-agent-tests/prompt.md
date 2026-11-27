---
description: Review blocks on a weakened existing test and flags a new test that passes against a wrong implementation.
max_turns: 40
plugins: [../../.., superpowers-stub]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write, Agent]
---

Review my branch `feat/discount-cap` against `main` before I merge it. Requirement: a discount above 50% is capped at 50%; discounts of 50% or less keep their current result.
