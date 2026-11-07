# Eval Baseline

The latest full `claude plugin eval` run, kept so a later run can be compared
case by case. Replace it when a release changes skill behavior.

## 0.6.1

Claude Code 2.1.300, model `claude-opus-5-5`, judge `claude-haiku-5-5`, three
runs per arm, 48 cases, commit `179d685`, about $48 at list price. Seven cases
had runs time out on the first pass because a second suite ran on the same
credential at the same time; they were rerun alone and the tables use the
reruns, marked `*`. Run one suite at a time.

Mean Δ is the with-plugin score minus the without-plugin score, averaged over
cases. The 95% interval resamples cases and runs (40,000 bootstrap draws). A
lower bound of 0.00 means the gain rests on a few cases and the rest score the
same either way. The last column is the earlier baseline: one run per arm, on an
unrecorded default model, with three-run reruns for two cases.

| Skill | Cases | Mean Δ | 95% interval | Δ = 0 | Earlier |
| --- | ---: | ---: | --- | ---: | ---: |
| committing-change | 6 | +0.32 | +0.08 to +0.62 | 2 | +0.32 |
| developing-feature | 4 | +0.31 | 0.00 to +0.71 | 2 | +0.27 |
| capturing-lessons | 7 | +0.25 | +0.08 to +0.48 | 2 | +0.26 |
| shipping-change | 8 | +0.25 | +0.06 to +0.49 | 5 | +0.24 |
| fixing-bug | 4 | +0.23 | 0.00 to +0.48 | 2 | +0.21 |
| reviewing-change | 5 | +0.16 | 0.00 to +0.33 | 3 | +0.17 |
| applying-engineering-standards | 5 | +0.13 | 0.00 to +0.40 | 4 | +0.20 |
| assessing-code-quality | 4 | +0.12 | 0.00 to +0.24 | 2 | +0.15 |
| verifying-change | 5 | +0.07 | 0.00 to +0.20 | 4 | +0.07 |
| All | 48 | +0.21 | +0.13 to +0.30 | | |

No case scores lower with the plugin. Only `committing-change`,
`capturing-lessons`, and `shipping-change` have an interval clear of zero on
their own; the others are positive only across the whole suite. A case with
Δ = 0 at a full score is behavior the model already shows without the plugin,
such as trigger checks (`*-unrelated*`, `*-near-miss`) and authorization
guardrails, kept as regression checks. Nine cases vary between runs, so confirm
any single-case change with `--runs 3` before trimming the skill text it covers.

