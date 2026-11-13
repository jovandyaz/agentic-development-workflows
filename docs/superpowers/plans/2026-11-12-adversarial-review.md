# Trust-Boundary Review Rule Implementation Plan (revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `reviewing-change` from parking or downgrading a finding about an input the schema or API accepts just because current clients do not send it, proven by an eval case that fails today.

**Architecture:** One classification rule added to the Synthesis and Parked text of `reviewing-change` and to the shared Blocking definition in the three reviewer agents; one synthetic eval case mirroring the Knowtis #669 replay; a documented online measurement against CodeRabbit; release 0.9.0.

**Tech Stack:** Markdown skills and agents, `node --test`, `claude plugin eval` (Claude Code 2.1.300), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-12-adversarial-review-design.md` (section "Revision" is binding; the original Goals A–C are superseded).

## Global Constraints

- Canonical source is `plugins/workflows/`; never edit `dist/`; regenerate with `pnpm build`. Done means `pnpm test` and `pnpm check` pass. pnpm only.
- Agents keep `tools: Read, Grep, Glob`; bodies wrap at 80 columns.
- No new hook, no new agent.
- Commits: single-line Conventional Commit, imperative, ≤72 chars, no body, no trailers. Local commits on `feat/adversarial-review` are authorized; no push or PR.
- Eval runs: `pnpm run eval --case <name> --runs 3 --no-publish` (no `--` before `--case`: it runs the whole suite); one run at a time; Homebrew git first on `PATH`.
- Release 0.9.0: `package.json`, `.claude-plugin/marketplace.json` (`metadata.version`), `plugins/workflows/.claude-plugin/plugin.json`, every skill's `metadata.version`, `plugins/workflows/CHANGELOG.md`, all together.
- Fixtures are synthetic; copy no Knowtis or private work code.

## Review Focus

1. **A finding about an internal-only function** (not reachable from any schema or API): the rule must not inflate it to Blocking. The rule text scopes itself to inputs a schema, API, socket, or public interface accepts. Pinned in Task 2 (skill text test asserts the scope words).
2. **A legitimately parked Non-blocking finding with a real trigger** (e.g. "if a second writer appears"): still parkable. Pinned by the existing `review-parked-trigger` case in Task 3's suite run.
3. **A clean change** with an optional field that is handled correctly: no invented Blocking. Pinned by `review-clean-change` in Task 3's suite run.

---

### Task 1: Eval case `review-schema-allowed-input`

**Files:**
- Create: `plugins/workflows/evals/reviewing-change/review-schema-allowed-input/{case.yaml,prompt.md,fixture.sh,superpowers-stub/,graders/}` — layout, front matter, stub and read-only graders (`skill-fired`, `no-edit`, `no-write`, `no-bash-write`, `no-new-files`) copied verbatim from `review-unverified-premise/`.
- Modify: `docs/superpowers/plans/2026-11-12-adversarial-review-results.md` (append "Before" for this case)

**Interfaces:**
- Produces: case `review-schema-allowed-input`; grader `graders/blocking-not-parked.md`.

- [ ] **Step 1: Write the fixture.** Node ESM, `node --test`. Size it like a real feature, not a toy: about 8–12 source files on the branch so the flaw is one path among many.
  - `main`: `src/socket/schema.js` validating `{ conversationId: string, text: string }`; `src/socket/handler.js` that always runs a turn inside `leases.withLease(conversationId, ...)`; `src/leases.js`; `client/chat-client.js`; passing tests.
  - Branch `feat/turn-resume`, several commits: schema gains optional `turnId`; the handler is refactored to `withTurnClaim(data, turn)` which claims the turn and the conversation lease only when `data.turnId` is set and otherwise calls `turn()` directly; `client/chat-client.js` always generates and sends a `turnId`; resume logic, a retry helper, docs and tests for the resume path. `README.md` on the branch states "A conversation runs one turn at a time" and "The chat client always sends a turnId."
- [ ] **Step 2: Write `prompt.md`:** `Review my branch \`feat/turn-resume\` against \`main\` before I merge it. It lets a client resume an interrupted turn by id. Requirement: a conversation runs one turn at a time.`
- [ ] **Step 3: Write `graders/blocking-not-parked.md`** (`type: llm`):

```
PASS if the review reports as a Blocking finding that a socket message without `turnId`, which `src/socket/schema.js` accepts, runs a turn without the conversation lease, so two turns of one conversation can run concurrently; reporting it as Blocking while noting that the bundled client always sends `turnId` still passes.
FAIL if the review does not report it, or reports it only as Non-blocking, Parked, deferred, or an open question, or dismisses it because the chat client always sends `turnId`.
```

- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5: Measure before.** `pnpm run eval --case review-schema-allowed-input --runs 3 --no-publish`. Record with/without scores, per-run votes, cost, version in the results file under "Before". Expected: with-plugin below 1.00 on `blocking-not-parked`. If it scores 1.00, harden once (spread the handler refactor across two files; add a second, correctly leased path) and rerun; if still 1.00, report DONE_WITH_CONCERNS with the numbers and do not commit the case.
- [ ] **Step 6: Commit.** `git add` the case dir and results file; `git commit -m "test(evals): add schema-allowed input classification case"`.

