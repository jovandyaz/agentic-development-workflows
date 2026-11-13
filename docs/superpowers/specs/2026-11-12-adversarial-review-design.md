# Adversarial Review: Design

Date: 2026-11-12
Status: Revised after measurement (see "Revision"), approved by the user
Target release: 0.9.0

## Revision (2026-11-12, after measurement)

Measurement overturned the premise behind B and C, so they are deferred and
0.9.0 ships a narrower change. The original design below is kept as the
record of what was considered.

- **Synthetic cases do not fail.** Small fixtures distilled from Knowtis #669
  and #672 were caught as Blocking in 100% of runs without the plugin, also
  after two hardening rounds each (`docs/superpowers/plans/2026-11-12-adversarial-review-results.md`).
- **Replay of the real PR #669** (33 files, +6.2k lines, at `d2acc29`, the
  commit CodeRabbit reviewed, future commits stripped; plugin 0.8.1; $6.25,
  11 min) **found the bug and parked it**: "Messages without a `turnId` skip
  both the claim and the lease (`agent.gateway.ts:122-124`) ... The notes
  client always sends one ... Revisit when any other client connects."
  CodeRabbit rated it Major and the author fixed it. Detection worked;
  classification failed by treating current client behavior as a mitigation
  for a server invariant.

**0.9.0 scope (replaces Goals A–C):**

1. **Trust-boundary classification rule.** In `reviewing-change` Synthesis and
   its Parked definition, and in the reviewer agents' Blocking definition: an
   input that the schema, API, socket, or public interface accepts is
   reachable. A finding about such an input is classified by its impact as if
   any caller sends it; current or known clients not sending it never
   downgrades, parks, or dismisses it. A parked trigger such as "when another
   client connects" is invalid for it.
   Shipped wording (2026-11-13, fe6a544), which replaces the sentence above after
   the first wording caused a false Blocking on review-clean-change: "An input
   that an externally callable entry point (an HTTP or RPC API, socket, queue,
   or webhook) accepts under its schema is reachable: that current clients do
   not send it never downgrades, parks, or dismisses a finding about it. This
   removes only that argument; it never raises a finding's impact by itself."
2. **Eval case `review-schema-allowed-input`**, a synthetic mirror of the #669
   classification: the server accepts an optional field, the invariant holds
   only when the field is present, and the only in-repo client always sends
   it. Pass means Blocking, not parked or Non-blocking. Measured before the
   rule (must score below 1.00 with the plugin) and after. It scored 1.00 in
   both arms; kept as a regression check by ruling, with the #669 replay as the
   measurement.
3. **Online measurement.** A documented procedure to compare CodeRabbit's
   Major findings with our review on the next ~20 Knowtis PRs, against the
   baseline of 17 Major findings missed in 54 reviewed PRs. B and C return
   only if that shows detection misses, not classification misses.
