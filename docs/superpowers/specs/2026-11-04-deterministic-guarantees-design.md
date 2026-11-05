# Deterministic Guarantees: Design

Date: 2026-11-04
Status: Implemented on `feat/deterministic-guarantees`, awaiting review
Target release: 0.6.0

## Goal

Move the rules that have no exceptions out of skill text and into machinery the
harness enforces, give unattended runs a contract, and measure what each skill
contributes. Keep every skill portable: Claude Code-only components are an
addition, and the skill text stays the fallback for Codex, Cursor, Gemini CLI,
and OpenCode.

## Evidence

| Decision | Primary source |
| --- | --- |
| Must-always rules belong in hooks, deny rules, or tool-limited subagents, not instructions | [Claude Code best practices](https://code.claude.com/docs/en/best-practices): deterministic vs non-deterministic instructions; a reviewer limited to `tools: Read, Grep, Glob` is enforced by Claude Code |
| Plugins can ship agents, hooks, and MCP servers | [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference): `agents/`, `hooks/hooks.json`, `.mcp.json`, `userConfig` |
| `PreToolUse` exit code 2 blocks the call; stderr reaches the model | [Hooks reference](https://code.claude.com/docs/en/hooks) |
| `Stop` exit code 2 keeps Claude working; `stop_hook_active` prevents loops; the transcript may lag | [Hooks reference](https://code.claude.com/docs/en/hooks) |
| Preload a subagent's skills with `skills:` instead of granting `Skill` | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| Unattended runs need done, self-check, scope, a cap, and sign-off | [Claude Code best practices](https://code.claude.com/docs/en/best-practices#let-claude-run-without-you) |
| Background agents are capped at one or two CI rounds and hand off at a PR | [Stripe Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) |
| Most public SWE skills add no measurable gain; some cost up to 451% more tokens | [SWE-Skills-Bench](https://arxiv.org/abs/2603.15401) |
| Eval JSON carries per-case `delta` and `score` | [Plugin evals](https://code.claude.com/docs/en/plugin-evals#json-result) |
| Rules scoped to a directory keep context small | Stripe Minions; [Claude Code memory](https://code.claude.com/docs/en/memory#path-specific-rules) |

## Changes

1. **Read-only reviewer agents.** `agents/quality-reviewer.md`,
   `agents/spec-reviewer.md`, and `agents/standards-reviewer.md` with
   `tools: Read, Grep, Glob`; the quality reviewer preloads `assessing-code-quality`
   with `skills:` instead of holding the `Skill` tool.
   `reviewing-change` dispatches them by their namespaced names when they exist
   and keeps the fresh read-only subagent as the portable fallback. The
   validator rejects any agent granted a tool that edits or runs commands.
   Skill text alone did not hold: in runtime acceptance the model ran every
   lens inline on a small diff. So `hooks/guard-review.mjs` records, from
   `PostToolUse` on `Skill` and agent calls (or a typed
   `/workflows:reviewing-change`), that `reviewing-change` ran and which
   reviewers were dispatched, and its `Stop` hook sends Claude back once when a
   reviewer is missing. State is one marker file per reviewer in
   `${CLAUDE_PLUGIN_DATA}`, because the reviewers are dispatched in parallel
   and the transcript can lag the turn. Events from inside a subagent are
   ignored, and each new prompt clears the state of an interrupted turn. A
   turn that still ends without dispatching any reviewer, usually because the skill
   stopped to ask for its scope, keeps the review required for exactly one
   more prompt, so the answer is enforced and the state never lingers.
2. **Default-branch guard hook.** `hooks/hooks.json` runs
   `hooks/guard-push.mjs` on every Bash call and exits 2 for a push that can
   reach the remote's default branch: a refspec naming it, a wildcard or
   matching refspec, a deletion, `--all`, `--branches`, or `--mirror`. It reads
   push options the way git does (unambiguous prefixes, `--no-` forms where
   the last one wins, short bundles such as `-fu` and `-uo <value>`) and blocks
   an option it does not know. A push without a refspec uses
   `remote.<name>.push`, `remote.<name>.mirror`, the destination git itself
   resolves (`%(push)`, which honors `push.default`, `pushRemote`,
   `remote.pushDefault`, and `branch.<name>.merge`), and
   `push.autoSetupRemote`; a refspec without a destination is mapped through
   `remote.<name>.push` and `push.default=upstream` as git maps it. The default
   branch comes only from `refs/remotes/<remote>/HEAD`, and a URL target maps
   to the configured remote with that URL. The guard never contacts the remote
   and runs only local git reads that touch no index (`config`,
   `symbolic-ref`, `for-each-ref`, `rev-parse`), so nothing a repository's
   config names, such as `uploadpack` or `core.sshCommand`, runs before the
   person approves the command. When the remote HEAD is not recorded, it
   blocks and asks Claude to run `git remote set-head <remote> --auto` and
   retry. The guard fails closed: a client-side guard is a seatbelt behind
   server-side branch protection, so it denies what it cannot prove safe. A
   push it cannot map to a directory, remote, and refspecs is blocked with a
   request to run `git push <remote> <branch>` from the repository directory:
   one inside `bash -c` or another shell, `eval`, a `python`, `node`, `perl`,
   or `ruby` one-liner, command substitution (an unquoted heredoc included),
   `xargs`, `git subtree push`, or a wrapper with its own options; one through
   a git alias that is a shell command, is defined on the command line or
   earlier in the same command, or cannot be read (a plain `push` alias is
   checked like a push); one with a variable in its target or `-C`; one after a
   `cd` it cannot follow (any filesystem error counts) or a checkout that moves
   `HEAD` to a branch it cannot name; one with config overrides; and any
   command naming `push` that it fails to analyse, including one nested too
   deeply. `$(git branch --show-current)` and
   `$(git rev-parse --abbrev-ref HEAD)` resolve to the current branch, and a
   `cd` in a pipeline or background job does not move the later push. Dry runs
   pass, and `git push` inside an argument, a quote, a comment, or a quoted
   heredoc is text, not a push. Only unparsable hook input or a command
   without `push` passes on an internal failure. A `guard_default_branch` user
   option turns it off.

   Known gaps, accepted because branch protection on the remote is the
   guarantee and a complete shell parser is out of scope:
   - A branch created earlier in the same command (`git checkout -b x`) is
     assumed to exist, so if creating it fails, a later `git push origin HEAD`
     from the default branch is allowed. The same name is also applied to
     another repository reached with `-C`.
   - A wrapper with its own options in front of a quoted shell string
     (`sudo -u bot bash -c "..."`, `nice -n 10 sh -c '...'`, `env -i bash -c`,
     `xargs sh -c`, `trap '...' EXIT`), `bash script.sh`, `bash -c "$CMD"`, and
     external `git-<tool>` commands that push.
   - A stale `refs/remotes/<remote>/HEAD` after the default branch is renamed on
     the server, a fetch refspec that does not map names one to one, an alias
     that checks out a branch, `rebase`, `bisect`, or `symbolic-ref` moving
     `HEAD`, `CDPATH`, and `--recurse-submodules=on-demand`.
   - A command that touches many directories can exceed the hook timeout, and
     a hook killed by its timeout does not block.
   - It over-blocks `git push --help`, `git push . HEAD:main`, and a push after
     `cd "$(...)"` or `cd "$HOME/..."`; Claude is told to push explicitly.
3. **Playwright MCP stays conditional.** The plugin ships no `.mcp.json`:
   bundling it would start the server and add its tools to every session,
   against starting with one or two MCP tools per task. `verifying-change`
   keeps requiring it only for a user-visible web path and prints the pinned
   setup when it is missing.
4. **Unattended-run contract.** `developing-feature`, `fixing-bug`,
   `committing-change`, and `shipping-change` treat the invoking prompt as the
   only authorization when nobody can answer, record open decisions in the final
   report instead of waiting, and never merge, deploy, or release.
5. **Path-scoped lessons.** `capturing-lessons` names the concrete places a
   local rule goes: a nested instruction file of the same kind as the root
   (`CLAUDE.md` where the root is `CLAUDE.md`, since Claude Code then skips
   `AGENTS.md`), or `.claude/rules/<topic>.md` with
   `paths:` where the repository uses Claude Code rules.
6. **Per-skill eval report.** `scripts/eval-report.mjs` turns the eval JSON into
   a per-skill table of score, delta, regressions, and cases with no difference; the `evals`
   workflow writes it to the job summary.
7. **Templates.** `docs/templates/ci-fix-agent.yml` is a label-triggered,
   one-round CI fixer that stops at the pull request.
   `docs/measuring-agent-changes.md` defines the outcome metrics to track.

## Deferred

- **Deterministic review workflow.** A `workflows/review-pipeline.js` would make
  the review order a script. The documented `agent()` options (`schema`,
  `label`, `stallMs`) do not include choosing an agent type, so a workflow agent
  could not be limited to the read-only reviewers. Revisit when that option is
  documented.
- **Pruning skills.** Needs real eval runs; the report in change 6 is the input.

## Acceptance

- `pnpm test` and `pnpm check` pass; `claude plugin validate --strict` passes.
- Each behavior change has a regression test and an eval case.
- Every Claude Code-only component has its portable fallback named in the README.
