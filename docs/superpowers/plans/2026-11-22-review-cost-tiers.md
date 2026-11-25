# Review Cost Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut review cost without weakening review of risky changes: run less on
documentation-only changes, stop fix loops that chase one bypass after another,
keep lockfiles and generated files out of reviewer prompts, and document how to
tier models without pinning them in the plugin.

**Architecture:** Skill text, tests and eval cases, plus one docs note. No new
hook and no hook change: the three reviewer agents still run on every review, so
`guard-review.mjs` stays as it is. Depth only decides whether stage 2
(Superpowers review) runs.

**Tech Stack:** Markdown skills, Node test runner (`tests/*.test.mjs`),
`claude plugin eval` cases (`case.yaml`, `prompt.md`, `fixture.sh`,
`graders/*.md`), pnpm.

**Spec:** the findings report `adw-plugin-findings-2026-11-22.md` (pialy
orchestration), triaged on 2026-11-22. The user chose option A with these
changes: depth is decided by path and change type, never by size alone (#1);
lockfiles and `linguist-generated` files are excluded (#5); recommendation #3
becomes a docs note only, because `docs/model-strategy.md` rule 3 and
`tests/repository.test.mjs:422` keep model names out of the plugin. Evidence:
Meta RADAR, Qodo and Cortex (sensitive paths outrank size), Contrast Security
(the same finding in two consecutive rounds means the loop is not converging),
the "Is Three the Magic Number?" repair-loop study (most of the gain comes in
the first 3–4 rounds), and Copilot, CodeRabbit and Graphite (lockfiles and
generated files are excluded by default).

## Global Constraints

- Branch `feat/review-cost-tiers` from `main` (`71cf115`, v0.9.0). Never push to `main`.
- `plugins/workflows/skills/` is canonical; never edit `dist/`; regenerate with `pnpm build`.
- Done means `pnpm test` and `pnpm check` pass.
- Every behavior change ships with a regression test in `tests/` and an eval case in
  `plugins/workflows/evals/<skill>/`.
- Skills and agents set no `model:` or `effort:` (`tests/repository.test.mjs:422`).
- Reviewer agents list only `Read`, `Grep`, `Glob`. Name no model or project in skill text.
- No new hook. `guard-review.mjs` keeps requiring all three reviewer agents.
- Release version `0.10.0` in `package.json`, `.claude-plugin/marketplace.json`
  (`metadata.version`), `plugins/workflows/.claude-plugin/plugin.json`, every skill's
  `metadata.version`, and a new `plugins/workflows/CHANGELOG.md` entry.
- Commits: single-line Conventional Commit, English, imperative, ≤72 chars, no body, no trailers.

## Out Of Scope (decided)

- #3 pinning `model:` on agents (docs note only, Task 4).
- #4 concurrency limits and token budgets: they belong to the orchestrator, and
  Ramp Labs measured agents ignoring budgets written into the prompt.
- #6 promoting the cross-vendor lens: it stays opt-in because it sends code to another vendor.
- #7: the `.superpowers` write refusal and the `aws-secrets-manager` hook belong to other
  plugins. The `guard-push` `$(...)` behavior needs its own repro before any change.
- Narrowing later rounds to the fix diff only: not requested, and the risk is not measured.

## Review Focus

1. A small change to an auth, money or schema file classified Low because it is small → must be full depth.
2. A test-only change classified Low (weakened tests hide bugs) → must be full depth.
3. A dependency-upgrade PR whose subject is the lockfile → the lockfile stays in the diff text.
4. A recurring finding with a different file or symptom but the same cause → still a recurring class.
5. Round count restarting when `fixing-bug` calls `verifying-change` → count continues.

Items 1, 2 and 3 are pinned by exact text in the Task 1 and Task 3 tests. Item 4 is
pinned by the Task 2 eval, and item 5 by the Task 2 text test.

---

### Task 1: Review depth by change type

**Files:**
- Modify: `plugins/workflows/skills/reviewing-change/SKILL.md` (new `## Review Depth` after `## Scope`; Synthesis report list)
- Test: `tests/workflows.test.mjs`
- Create: `plugins/workflows/evals/reviewing-change/review-low-depth/` (`case.yaml`, `prompt.md`, `fixture.sh`, `graders/`, `superpowers-stub/` copied from `review-clean-change`)
- Modify: `plugins/workflows/evals/reviewing-change/review-clean-change/graders/` (add `superpowers-review-ran.md`)

**Interfaces:**
- Produces: the terms "Low depth" and "Full depth", which the Task 3 exclusion text and the CHANGELOG use.

- [ ] **Step 1: Write the failing test** `test("review depth follows what the change touches, never its size", …)` on `normalizedSkill("reviewing-change")`, asserting these exact sentences:
  - `/Pick the review depth from what the change touches, never from its size: a small diff can carry the highest risk\./`
  - `/\*\*Low\*\*: every changed file is documentation or code comments only\. Skip stage 2, Superpowers review; the three reviewer lenses still run\./`
  - `/\*\*Full\*\*: every other change, including test-only changes and any change to money, authentication, authorization, data or schema, or a public API\. Run every stage\./`
  - `/When unsure, use Full\./`
  - `/An explicit request for a stage runs it at any depth\./`
  - `/the review depth and its reason/` (in the Synthesis report list)
  - and that the existing `/Dispatch them for every diff, whatever its size; never run a lens inline/` still matches.
- [ ] **Step 2:** `node --test tests/workflows.test.mjs` → the new test FAILS.
- [ ] **Step 3:** Add the `## Review Depth` section with the sentences above, and add "the review depth and its reason" to the Synthesis report list, before "lenses executed and any skipped with the reason". In stage 2, state that it is skipped at Low depth and listed as skipped with the reason "Low depth".
- [ ] **Step 4:** `node --test tests/workflows.test.mjs` → PASS.
- [ ] **Step 5: Eval `review-low-depth`.** `fixture.sh`: on `main`, an `AGENTS.md`, `src/orders.ts` and a `README.md`; on branch `docs/readme-usage`, one commit that edits only `README.md` (fixes the usage section). `prompt.md` (same frontmatter as `review-clean-change`, description "Review of a documentation-only change runs the three lenses and skips the Superpowers review as Low depth."): "Review my branch `docs/readme-usage` against `main` before I merge it." Graders: copy `skill-fired`, `no-edit`, `no-write`, `no-bash-write`, `no-new-files`, and the three `*-agent.md` from `review-readonly-agents`; add `superpowers-review-skipped.md` (`type: tool_used`, `tool: Skill`, `input_match: '"skill"\s*:\s*"(?:[\w-]+:)?requesting-code-review"'`, `min: 0`, `max: 0`) and `depth-reported.md` (`type: llm`: PASS if the review reports Low depth because only documentation changed and lists the Superpowers review as skipped for that reason; FAIL otherwise).
- [ ] **Step 6: Regression guard on a money change.** Add `review-clean-change/graders/superpowers-review-ran.md` (`type: tool_used`, `tool: Skill`, same `input_match`, `min: 1`). The refund change must stay at Full depth.
- [ ] **Step 7:** `pnpm test && pnpm check` → PASS (the validator accepts the new case).
- [ ] **Step 8:** `git commit -m "feat(review): skip the Superpowers review for documentation-only changes"`

### Task 2: Converge recurring findings and count rounds once

**Files:**
- Modify: `plugins/workflows/skills/reviewing-change/SKILL.md` (`## Review Rounds`)
- Modify: `plugins/workflows/skills/{developing-feature,fixing-bug,verifying-change,shipping-change}/SKILL.md` (the round-cap sentence)
- Test: `tests/workflows.test.mjs` (`review-fix loops stop after three rounds and report` at :188, the four exact-text assertions at :597–614)
- Create: `plugins/workflows/evals/reviewing-change/review-recurring-class/`

- [ ] **Step 1: Update and add failing tests.**
  - In the four loop skills, `for at most three review rounds` becomes `for at most three review rounds counted across the whole workflow`. Update the regex at :190 and the four long regexes at :597–614 to match.
  - New `test("a finding that recurs in consecutive rounds is fixed as a class", …)` on `reviewing-change`:
    - `/When a round confirms a Blocking finding with the same cause as one the previous round fixed, such as another input that bypasses the same check, report it as a recurring class\./`
    - `/Its smallest safe fix covers the whole class with one rule, not the new instance\./`
    - `/If no fix covers the class, stop the loop and report the class, the fixes attempted, and the residual risk\./`
- [ ] **Step 2:** `node --test tests/workflows.test.mjs` → the updated and new tests FAIL.
- [ ] **Step 3:** Add the three sentences to `## Review Rounds` and the "counted across the whole workflow" wording to the four skills.
- [ ] **Step 4:** `node --test tests/workflows.test.mjs` → PASS.
- [ ] **Step 5: Eval `review-recurring-class`.**
  - `fixture.sh`: `AGENTS.md` says "No phone number reaches the logs."
  - On `main`, `src/redact.ts` exports `redact(line: string): string`, which replaces `/\d{10}/g` with `[phone]`.
  - Branch `fix/redact-phones`, commit 1 `fix: redact phone numbers written with dashes` adds `\d{3}-\d{3}-\d{4}`. Commit 2 `fix: redact phone numbers written with dots` adds `\d{3}\.\d{3}\.\d{4}`.
  - Also write `docs/review-round-1.md`: Blocking, "phone numbers with dashes bypass redaction", fixed by commit 1.
  - `prompt.md`: "This is review round 2 of my fix loop for branch `fix/redact-phones` against `main`. Round 1's report is `docs/review-round-1.md`; commit 2 fixes the dots case that round 1's fix missed."
  - Graders: the copied read-only set plus `skill-fired`, and `class-fix.md` (`type: llm`). It passes if the review reports that numbers with spaces or parentheses still bypass redaction, identifies it as the same cause as the round-1 finding, and proposes one class-level rule (for example normalizing or matching any separators between digit groups) instead of adding another separator. It fails if it proposes only another pattern for the new separator or misses the remaining bypass.
- [ ] **Step 6:** `pnpm test && pnpm check` → PASS.
- [ ] **Step 7:** `git commit -m "feat(review): fix recurring findings as a class and count rounds once"`

### Task 3: Keep lockfiles and generated files out of the diff text

**Files:**
- Modify: `plugins/workflows/skills/reviewing-change/SKILL.md` (`## Ordered Review Pipeline`, after the scope-material paragraph)
- Test: `tests/workflows.test.mjs`
- Create: `plugins/workflows/evals/reviewing-change/review-lockfile-excluded/`

- [ ] **Step 1: Write the failing test** `test("reviewers get no lockfile or generated diff text", …)`:
  - `/Leave lockfiles and files that `\.gitattributes` marks `linguist-generated` or `linguist-vendored` out of the diff text, and list each by path with its changed-line count\./`
  - `/git check-attr linguist-generated linguist-vendored/`
  - `/Keep a file in the diff text when the requirements are about it, such as a dependency upgrade's lockfile\./`
  - `/Reviewers can still read a left-out file\./`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add the paragraph. Give `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `uv.lock`, `Cargo.lock`, `poetry.lock` as examples, not as a closed list.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Eval `review-lockfile-excluded`.**
  - `fixture.sh`: on branch `feat/order-total`, one commit changes `src/orders.ts` (adds `total()`). It also rewrites `pnpm-lock.yaml`, about 300 lines, every entry carrying the token `LOCKMARKER`. It adds `src/generated/schema.ts`, carrying `GENMARKER`, which `.gitattributes` marks `src/generated/** linguist-generated=true`.
  - `prompt.md`: "Review my branch `feat/order-total` against `main`."
  - Graders: the copied read-only set plus `skill-fired`.
  - `no-lock-text.md`: `type: tool_used`, `tool: Agent`, `input_match: 'LOCKMARKER'`, `min: 0`, `max: 0`.
  - `no-generated-text.md`: the same with `GENMARKER`.
  - `excluded-listed.md`: `type: llm`. PASS if the review names `pnpm-lock.yaml` and `src/generated/schema.ts` as left out of the reviewed diff.
- [ ] **Step 6:** `pnpm test && pnpm check` → PASS.
- [ ] **Step 7:** `git commit -m "feat(review): leave lockfiles and generated files out of the diff text"`

### Task 4: Model-tiering note, release 0.10.0, eval run

**Files:**
- Modify: `docs/model-strategy.md` (after rule 3)
- Modify: version files listed in Global Constraints; `plugins/workflows/CHANGELOG.md`; `dist/` via `pnpm build`
- Modify: `docs/eval-baseline.md` only if the full eval run is done before release

- [ ] **Step 1:** Add to rule 3 in `docs/model-strategy.md`: "To run cheaper reviewers, tier models where the person running the session controls them: user-level agent definitions (for example a re-reviewer on a cheaper model) or the runtime's subagent model setting. Dispatch by role. Do not pin models here." No test change is needed, because `tests/repository.test.mjs:422` already pins the no-`model:` rule.
- [ ] **Step 2:** Bump every version location to `0.10.0`. Add a CHANGELOG `## [0.10.0] - <date>` entry listing the Task 1–3 behaviors and the docs note.
- [ ] **Step 3:** `pnpm build && pnpm test && pnpm check` → PASS, and `dist/` has no further diff after the build.
- [ ] **Step 4: Eval, run on Linux or with Homebrew git (see CONTRIBUTING.md).** Run each case with `pnpm run eval -- --case <name> --runs 1 --ablation none` for `review-low-depth`, `review-recurring-class`, `review-lockfile-excluded` and `review-clean-change`. Report results faithfully; a failed grader blocks the release. This step bills the user's account, so ask before running it.
- [ ] **Step 5:** `git commit -m "docs: tier reviewer models by role outside the plugin"` then `git commit -m "chore: release 0.10.0"`