### Task 2: Trust-boundary classification rule

**Files:**
- Modify: `plugins/workflows/skills/reviewing-change/SKILL.md` (Synthesis: Blocking bullet and Parked bullet)
- Modify: `plugins/workflows/agents/{quality,spec,standards}-reviewer.md` (the sentence after "Blocking means incorrect behavior, ...")
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: Task 1's case (measured "Before").
- Produces: the rule sentence, verbatim in all four files:
  `An input that a schema, API, socket, or public interface accepts is reachable: classify a finding about it by its impact as if any caller sends it; that current clients do not send it never downgrades, parks, or dismisses it.`
  (Superseded 2026-11-13, fe6a544: shipped as "An input that an externally callable entry point (an HTTP or RPC API, socket, queue, or webhook) accepts under its schema is reachable: that current clients do not send it never downgrades, parks, or dismisses a finding about it. This removes only that argument; it never raises a finding's impact by itself.")

- [ ] **Step 1: Write the failing test** in `tests/workflows.test.mjs`:

```js
test("findings about schema-accepted inputs are classified as reachable", () => {
  const rule = /An input that a schema, API, socket, or public interface accepts is reachable: classify a finding about it by its impact as if any caller sends it; that current clients do not send it never downgrades, parks, or dismisses it\./;
  const synthesis = normalizedSkill("reviewing-change").split("## Synthesis")[1] ?? "";
  assert.match(synthesis, rule);
  assert.match(synthesis, /Parked.*never .*client/);
  for (const agent of ["quality-reviewer", "spec-reviewer", "standards-reviewer"]) {
    const text = readFileSync(join(root, "plugins", "workflows", "agents", `${agent}.md`), "utf8").replace(/\s+/g, " ");
    assert.match(text, rule, agent);
  }
});
```

- [ ] **Step 2:** `node --test tests/workflows.test.mjs` → FAIL (rule missing).
- [ ] **Step 3: Add the rule.** In Synthesis, append the rule sentence to the Blocking bullet. In the Parked bullet add: `A trigger that waits for a new client or caller to send an input the interface already accepts is not a valid trigger; classify that finding now.` Add the rule sentence to each reviewer agent right after its Blocking definition, wrapped at 80 columns.
- [ ] **Step 4:** `pnpm build && pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(review): treat schema-accepted inputs as reachable"`.

### Task 3: Measure after, record, release 0.9.0

**Files:**
- Modify: `docs/eval-baseline.md` (new `## 0.9.0` section above `## 0.8.0`)
- Create: `docs/measuring-review-against-coderabbit.md`
- Modify: version files and `plugins/workflows/CHANGELOG.md`; `dist/` via `pnpm build`
- Modify: results file

- [ ] **Step 1:** `pnpm run eval --case review-schema-allowed-input --runs 3 --no-publish`. Expected: with-plugin `blocking-not-parked` passes in all 3 runs and the score exceeds "Before". If not, stop and report the numbers.
- [ ] **Step 2: Suite regression.** Run every other `reviewing-change` case with `--runs 1` (one at a time). Rerun any with-plugin drop with `--runs 3`. Expected: no confirmed regression, in particular `review-parked-trigger` and `review-clean-change`.
- [ ] **Step 3: Write `docs/measuring-review-against-coderabbit.md`** (≤60 lines): purpose; the baseline (Knowtis #594–723: 137 CodeRabbit findings, 72% addressed, 82% of 34 Major; in 54 PRs reviewed by our flow, 68 addressed findings, 17 Major, still landed); the procedure for the next ~20 PRs (for each CodeRabbit Major, check whether our review report listed it and how it classified it: missed, found but parked/Non-blocking, or found Blocking); the decision rule (detection misses reopen the adversarial lens and finding verifier from the 2026-11-12 design; classification misses go to Synthesis rules); the replay method (clone at the reviewed commit, strip later refs and post-fix PR text and bot notes, headless `claude -p` with the installed plugin) with the #669 result and the #648 result as provided by the controller.
- [ ] **Step 4: `## 0.9.0` in `docs/eval-baseline.md`** in the 0.8.0 format: date, versions, model, judge, runs, cost; the new case Before/After; suite results; a short note that the synthetic #669/#672 cases were dropped as non-discriminating and that the #669 replay found the bug but parked it.
- [ ] **Step 5: Bump every version to 0.9.0 and add the CHANGELOG entry** (the classification rule and the invalid parked trigger; the new eval case).
- [ ] **Step 6:** `pnpm build && pnpm test && pnpm check && git status --short` → PASS, only intended files.
- [ ] **Step 7: Commits.** `git commit -m "docs: record the 0.9.0 eval run and review measurement"` then `git commit -m "chore: release 0.9.0"`.
