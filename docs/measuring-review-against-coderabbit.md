# Measuring Review Against CodeRabbit

Synthetic eval cases did not discriminate (even the no-plugin baseline caught
every planted flaw); real PRs did. This page records how we compare our review
flow with CodeRabbit on real PRs.

## Baseline
Knowtis PRs #594-723: CodeRabbit left 137 findings, 72% were addressed, and 82%
of its 34 Major findings were addressed. In the 54 PRs also reviewed by our
flow, 68 CodeRabbit findings were still addressed, 17 of them Major.

## Procedure for the next ~20 PRs
For each CodeRabbit Major, find it in our review report and record one outcome:

- missed: not listed (detection miss)
- found but parked or Non-blocking, though addressed (classification miss)
- found as Blocking (no gap)

## Decision rule
- Detection misses reopen the adversarial lens and finding verifier from the
  2026-11-12 design (a separate 0.10.0 iteration).
- Classification misses go to the Synthesis rules in `reviewing-change`.

## Replay method
1. Clone the repository at the commit CodeRabbit reviewed.
2. Delete every other ref and the remote, then `git gc --prune=now`.
3. Strip CodeRabbit notes and post-fix sentences from the PR body.
4. Run headless `claude -p "/workflows:reviewing-change ..."` (read-only
   allowlist, budget cap); for an unreleased plugin use `--plugin-dir` and
   confirm the Skill result contains the new rule text.

Claude Code 2.1.323, `claude-opus-5-5`. Fixture code stays private.

## Result: PR #669 (33 files, +6.2k lines)

CodeRabbit Major: a message without `turnId` skips the conversation lease.

| Run | Plugin | Classification | Cost |
| --- | --- | --- | ---: |
| before 1 | 0.8.1 | Parked ("notes client always sends one") | $6.25 |
| before 2 | 0.8.1 | Non-blocking | $7.28 |
| after 1 | first wording | Blocking | $4.90 |
| after 2 | first wording | Blocking (3 reviewers) | $7.39 |
| narrowed 1 | 0.9.0 | Blocking | $6.15 |
| narrowed 2 | 0.9.0 | Blocking | $6.19 |

Two runs per arm: a strong direction, not a settled result.
The first wording ("schema, API, socket, or public interface ... as if any
caller sends it") over-reached: `review-clean-change` fell from 1.00 to 0.83
with a judge FAIL at three runs, because the review escalated a theoretical
overflow in an exported in-process function. The rule now covers only
externally callable entry points (HTTP/RPC API, socket, queue, webhook) and
removes only the "current clients don't send it" argument, never raising impact.
Re-measured: `review-clean-change` 1.00 x3, #669 still 2/2 Blocking.

## Result: PR #648 (70 files)
Before only, plugin 0.8.1, $6.64. A detection miss: both CodeRabbit Majors were
missed (an un-awaited `recordSideCost` and a spend breaker checked only before
the batch). It reopens the adversarial lens (0.10.0). Our two extra Blocking
findings were real but low impact; the tools are complementary.