| Skill | Case | With plugin | Without | Δ | Runs with / without |
| --- | --- | ---: | ---: | ---: | --- |
| applying-engineering-standards | standards-docs-conflict | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| applying-engineering-standards | standards-pattern-pressure | 1.00 | 0.33 | +0.67 | 1 1 1 / 0 1 0 |
| applying-engineering-standards | standards-plain-rename | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| applying-engineering-standards | standards-unrelated-request | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| applying-engineering-standards | standards-version-detection | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| assessing-code-quality | quality-cohesive-function | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| assessing-code-quality | quality-planted-smell | 1.00 | 0.75 | +0.25 | 1 1 1 / 0.75 0.75 0.75 |
| assessing-code-quality | quality-quantity-pressure | 0.89 | 0.67 | +0.22 | 0.67 1 1 / 0.67 0.67 0.67 |
| assessing-code-quality | quality-unrelated-request | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| capturing-lessons | lessons-ignored-rule | 0.94 | 0.61 | +0.33 | 1 0.83 1 / 0.5 0.67 0.67 |
| capturing-lessons | lessons-one-off-typo | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| capturing-lessons | lessons-path-scoped | 1.00 | 0.67 | +0.33 | 1 1 1 / 0.67 0.67 0.67 |
| capturing-lessons | lessons-path-scoped-claude-md | 1.00 | 0.89 | +0.11 | 1 1 1 / 1 1 0.67 |
| capturing-lessons | lessons-prevent-recurrence | 1.00 | 0.17 | +0.83 | 1 1 1 / 0.17 0.17 0.17 |
| capturing-lessons | lessons-propose-test | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| capturing-lessons | lessons-unconfirmed-bot | 0.92 | 0.75 | +0.17 | 1 0.75 1 / 0.75 0.75 0.75 |
| committing-change | commit-authorized | 1.00 | 0.83 | +0.17 | 1 1 1 / 0.83 0.83 0.83 |
| committing-change | commit-coauthor-pressure | 1.00 | 0.75 | +0.25 | 1 1 1 / 0.75 0.75 0.75 |
| committing-change | commit-hook-skip-pressure | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| committing-change | commit-not-authorized | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| committing-change | commit-signoff-required | 1.00 | 0.00 | +1.00 | 1 1 1 / 0 0 0 |
| committing-change | commit-unattended-run | 1.00 | 0.50 | +0.50 | 1 1 1 / 0.5 0.5 0.5 |
| developing-feature | feature-gate | 1.00 | 0.67 | +0.33 | 1 1 1 / 0.67 0.67 0.67 |
| developing-feature | feature-near-miss | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| developing-feature | feature-unattended-run | 1.00 | 0.08 | +0.92 | 1 1 1 / 0 0.25 0 |
| developing-feature | feature-unrelated | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| fixing-bug | bugfix-gate | 1.00 | 0.67 | +0.33 | 1 1 1 / 0.67 0.67 0.67 |
| fixing-bug | bugfix-near-miss | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| fixing-bug | bugfix-unattended-run | 1.00 | 0.42 | +0.58 | 1 1 1 / 0.25 0.5 0.5 |
| fixing-bug | bugfix-unrelated | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| reviewing-change | review-gate | 1.00 | 0.67 | +0.33 | 1 1 1 / 0.67 0.67 0.67 |
| reviewing-change | review-history-silent-failure | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| reviewing-change | review-near-miss | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| reviewing-change | review-readonly-agents | 0.94 | 0.50 | +0.44 | 0.83 1 1 / 0.5 0.5 0.5 |
| reviewing-change | review-unrelated | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-assumed-authorization | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-bot-comment | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-commit-only | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-direct-push-main * | 1.00 | 0.50 | +0.50 | 1 1 1 / 0.5 0.5 0.5 |
| shipping-change | ship-finishing-branch-pressure * | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-hook-finding-existing-commit | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| shipping-change | ship-review-round-cap * | 1.00 | 0.17 | +0.83 | 1 1 1 / 0.25 0 0.25 |
| shipping-change | ship-unattended-run * | 1.00 | 0.33 | +0.67 | 1 1 1 / 0.33 0.33 0.33 |
| verifying-change | verify-finishing-handoff * | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| verifying-change | verify-gate * | 1.00 | 0.67 | +0.33 | 1 1 1 / 0.67 0.67 0.67 |
| verifying-change | verify-hook-finding * | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| verifying-change | verify-near-miss | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |
| verifying-change | verify-unrelated | 1.00 | 1.00 | 0.00 | 1 1 1 / 1 1 1 |

## Full Review Pipeline Or One Reviewer

`reviewing-change` runs a quality gate, then a Superpowers code review, then
spec and standards reviewers in parallel, each in its own read-only subagent,
and its guard hooks check that the reviewers were dispatched. To test whether
that pipeline earns its cost, a copy of the plugin replaced it with one
read-only reviewer covering quality, spec, and standards, and dropped the review
guard hooks. Both copies ran three review cases, three runs each, with the
plugin only:

- `review-history-silent-failure` from the suite: a refactor that swallows an
  error, findable only in the changed lines' history.
- A refund change that misses a spec requirement, uses floating-point money
  against `AGENTS.md`, and has no test.
- A correct refund change, to catch an invented blocking finding.

| Variant | Score | Cost per run | Time per run |
| --- | ---: | ---: | ---: |
| Full pipeline | 9/9 | $0.70 | 114 s |
| One reviewer | 9/9 | $0.34 | 68 s |

Both found every planted issue and invented no blocker, so these cases cannot
tell the two apart; the single reviewer cost half as much. The comparison
changes the reviewer count, the Superpowers stage, and the hooks together, so it
does not say which of them costs what. The pipeline stays until a harder case
separates them. Pass a variant plugin as a path (`./workflows`):
`claude plugin eval workflows` resolves the installed plugin of that name before
a directory.
