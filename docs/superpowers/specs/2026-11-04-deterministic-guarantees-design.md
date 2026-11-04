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
   `hooks/guard-push.mjs` on every Bash call and exits 2 for a push whose target
   is the remote's default branch, `--all`, or `--mirror`. It never blocks on its
   own failure. A `guard_default_branch` user option turns it off.
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
