# Changelog

## [0.4.0] - 2026-10-06

- Drop the Matt Pocock `code-review` and `setup-matt-pocock-skills` dependencies.
  `reviewing-pr` now runs its own parallel Spec and Standards subagents with the
  pinned diff, keeps the two axes separate, and needs no repository setup.

## [0.3.0] - 2026-09-18

- Require `shipping-change` to curate the branch history before PR creation and
  again before merge, folding fix-up and review-round commits into the commits
  they correct without changing content.

## [0.2.1] - 2026-08-30

- Correct global and repository-scoped dependency installation guidance.
- Record every installed third-party skill and its reviewed revision.
- Reject symlinked owned skill roots before integrity checks or replacement.
- Harden CI with immutable actions, read-only permissions, concurrency, and timeouts.

## [0.2.0] - 2026-08-30

- Add `committing-change` with single-line Conventional Commit and no-coauthor defaults.
- Add `shipping-change` with compatibility, rollback, rollout, CI, CodeRabbit, and post-deploy gates.
- Add `applying-engineering-standards` for project-aware, official-documentation-first decisions.
- Handoff from successful verification to shipping only with prior publication authorization.

## [0.1.0] - 2026-08-29

- Add the initial five composable workflows.
- Require `code-quality` as the first pull-request review stage.
