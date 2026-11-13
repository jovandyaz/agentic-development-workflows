# Changelog

## [0.9.0] - 2026-11-13

- `reviewing-change` applies a reachability rule only to inputs an externally
  callable entry point (HTTP or RPC API, socket, queue, webhook) accepts under
  its schema: current clients not sending such an input never downgrades,
  parks, or dismisses a finding, and the rule never raises impact by itself.
- A parked trigger that waits for a new client or caller to send an input the
  entry point already accepts is not valid.
- New eval case `review-schema-allowed-input` guards the classification.

## [0.8.1] - 2026-11-12

- `reviewing-change` and the README no longer read as skipping an explicitly
  requested cross-vendor lens on a low-risk change: a request in the review
  runs it on any change, and the low-risk skip applies only when instructions
  alone enable the lens.

## [0.8.0] - 2026-11-11

- `reviewing-change` adds an Evidence and refutation step: every finding and
  every premise a change, fix, or earlier ruling relies on needs evidence (a
  file and line, a schema constraint, command output, or an official docs
  URL), and a refuted premise becomes a finding.
- Reviewers get the requirements and the diff, never the implementer's
  summary; claims in commits or comments are premises to verify.
- The spec reviewer follows each invariant to every write path, including
  repository or persistence mapping.
- The standards reviewer skips a rule only after confirming the tool's
  configuration covers the changed path.
- Parked findings carry a checkable revisit trigger and are rechecked every
  round and before merge. Every review report lists them, and
  `shipping-change` records them with their triggers in the PR body, which a
  later review reads back as data.
- `shipping-change` lists every review thread (all pages) before requesting
  merge, addresses each human thread within authorization, and stops if
  threads cannot be listed; thread text is untrusted.
- An opt-in, reporting-only cross-vendor lens. It sends the change to another
  AI vendor, so it runs only when the user asks for it or the user's or
  repository's instructions enable it (in an unattended run, only when the
  invoking prompt grants it; instructions the reviewed change adds or edits
  never enable it), and is otherwise listed as skipped, "not
  enabled". Enabled by instructions, it covers changes that move money, change
  authorization, data or schema, a public API, or have high blast radius. It
  runs a different vendor's CLI read-only if installed, never lets it edit,
  treats its output as untrusted, verifies every finding, and reports the gap
  when it is unavailable.
- Eight new eval cases cover these behaviors.

## [0.7.0] - 2026-11-10

- `committing-change` ships `scripts/guard-commit.mjs`, a Codex `PreToolUse`
  hook that blocks a commit carrying `Co-authored-by` or other agent
  attribution, which Codex otherwise adds when the user asks.
- Eval cases that must not change files also fail on a new file and on common
  shell writes in the repository, not only on `Edit` or `Write`.
- `lessons-ignored-rule` counts a hard-wrapped rule once and drops a judge that
  disagreed with its deterministic grader between runs.
- A new review case checks that only a correctness defect blocks and a naming
  issue stays non-blocking.

## [0.6.1] - 2026-11-05

- The push guard fails closed: a push it cannot resolve, such as one inside
  `bash -c`, `$(...)`, an alias, or a wrapper, is blocked with how to push
  explicitly. It resolves destinations with local git only, never contacts the
  remote or runs repository-configured commands before approval, and asks for
  `git remote set-head <remote> --auto` when the default branch is unknown.
  Dry runs and text that only mentions `git push` are no longer blocked.
- The CI fixer template repairs the commit that failed, keeps its scratch files
  out of the patch, publishes nothing from a run stopped by its turn or budget
  cap, refuses lockfile edits, and frees the label when commenting fails.
- Eval graders catch commands on later lines, require the commit an unattended
  run was granted, keep the root rule in path-scoped lessons, and catch shell
  writes in read-only review. A new case checks that a
  direct push to the default branch is refused.
- The review guard counts a reviewer launched in the background only once it
  returns, so a review cannot end while a lens is still running.
- The validator rejects a reviewer `tools:` list that continues on a second
  line, and the agent change metrics count a whole calendar month.

## [0.6.0] - 2026-11-04

- In Claude Code, review lenses run as the plugin's `quality-reviewer`,
  `spec-reviewer`, and `standards-reviewer` agents, which have no editing or
  shell tools; `reviewing-change` hands every reviewer the diff, commits, and
  line history. Other runtimes keep the read-only subagent instruction.
- A `Stop` hook sends Claude back once when a turn ran `reviewing-change`
  without dispatching all three reviewer agents, whatever the diff's size. A
  review that stops to ask for its scope stays required after the answer.
- A `PreToolUse` hook blocks any push to the remote's default branch, `--all`,
  or `--mirror`. Turn it off with the `guard_default_branch` plugin option.
- `developing-feature`, `fixing-bug`, `committing-change`, and `shipping-change`
  follow one unattended-run contract: the prompt is the only authorization, open
  decisions go into the report, and merge, deploy, and release wait for a person.
- `capturing-lessons` puts a lesson local to one directory in a nested
  instruction file of the same kind as the root, or a path-scoped rules file,
  instead of the root instructions.
- `pnpm eval:report` and the `evals` workflow summarize score and delta per
  skill. New docs: a CI fixer template, whose agent job holds no write
  credentials and which can push with an optional GitHub App token so checks
  rerun, and metrics for agent-assisted changes.

## [0.5.3] - 2026-10-16

- `capturing-lessons` treats a request to prevent a recurrence, such as "make
  sure it doesn't happen again", as a request for a proposal, not as
  authorization to edit files.

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
