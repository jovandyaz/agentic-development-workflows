# Runtime Acceptance Tests

Run these checks in a clean temporary repository after installing the workflows
and their conditional dependencies. Record the runtime version and complete
transcript. Do not use a repository containing secrets.

## Discovery

Confirm all five names are discoverable:

- `developing-feature`
- `fixing-bug`
- `reviewing-pr`
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

Repeat on Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode before calling
a release cross-runtime compatible.
