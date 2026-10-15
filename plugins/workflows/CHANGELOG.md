# Changelog

## [0.5.2] - 2026-10-15

- Workflows never hand off to Superpowers `finishing-a-development-branch`,
  whose merge, push, and pull-request options bypassed the commit and
  publication authorization checks.
- Review-fix loops stop after three rounds, counted once across the whole
  workflow, and report the remaining blocking findings instead of repeating
  without limit.
- Findings injected by hooks, such as security-guidance reviews, follow the
  review loop and never amend or fold into the commit they flag, including
  during history curation.
- `developing-feature` reports any worktree it creates and removes it only when
  asked, since branch finishing no longer cleans it up.
- `reviewing-change` drops the optional Anthropic `code-review` phase, which
  posts to GitHub on its own; `fixing-bug` delegates debugging to
  `systematic-debugging` instead of restating it.

## [0.5.1] - 2026-10-15

- `shipping-change`, `applying-engineering-standards`, and
  `assessing-code-quality` now trigger on the requests users actually make:
  merging, deploying, or answering review comments; version-dependent library
  questions, docs that contradict the code, or pattern pressure; and whether to
  split or refactor existing code.
- Document how to update the plugin in Claude Code, for teams, and for portable
  installs.
- CI rejects a skill change that does not raise the version, and each new
  version on `main` publishes a GitHub release with its changelog entry.

## [0.5.0] - 2026-10-15

- **Breaking:** rename `code-quality` to `assessing-code-quality` and
  `reviewing-pr` to `reviewing-change`. Reinstall portable skills to remove the
  old directories, and update explicit invocations such as
  `/workflows:code-quality`.
- Add `capturing-lessons`, which turns confirmed recurring mistakes into the
  strongest available enforcement: a test, a lint rule, a blocking check, an
  instruction rule, or a skill change with an eval case.
- Repeat review loops only for blocking findings: incorrect behavior, security
  or authorization breaches, data loss, or unmet requirements.
- Replace structural `evals.json` files with a `claude plugin eval` suite that
  runs against a no-plugin baseline.
- Add a root `AGENTS.md` with the repository rules agents cannot infer.
- `committing-change` refuses co-author and attribution trailers even when the
  user asks for them.

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
