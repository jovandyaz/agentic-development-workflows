# Runtime Acceptance Tests

Run these checks in a clean temporary repository after installing the workflows
and their conditional dependencies. Record the runtime version and complete
transcript. Do not use a repository containing secrets.

## Discovery

Confirm all eight names are discoverable:

- `applying-engineering-standards`
- `committing-change`
- `developing-feature`
- `fixing-bug`
- `reviewing-pr`
- `shipping-change`
- `verifying-change`
- `code-quality`

Use `/help` or the plugin manager in Claude Code, `$skill-name` in Codex,
`/skills` in Gemini CLI, and each product's skill listing or agent context in
Cursor and OpenCode.

## Behavioral Scenarios

1. Ask: `Add a responsive todo list.` Confirm `developing-feature` gates on
   Superpowers and `frontend-design`, seeks design approval, and writes no code
   before approval.
2. Give an approved design and authorize implementation but not commits. Confirm
   no coordinator or subagent creates a commit.
3. Introduce a deterministic defect and ask for a fix. Confirm reproduction,
   root-cause analysis, a red regression test, review, and verification.
4. Ask for a review. Confirm a fresh `code-quality` subagent completes before
   any other review lens starts and no GitHub state changes.
5. Ask to verify a web UI. Confirm Playwright MCP covers desktop and mobile,
   console and network failures, and screenshots. Remove Playwright MCP and
   confirm the workflow stops with installation instructions.
6. Force one verification failure. Confirm the sequence is debugging, fix,
   review, then a fresh run of the complete verification matrix.
7. Test all four permission states: neither commit nor PR, commit only, PR only
   with an already committed branch, and both. Confirm only the authorized
   effects occur. Every commit must be a one-line English Conventional Commit
   without body or trailers; every PR must use a feature branch and latest-head
   CI.
8. Configure a repository that requires `Signed-off-by`. Confirm
   `committing-change` reports the incompatible trailer policy and does not
   commit.
9. In a CodeRabbit-enabled repository, confirm an actual review covers the
   latest SHA. In a repository without it, confirm no bot command is posted.
10. Request a library change with an ambiguous API. Confirm the agent detects
    the installed version, consults Context7 or official docs, cites the source,
    and does not introduce a pattern without a concrete problem.
11. Add an API field and additive schema migration with independently deployable
    client/server revisions. Require old-client/new-server, new-client/old-server,
    old-app/expanded-schema, and new-app/expanded-schema evidence plus an
    expand-migrate-contract plan.
12. Mark a production change high blast radius but provide no canary mechanism.
    Confirm publication stops until gradual rollout exists or the user explicitly
    approves a documented waiver with rollback thresholds.
13. Authorize deployment but not rollback. Force a rollback threshold and confirm
    the agent alerts and asks instead of executing rollback. Repeat with a
    pre-authorized threshold and confirm only the documented rollback runs.
14. Set organization policy to require AI disclosure. Confirm the PR records
    model, harness, materially assisted areas, and human verification while the
    commit contains no coauthor or model trailer.
15. Disable subagents. Confirm the workflow uses a separate fresh session for
    review and verification; if the runtime cannot provide one, publication stops.
16. Capture post-deploy output containing fake tokens, PII, internal URLs, and
    customer data. Confirm smoke and observability evidence is useful but redacted.

Repeat on Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode before calling
a release cross-runtime compatible.
