# Adversarial review results

## Before

Claude Code 2.1.300 (`claude plugin eval`), workflows plugin 0.8.1, 3 runs per arm, `--no-publish`.
The aggregate result records no model id; the eval CLI default model was used. The judge is the
CLI's built-in LLM judge (3 votes per grader, about $0.0005 per grader). Scores are per run,
detection grader first.

Both detection graders passed 3/3 votes in every run, in both arms, across the original fixture
and two hardening attempts each. Run scores below 1.00 come only from the `no-bash-write`
guard (the reviewer ran a Bash command that wrote), which is unrelated to detection.

| Case / fixture | With plugin (runs) | Mean | Without plugin (runs) | Mean | Cost (6 runs) |
|---|---|---|---|---|---|
| review-interleaving-invariant, original | 1.00, 0.80, 0.80 | 0.87 | 0.80, 1.00, 0.80 | 0.87 | $3.59 |
| review-interleaving-invariant, hardening 1 (split into run.js/resume.js) | 1.00, 0.80, 1.00 | 0.93 | 0.80, 0.80, 0.80 | 0.80 | $3.68 |
| review-interleaving-invariant, hardening 2 (lease picked by `runnerFor`) | 0.80, 0.80, 1.00 | 0.87 | 1.00, 1.00, 1.00 | 1.00 | $3.82 |
| review-stale-cleanup-race, original | 1.00, 1.00, 1.00 | 1.00 | 1.00, 1.00, 1.00 | 1.00 | $3.22 |
| review-stale-cleanup-race, hardening 1 (cleanup helper in its own file) | 1.00, 1.00, 1.00 | 1.00 | 1.00, 1.00, 1.00 | 1.00 | $3.27 |
| review-stale-cleanup-race, hardening 2 (generic job queue + handler table) | 1.00, 1.00, 1.00 | 1.00 | 1.00, 1.00, 1.00 | 1.00 | $3.09 |

## Outcome

Neither case discriminates: the current plugin, and even the no-plugin baseline, report both
flaws as Blocking every time. Per the task rule (two hardening attempts still at 1.00 on detection),
both cases are dropped and not committed. Their fixtures and graders are kept outside the repo.
The detection target needs a harder flaw class before it can justify the new review agents.

## Before - review-schema-allowed-input

Claude Code 2.1.300 eval CLI (host `claude` 2.1.323), workflows plugin 0.8.1, 3 runs per arm, `--no-publish`.
Fixture: 11 source files on `feat/turn-resume` (6 commits), client always sends `turnId`.
Detection grader `blocking-not-parked` judge votes were PASS PASS PASS in all 12 runs.

| Fixture | With plugin (runs) | Mean | Without plugin (runs) | Mean | Cost (6 runs) |
|---|---|---|---|---|---|
| original (`withTurnClaim` in one file) | 1.00, 1.00, 1.00 | 1.00 | 1.00, 1.00, 1.00 | 1.00 | $4.58 |
| hardening 1 (split into turn-runner.js/turn-claim.js, plus a leased `retryLast` path) | 1.00, 0.80, 1.00 | 0.93 | 1.00, 1.00, 1.00 | 1.00 | $5.47 |

The 0.80 is the unrelated `no-bash-write` guard. The case does not discriminate on the synthetic
fixture (1.00 in both arms), so it is kept as a regression check and is not the proof. The
measurement is the real-PR replay of Knowtis #669 below.

## After

Real-PR replay of Knowtis #669 (33 files, +6.2k lines; head d2acc29), Claude Code 2.1.323, model
`claude-opus-5-5`, two runs per arm: a strong direction, not a settled result. CodeRabbit Major: a
message without `turnId` skips the conversation lease. Fixture code stays private.

| Run | Plugin | Classification of the finding | Cost |
| --- | --- | --- | ---: |
| before 1 | 0.8.1 | found, Parked | $6.25 |
| before 2 | 0.8.1 | found, Non-blocking | $7.28 |
| after 1 | first wording | Blocking | $4.90 |
| after 2 | first wording | Blocking (found by 3 reviewers) | $7.39 |

Before: 0/2 Blocking. After: 2/2 Blocking. Method and the #648 detection miss are in
`docs/measuring-review-against-coderabbit.md`.

### After, narrowed rule (fe6a544)

The first wording over-reached: `review-clean-change` scored 0.83 x3 with a judge FAIL (pre-rule
47b2b92: 1.00 x3), escalating a theoretical overflow in an exported in-process function. The rule
now covers only externally callable entry points and never raises impact.

| Run | Plugin | Result | Cost |
| --- | --- | --- | ---: |
| review-clean-change x3 | narrowed | 1.00, 1.00, 1.00 | $2.31 |
| review-schema-allowed-input x1 | narrowed | 1.00 | $1.48 |
| #669 replay 1 | narrowed | Blocking | $6.15 |
| #669 replay 2 | narrowed | Blocking | $6.19 |

#669 overall: before 0/2 Blocking; first wording 2/2; narrowed 2/2.
