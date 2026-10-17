# Agentic Development Workflows

[![validate](https://github.com/jovandyaz/agentic-development-workflows/actions/workflows/validate.yml/badge.svg)](https://github.com/jovandyaz/agentic-development-workflows/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Portable, multi-agent software development workflows that compose
[Superpowers](https://github.com/obra/superpowers) with selected Agent Skills.
They add a strict orchestration layer without copying upstream skill content.

## Workflows

| Skill | Purpose |
| --- | --- |
| `applying-engineering-standards` | Ground decisions in project patterns and current official documentation. |
| `capturing-lessons` | Turn confirmed recurring mistakes into enforced tests, checks, or rules. |
| `committing-change` | Create one auditable Conventional Commit without coauthor trailers. |
| `developing-feature` | Design, plan, implement with TDD, review, and verify a feature. |
| `fixing-bug` | Reproduce, prove root cause, add a regression test, fix, review, and verify. |
| `reviewing-change` | Run independent review lenses in a fixed, read-only pipeline. |
| `shipping-change` | Publish an authorized PR and follow latest-head review, CI, and deployment gates. |
| `verifying-change` | Map claims to fresh UI, HTTP, test, typecheck, lint, and build evidence. |
| `assessing-code-quality` | Grade maintainability and report evidence-backed design smells. |

`reviewing-change` always runs the custom `assessing-code-quality` skill first
and waits for its result before starting Superpowers, standards/spec, or
Anthropic lenses.

```text
developing-feature / fixing-bug
              |
              v
       reviewing-change
 assessing-code-quality first
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
| Superpowers | Running any orchestrated workflow; standalone `assessing-code-quality` has no external dependency |
| Anthropic `frontend-design` | A feature or bug fix changes UI |
| Playwright MCP | Verifying a user-visible web path |

Reviewed compatibility baselines and licenses are pinned in
[`dependencies.lock.json`](dependencies.lock.json). Runtime plugin managers may
install a newer Superpowers release; the workflows fail if the required skills
are unavailable. Use its [official runtime instructions](https://github.com/obra/superpowers#installation).

The pinned `skills` CLI requires Node.js 22.20 or newer. Install the portable
dependencies globally when using the global workflow installation:

```bash
pnpm dlx skills@1.5.23 add https://github.com/anthropics/skills/archive/3b3fad96af16a10759d930941b4520ba0c40edae.tar.gz --global --skill frontend-design
```

Install the same dependencies into the current repository when using a
repository-scoped workflow installation:

```bash
pnpm dlx skills@1.5.23 add https://github.com/anthropics/skills/archive/3b3fad96af16a10759d930941b4520ba0c40edae.tar.gz --skill frontend-design
```

Claude Code can install the official variants:

```text
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
```

Marketplace commands follow the version currently curated by their provider;
use the commit-addressed portable archive commands above when immutable source
selection is required.

## Install

### Claude Code marketplace

```text
/plugin marketplace add jovandyaz/agentic-development-workflows
/plugin install workflows@agentic-development-workflows
```

Plugin skills are namespaced, for example `/workflows:assessing-code-quality`.

### Global portable skills

Clone the repository, then install into `~/.agents/skills`, which is read by
Codex CLI, Cursor, Gemini CLI, and OpenCode:

```bash
node scripts/sync-portable.mjs --install-global
```

For an unnamespaced `/assessing-code-quality` in Claude Code, install the
standalone skills into `~/.claude/skills` instead of installing the marketplace
plugin:

```bash
node scripts/sync-portable.mjs --install-claude-global
```

Install into one repository:

```bash
node scripts/sync-portable.mjs --install-repo /path/to/repository
```

The installer tracks only its own nine directories and refuses to overwrite an
unowned or locally modified skill with the same name. It records an atomic
transaction journal. If a process is interrupted, verify its PID is no longer
running and repeat the same install command with `--recover`; then rerun the
original install command.

## Update

Each release has a version, a [changelog entry](plugins/workflows/CHANGELOG.md),
and a [GitHub release](https://github.com/jovandyaz/agentic-development-workflows/releases).
Watch the repository for releases to get notified. Entries that need action
start with **Breaking:**.

### Claude Code

Third-party marketplaces start with auto-update off. Turn it on once: run
`/plugin`, open **Marketplaces**, select `agentic-development-workflows`, and
choose **Enable auto-update**. Claude Code then updates the plugin in the
background after startup and prints
`Plugin updated: workflows · Run /reload-plugins to apply`.

To update by hand:

```bash
claude plugin update workflows@agentic-development-workflows
```

Then run `/reload-plugins` or start a new session. `claude plugin details workflows`
shows the installed version.

### Teams

Commit this to the repository's `.claude/settings.json` to register the
marketplace, enable the plugin, and keep it updated for everyone who trusts the
folder:

```json
{
  "extraKnownMarketplaces": {
    "agentic-development-workflows": {
      "source": { "source": "github", "repo": "jovandyaz/agentic-development-workflows" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": { "workflows@agentic-development-workflows": true }
}
```

An entry with the same marketplace name in `.claude/settings.local.json`
replaces this one, including `autoUpdate`.

### Portable skills

Pull the clone and repeat the install command you used, for example:

```bash
git pull
node scripts/sync-portable.mjs --install-global
```

The installer updates its own directories, removes skills that left the set,
and refuses to overwrite a skill you modified locally.

## Use

Skills activate automatically from their descriptions. Explicit invocation is
runtime-specific:

| Runtime | Explicit use |
| --- | --- |
| Claude Code marketplace | `/workflows:developing-feature`, `/workflows:assessing-code-quality` |
| Claude Code standalone | `/developing-feature`, `/committing-change`, `/shipping-change` |
| Codex CLI | `$developing-feature`, `$committing-change`, `$shipping-change` |
| Cursor | Ask Agent to use `developing-feature` or `assessing-code-quality` |
| Gemini CLI | Confirm discovery with `/skills`, then ask it to use the named skill |
| OpenCode | Ask the agent to load and use the named skill |

See [`docs/runtime-acceptance.md`](docs/runtime-acceptance.md) for discovery and
behavioral smoke tests. Each skill also has a behavioral eval suite under
`plugins/workflows/evals/`, run with `claude plugin eval` against a no-plugin
baseline; see [CONTRIBUTING.md](CONTRIBUTING.md#evals).

## Development

Repository development requires Node.js 20 or newer. Installing external Agent
Skills with the pinned CLI requires Node.js 22.20 or newer. There are no runtime
package dependencies.

```bash
pnpm test
pnpm build
pnpm check
```

`plugins/workflows/skills` is canonical. `pnpm build` generates the committed
portable tree under `dist/.agents/skills`; `pnpm check` detects any drift.

See [CONTRIBUTING.md](CONTRIBUTING.md) for release and pull-request requirements
and [SECURITY.md](SECURITY.md) for private vulnerability reporting.
