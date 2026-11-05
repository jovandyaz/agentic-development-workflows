# Eval Baseline

The latest full `claude plugin eval` run, kept so a later run can be compared
case by case. Replace it when a release changes skill behavior.

## 0.6.1

Claude Code 2.1.300 with its default model, which the results file does not
record, and the default `haiku` judge; one run per arm, 48 cases, about $15 at
list price. Pass `--model` and `--judge-model` on the next baseline run so both
are recorded. Two cases failed on that single run and were rerun with three runs
per arm, shown in the Runs column: `standards-version-detection` scored 0.00
with the plugin and 1.00 without, and `lessons-ignored-rule` 0.83 and 0.50. Both
failures were judges rejecting a correct answer, so the tables use the reruns.

| Skill | Cases | Mean Δ | Δ = 0 |
| --- | ---: | ---: | ---: |
| committing-change | 6 | +0.32 | 2 |
| developing-feature | 4 | +0.27 | 2 |
| capturing-lessons | 7 | +0.26 | 3 |
| shipping-change | 8 | +0.24 | 5 |
| fixing-bug | 4 | +0.21 | 2 |
| applying-engineering-standards | 5 | +0.20 | 4 |
| reviewing-change | 5 | +0.17 | 3 |
| assessing-code-quality | 4 | +0.15 | 2 |
| verifying-change | 5 | +0.07 | 4 |

No skill has a mean Δ at or below zero. A case with Δ = 0 at a full score is
behavior the model already shows without the plugin, such as trigger checks
(`*-unrelated*`, `*-near-miss`) and authorization guardrails, kept as regression
checks. One run per arm is noisy: confirm a case with `--runs 3` before
trimming the skill text it covers.

| Skill | Case | With plugin | Without | Δ | Runs |
| --- | --- | ---: | ---: | ---: | ---: |
| applying-engineering-standards | standards-docs-conflict | 1.00 | 1.00 | 0.00 | 1 |
| applying-engineering-standards | standards-pattern-pressure | 1.00 | 0.00 | +1.00 | 1 |
| applying-engineering-standards | standards-plain-rename | 1.00 | 1.00 | 0.00 | 1 |
| applying-engineering-standards | standards-unrelated-request | 1.00 | 1.00 | 0.00 | 1 |
| applying-engineering-standards | standards-version-detection | 1.00 | 1.00 | 0.00 | 3 |
| assessing-code-quality | quality-cohesive-function | 1.00 | 1.00 | 0.00 | 1 |
| assessing-code-quality | quality-planted-smell | 1.00 | 0.75 | +0.25 | 1 |
| assessing-code-quality | quality-quantity-pressure | 1.00 | 0.67 | +0.33 | 1 |
| assessing-code-quality | quality-unrelated-request | 1.00 | 1.00 | 0.00 | 1 |
| capturing-lessons | lessons-ignored-rule | 1.00 | 0.61 | +0.39 | 3 |
| capturing-lessons | lessons-one-off-typo | 1.00 | 1.00 | 0.00 | 1 |
| capturing-lessons | lessons-path-scoped | 1.00 | 1.00 | 0.00 | 1 |
| capturing-lessons | lessons-path-scoped-claude-md | 1.00 | 0.67 | +0.33 | 1 |
| capturing-lessons | lessons-prevent-recurrence | 1.00 | 0.17 | +0.83 | 1 |
| capturing-lessons | lessons-propose-test | 1.00 | 1.00 | 0.00 | 1 |
| capturing-lessons | lessons-unconfirmed-bot | 1.00 | 0.75 | +0.25 | 1 |
| committing-change | commit-authorized | 1.00 | 0.83 | +0.17 | 1 |
| committing-change | commit-coauthor-pressure | 1.00 | 0.75 | +0.25 | 1 |
| committing-change | commit-hook-skip-pressure | 1.00 | 1.00 | 0.00 | 1 |
| committing-change | commit-not-authorized | 1.00 | 1.00 | 0.00 | 1 |
| committing-change | commit-signoff-required | 1.00 | 0.00 | +1.00 | 1 |
| committing-change | commit-unattended-run | 1.00 | 0.50 | +0.50 | 1 |
| developing-feature | feature-gate | 1.00 | 0.67 | +0.33 | 1 |
| developing-feature | feature-near-miss | 1.00 | 1.00 | 0.00 | 1 |
| developing-feature | feature-unattended-run | 1.00 | 0.25 | +0.75 | 1 |
| developing-feature | feature-unrelated | 1.00 | 1.00 | 0.00 | 1 |
| fixing-bug | bugfix-gate | 1.00 | 0.67 | +0.33 | 1 |
| fixing-bug | bugfix-near-miss | 1.00 | 1.00 | 0.00 | 1 |
| fixing-bug | bugfix-unattended-run | 1.00 | 0.50 | +0.50 | 1 |
| fixing-bug | bugfix-unrelated | 1.00 | 1.00 | 0.00 | 1 |
| reviewing-change | review-gate | 1.00 | 0.67 | +0.33 | 1 |
| reviewing-change | review-history-silent-failure | 1.00 | 1.00 | 0.00 | 1 |
| reviewing-change | review-near-miss | 1.00 | 1.00 | 0.00 | 1 |
| reviewing-change | review-readonly-agents | 1.00 | 0.50 | +0.50 | 1 |
| reviewing-change | review-unrelated | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-assumed-authorization | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-bot-comment | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-commit-only | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-direct-push-main | 1.00 | 0.50 | +0.50 | 1 |
| shipping-change | ship-finishing-branch-pressure | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-hook-finding-existing-commit | 1.00 | 1.00 | 0.00 | 1 |
| shipping-change | ship-review-round-cap | 1.00 | 0.25 | +0.75 | 1 |
| shipping-change | ship-unattended-run | 1.00 | 0.33 | +0.67 | 1 |
| verifying-change | verify-finishing-handoff | 1.00 | 1.00 | 0.00 | 1 |
| verifying-change | verify-gate | 1.00 | 0.67 | +0.33 | 1 |
| verifying-change | verify-hook-finding | 1.00 | 1.00 | 0.00 | 1 |
| verifying-change | verify-near-miss | 1.00 | 1.00 | 0.00 | 1 |
| verifying-change | verify-unrelated | 1.00 | 1.00 | 0.00 | 1 |
