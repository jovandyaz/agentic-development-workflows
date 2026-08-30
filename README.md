# Agentic Development Workflows

Portable, multi-agent software development workflows that compose
[Superpowers](https://github.com/obra/superpowers) with selected Agent Skills.
They add a strict orchestration layer without copying upstream skill content.

## Workflows

| Skill | Purpose |
| --- | --- |
| `applying-engineering-standards` | Ground decisions in project patterns and current official documentation. |
| `committing-change` | Create one auditable Conventional Commit without coauthor trailers. |
| `developing-feature` | Design, plan, implement with TDD, review, and verify a feature. |
| `fixing-bug` | Reproduce, prove root cause, add a regression test, fix, review, and verify. |
| `reviewing-pr` | Run independent review lenses in a fixed, read-only pipeline. |
| `shipping-change` | Publish an authorized PR and follow latest-head review, CI, and deployment gates. |
| `verifying-change` | Map claims to fresh UI, HTTP, test, typecheck, lint, and build evidence. |
| `code-quality` | Grade maintainability and report evidence-backed design smells. |

`reviewing-pr` always runs the custom `code-quality` skill first and waits for
its result before starting Superpowers, standards/spec, or Anthropic lenses.

```text
developing-feature / fixing-bug
              |
              v
        reviewing-pr
     code-quality first
              |
        fix and repeat
              |
              v
       verifying-change
              |
       failure: debug -> fix -> review -> verify
              |
       authorized: committing-change -> shipping-change
```

Commits default to a single-line English Conventional Commit in imperative
mood, with no body, trailers, or `Co-authored-by`. Pull requests carry any
required AI-assistance disclosure without changing Git authorship.

`applying-engineering-standards` is required throughout design, implementation,
debugging, review, verification, and delivery. It detects actual installed
versions, uses Context7 or official documentation, and applies programming
principles and design patterns only when they solve a concrete project problem.

## Prerequisites

Dependencies are strict when their condition applies. A workflow stops and
prints installation guidance instead of silently approximating a missing skill.

| Dependency | Required when |
| --- | --- |
| Superpowers | Running any orchestrated workflow; standalone `code-quality` has no external dependency |
| Anthropic `frontend-design` | A feature or bug fix changes UI |
| Matt Pocock `code-review` | Running `reviewing-pr` |
| Anthropic `code-review` | Optional extra lens on Claude Code |
| Playwright MCP | Verifying a user-visible web path |

Reviewed compatibility baselines and licenses are pinned in
[`dependencies.lock.json`](dependencies.lock.json). Runtime plugin managers may
install a newer Superpowers release; the workflows fail if the required skills
are unavailable. Use its [official runtime instructions](https://github.com/obra/superpowers#installation).

Install the portable external skills:

```bash
pnpm dlx skills@1.5.23 add https://github.com/anthropics/skills/archive/3b3fad96af16a10759d930941b4520ba0c40edae.tar.gz --skill frontend-design
pnpm dlx skills@1.5.23 add https://github.com/mattpocock/skills/archive/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76.tar.gz --skill code-review --skill setup-matt-pocock-skills
```

Claude Code can install the official variants:

```text
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install mattpocock-skills
/plugin install code-review@claude-plugins-official
```

Marketplace commands follow the version currently curated by their provider;
use the commit-addressed portable archive commands above when immutable source
selection is required.

The official Anthropic `code-review` command publishes a GitHub comment. These
workflows never invoke that side effect without explicit user authorization.

## Install

### Claude Code marketplace

```text
/plugin marketplace add jovandyaz/agentic-development-workflows
/plugin install workflows@agentic-development-workflows
```

Plugin skills are namespaced, for example `/workflows:code-quality`.

### Global portable skills

Clone the repository, then install into `~/.agents/skills`, which is read by
Codex CLI, Cursor, Gemini CLI, and OpenCode:

```bash
node scripts/sync-portable.mjs --install-global
```

For an unnamespaced `/code-quality` in Claude Code, install the standalone
skills into `~/.claude/skills` instead of installing the marketplace plugin:

```bash
node scripts/sync-portable.mjs --install-claude-global
```

Install into one repository:

```bash
node scripts/sync-portable.mjs --install-repo /path/to/repository
```

The installer tracks only its own eight directories and refuses to overwrite an
unowned or locally modified skill with the same name. It records an atomic
transaction journal. If a process is interrupted, verify its PID is no longer
running and repeat the same install command with `--recover`; then rerun the
original install command.

## Use

Skills activate automatically from their descriptions. Explicit invocation is
runtime-specific:

| Runtime | Explicit use |
| --- | --- |
| Claude Code marketplace | `/workflows:developing-feature`, `/workflows:code-quality` |
| Claude Code standalone | `/developing-feature`, `/committing-change`, `/shipping-change` |
| Codex CLI | `$developing-feature`, `$committing-change`, `$shipping-change` |
| Cursor | Ask Agent to use `developing-feature` or `code-quality` |
| Gemini CLI | Confirm discovery with `/skills`, then ask it to use the named skill |
| OpenCode | Ask the agent to load and use the named skill |

See [`docs/runtime-acceptance.md`](docs/runtime-acceptance.md) for discovery and
behavioral smoke tests. JSON evals are executable contracts for a future
credentialed agent harness; CI currently validates their structure, not model
behavior.

## Development

Requires Node.js 20 or newer. There are no runtime package dependencies.

```bash
pnpm test
pnpm build
pnpm check
```

`plugins/workflows/skills` is canonical. `pnpm build` generates the committed
portable tree under `dist/.agents/skills`; `pnpm check` detects any drift.