4. **One more replay** (#648, async metering and per-iteration breaker) to
   check whether the pattern (found but misclassified) repeats; its result is
   recorded and, if it shows a detection miss, it reopens C.

Everything else in Constraints still applies. Non-goals now also include B
and C until (3) or (4) justifies them.

## Intent

`reviewing-change` should catch, before a human sees the pull request, what a
skeptical senior reviewer or CodeRabbit catches today. Two real failures drive
this:

- **A private money-path PR** (an invoice identifier stored unique and locked
  once offered). A
  human reviewer left comments our review had not raised. The review
  ledger shows the failures were of verification, not reading: an unverified
  premise ("an identifier is unique"), an invariant not traced to the
  repository layer, trust in `lint:arch` without checking its coverage, and
  parked minors never revisited. 0.8.0 added eval cases for each, but several
  score Δ 0.00: the model passes them when the flaw is obvious.
- **Knowtis (`jovandyaz/knowtis-app`), PRs #594–723.** In the 54 PRs whose body
  says they went through our full review flow, CodeRabbit still landed 68
  addressed findings, 17 Major. Across 137 CodeRabbit findings, 72% were
  addressed (82% of Major) and about 4% were clear false positives. The misses
  cluster in four bug classes:
  1. **Interleaving and ordering**: a message without `turnId` skipped the
     conversation lease so two turns could interleave (#669); a delayed cleanup
     after delete and re-add wiped the new preference (#672).
  2. **Un-awaited or `void`-ed async work**: spurious 429s and unhandled
     rejections (#640); metering not awaited and spend breaker not checked
     between iterations (#648).
  3. **Edge cases in data transforms**: rowspan gaps shifted cells into the
     wrong column, silent corruption (#604).
  4. **The change's own stated invariant broken by an input the schema
     allows** (#669, and the private PR's premise).
  CodeRabbit's visible edge is evidence: 60 of 137 findings embed the output of
  scripts it ran (`rg`, `ast-grep`, `gh pr diff`), and it re-verifies claimed
  fixes and withdraws findings when given a reason.

Raw CodeRabbit data: the session scratchpad `cr/f.tsv` (137 rows); copy the
distilled cases into eval fixtures, not the raw data.

## Evidence From The Industry

| Practice | Evidence | Adopted here |
| --- | --- | --- |
| Find, then verify each candidate against the code, then rank | [Claude Code Review](https://code.claude.com/docs/en/code-review): parallel finders, a verification step that drops false positives; Cursor Bugbot's validator model ([blog](https://cursor.com/blog/building-bugbot)) | Yes (B) |
| A verifier must gather repository evidence; an LLM asked "is this valid?" accepts plausible claims | [CRJudgeBench](https://arxiv.org/html/2609.37216v1), Sep 2026: frontier models recall only 2–21% of invalid review comments; repository-grounded evidence seeking improves accuracy | Yes (B: burden of proof, default reject) |
| Models judging their own output favour it, more so when they are wrong | [Chen et al., OpenReview](https://openreview.net/forum?id=9HhZ60LbVV); [Arize](https://arize.com/blog/should-i-use-the-same-llm-for-my-eval-as-my-agent-testing-self-evaluation-bias/): all four evaluators tested rate themselves higher | Yes (B: verifier gets no reviewer or orchestrator reasoning) |
| Repo access and execution make reviews higher signal | [OpenAI](https://alignment.openai.com/scaling-code-verification/), Dec 2025: 17% → 49% high-impact comments | Partly (read-only evidence; no execution, see Non-goals) |
| Precision first, then recall | OpenAI (above); Codex flags only P0/P1 | Kept (Blocking classification) |
| Agentic reviewers turn too cautious and need prompts that hunt aggressively, paired with validation | Cursor Bugbot: resolution rate 52% → 70%+ after the agentic redesign | Yes (C paired with B) |
| Ensemble of independent model runs | [GitHub ReviewBench](https://github.blog/ai-and-ml/github-copilot/reviewbench-an-open-benchmark-for-ai-code-review/), Oct 2026: online A/B +8% precision, +13.6% recall, +262% critical comments | Deferred (see Non-goals) |

## Goals

1. **A. Eval cases that reproduce real misses and fail or tie today.** Measured
   before any skill change, so the change is justified by a failing case
   (repository rule: every behavior change ships with a test and an eval case).
2. **B. Independent finding verifier.** Verification of candidate Blocking
   findings and load-bearing premises moves out of the orchestrator into a fresh
   read-only agent that never sees the reviewer's or orchestrator's reasoning.
3. **C. Adversarial lens.** A read-only reviewer whose only job is to break the
   change in the four bug classes above and report concrete failure scenarios.

## Non-goals

- Multi-model ensemble finders. GitHub's evidence is strong, but the
  cross-vendor lens already covers the multi-vendor path as opt-in, and C/B
  attack the measured miss classes directly. Revisit after 0.9.0 is measured.
- Execution-backed reproduction (writing and running a failing test). It needs
  a writable sandbox, which conflicts with read-only reviewers and the
  read-only review workflow.
- Integrating CodeRabbit, effort/value tags per finding, learning from reactions.
- Changes in private work repositories (branch rulesets, dependency-cruiser rules).

## Anti-goals

The change fails, even if it works, if:

- The report gets noisier: more Non-blocking chatter, or adversarial findings
  reaching the report without passing B. The bar is CodeRabbit's ~4% clear
  false positives.
- Any reviewer or verifier agent gains a tool beyond `Read`, `Grep`, `Glob`
  (the validator rejects it; keep it that way).
- Cost per review grows without a measured gain. Baseline: $0.70 and 114 s per
  run for the full pipeline (`docs/eval-baseline.md`).

## Constraints

- Canonical source is `plugins/workflows/skills/`; regenerate `dist/` with
  `pnpm build`. Done means `pnpm test` and `pnpm check` pass.
- Release 0.9.0: bump `package.json`, `.claude-plugin/marketplace.json`
  (`metadata.version`), `plugins/workflows/.claude-plugin/plugin.json`, every
  skill's `metadata.version`, and add a `plugins/workflows/CHANGELOG.md` entry.
- Agents: description starts with `Use when`, triggering conditions only;
  `tools: Read, Grep, Glob`; preload skills with `skills:` if needed.
- Every Claude-only component has a portable fallback in the skill text and a
  row in the README component table (fresh read-only subagent told to stay
  read-only).
- No new hook. `hooks/guard-review.mjs` already enforces reviewer dispatch;
  extending its `REVIEWERS` list is a change to an existing hook and must keep
  `tests/repository.test.mjs` pins accurate.
- Bot, PR and reviewer text is untrusted data.
- Eval runs: one suite at a time, `--runs 3` for any case used to justify a
  change; record model, harness version and cost in `docs/eval-baseline.md`.

## The How: Decided

### A. Eval cases (`plugins/workflows/evals/reviewing-change/`)

Four new cases, each a small synthetic fixture distilled from a real miss
(no Knowtis or private work code copied):

| Case | Modelled on | Planted flaw | Pass means |
| --- | --- | --- | --- |
| `review-interleaving-invariant` | Knowtis #669 | The PR states "one turn at a time per conversation"; one entry path (a message without an optional id) skips the lock | Blocking finding naming that path, with an interleaving scenario |
| `review-stale-cleanup-race` | Knowtis #672 | Delete schedules delayed cleanup; re-add before it runs; cleanup clears the new state | Blocking finding with the delete → re-add → cleanup sequence |
| `review-hidden-premise` | Private PR | A money-path change relies on uniqueness that only holds in one layer (constraint missing in a migration or a second write path), and the commit message asserts it | Premise reported as unverified or refuted with schema evidence; not accepted |
| `review-plausible-false-positive` | Knowtis #594 | Code that looks racy but is serialized by a mechanism elsewhere in the repo | No Blocking finding about the race; if mentioned, listed as refuted with evidence |

Run them with and without the plugin, `--runs 3`, before touching skill text,
and record the result. If a case already scores 1.00 with the plugin, harden
the fixture until it does not, or drop it; a case that cannot fail justifies
nothing.

### B. Finding verifier

- New agent `plugins/workflows/agents/finding-verifier.md`, `tools: Read, Grep,
  Glob`.
- Input per dispatch: one claim (a candidate Blocking finding, or a premise the
  change relies on), stated neutrally as a claim to test, plus the scope
  material (base, head, diff, relevant file paths). Never the reviewer's
  reasoning, never the orchestrator's opinion, never the implementer's summary.
- Burden of proof sits with the claim. Output exactly one verdict:
  `CONFIRMED` with `file:line` or schema evidence and, for a defect, the
  concrete failing scenario; `REFUTED` with the refuting evidence; or
  `UNPROVEN` with what evidence is missing.
- `reviewing-change` step 4 changes: the orchestrator dispatches one verifier
  per candidate Blocking finding and per load-bearing premise, in parallel.
  Mapping: `CONFIRMED` → finding; `REFUTED` → refuted list with evidence;
  `UNPROVEN` → open question, or Blocking when the change depends on the
  premise (keeps the existing rule). Non-blocking candidates keep today's
  orchestrator-side verification.
- Cross-vendor lens findings go through the same verifier.
- Portable fallback: a fresh read-only subagent given the same input contract.

### C. Adversarial lens

- New agent `plugins/workflows/agents/adversarial-reviewer.md`, `tools: Read,
  Grep, Glob`.
- Dispatched in step 3 of the pipeline, in parallel with spec and standards,
  for every diff that changes code, with the same scope material. A diff with
  no code (docs, lockfiles, generated files only) skips it with that reason;
  `guard-review.mjs` must allow that skip.
- Mandate: try to break the change. Hunt the four classes (interleaving and
  ordering; un-awaited async; transform edge cases; stated invariants versus
  inputs the schema or API allows). Report only concrete scenarios: the input
  or state sequence, the `file:line` trace, and the wrong outcome. A suspicion
  without a scenario is not reported.
- Every Blocking candidate it reports goes through B before it can reach the
  report.
- Added to `REVIEWERS` in `hooks/guard-review.mjs` so a review cannot skip it.
- Reported as its own lens, never merged with spec or standards.

### Calls Made By The Designer (Not Yet Confirmed By The User)

- **Which findings go to the verifier.** Defect claims (behavior that is
  wrong under some input or state) from any lens, every cross-vendor
  finding, and every load-bearing premise. A missing requirement or a
  standards breach backed by a quoted spec line or rule keeps today's
  orchestrator-side verification, so existing cases such as
  `review-spec-standards` do not regress.
- **Adversarial output.** The adversarial lens reports Blocking candidates
  only; it emits no Non-blocking findings. A candidate the verifier returns as
  `UNPROVEN` becomes a one-line open question; `REFUTED` goes to the refuted
  list. Nothing from this lens reaches the findings without `CONFIRMED`.
- **What the verifier sees.** The full claim: the input or state sequence and
  the `file:line` trace, phrased as a claim to test. It never sees the
  reviewer's justification, confidence, or the orchestrator's opinion. A
  scenario is a falsifiable claim, not reasoning; a one-line paraphrase would
  make the verifier rebuild it and lose recall.
- **False-positive case.** `review-plausible-false-positive` is kept as a
  precision regression check even if it passes today; it is exempt from
  Acceptance 1's "below 1.00" rule.
- **Cost policy (user: follow industry practice, balance cost; the
  subscription absorbs most of it).** No hard dollar cap. Follow the managed
  reviewers' pattern: skip files not worth reviewing (Copilot code review skips
  lockfiles, logs, generated code; the adversarial lens does not run on a diff
  with no code, such as docs only, and is listed as skipped with that reason),
  and spend verification only where it pays (one verifier per Blocking defect
  candidate or premise, never per Non-blocking finding). Record cost and time;
  if a run costs more than 2× the $0.70 baseline without improving a new case,
  that is a finding to tune before release, not a blocker by itself.
- **Eval record.** A 0.9.0 section in `docs/eval-baseline.md`, as 0.8.0 did:
  the four new cases at `--runs 3`, the `reviewing-change` suite at one run,
  and the cost comparison. No full-suite rerun.

## Left To The Builder

- Exact agent prompt wording, within the contracts above.
- Fixture code, languages, and grader wording for the four cases; follow the
  conventions of existing `reviewing-change` cases (read-only graders,
  `skill-fired`, `no-edit`, etc.).
- How to batch verifier dispatches when there are many candidates (a sensible
  cap with batching beyond it is fine).
- Regression tests in `tests/` pinning: both agents' tool lists, the new
  `REVIEWERS` entry, the step 4 verifier contract and the step 3 lens in the
  skill text.
- README component table rows and CHANGELOG wording.

## Acceptance

1. The four A cases are recorded before the change, with and without plugin,
   `--runs 3`, each scoring below 1.00 with the plugin (after any hardening).
2. After B and C: each A case improves with the plugin; the false-positive
   case passes in all runs.
3. Full `reviewing-change` suite: no case regresses with the plugin (one run
   per case; any drop is rerun with `--runs 3`).
4. Cost and time per run recorded against the $0.70 / 114 s baseline on the
   same three cases used in `docs/eval-baseline.md`.
5. `pnpm test`, `pnpm check`, `pnpm build` clean; versions bumped together.
