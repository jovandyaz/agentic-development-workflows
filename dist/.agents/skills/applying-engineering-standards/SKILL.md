---
name: applying-engineering-standards
description: Use when designing, implementing, fixing, reviewing, verifying, or shipping code and technical decisions must follow current project and industry guidance.
license: MIT
metadata:
  author: jovandyaz
  version: "0.4.0"
---

# Applying Engineering Standards

Base decisions on the actual project and current primary sources, not generic
memory. Apply principles to reduce concrete risk and complexity, never as
ceremony.

## Establish The Project Baseline

Before proposing implementation:

1. Read repository instructions, architecture records, contribution rules,
   nearby code, tests, and CI/deployment configuration.
2. Identify actual dependency and runtime versions from manifests, lockfiles,
   generated schemas, and tool output. Do not assume the latest release.
3. Identify established boundaries, naming, error handling, test style,
   security constraints, compatibility policy, and deployment model.

Repository conventions win over generic preferences unless they conflict with
correctness, security, explicit requirements, or current platform contracts.
Surface such conflicts instead of silently choosing a side.

## Official Documentation First

For framework, library, SDK, protocol, cloud, database, or tool behavior:

1. Use Context7 first when it is available and resolves the relevant official
   project documentation for the detected version.
2. If Context7 is unavailable, incomplete, or has no authoritative match, use
   the official documentation website, specification, release notes, or source.
3. Check migration guides and breaking changes when installed and documented
   versions differ.
4. Do not rely on model memory, blogs, snippets, or community answers for API
   signatures, configuration, security behavior, or compatibility guarantees.
5. For material decisions, record the source URL, version, and decision in the
   plan, review evidence, or PR. Never include credentials or private data in a
   documentation query.

Reconsult primary documentation whenever an API is uncertain, an error
contradicts expectations, a dependency changes, or review challenges an
assumption. Documentation lookup applies throughout the workflow, not only at
the initial design.

## Engineering Judgment

Use SOLID, DRY, YAGNI, and KISS as context-sensitive heuristics:

- Preserve cohesive responsibilities and explicit boundaries.
- Prefer the smallest design that satisfies current requirements.
- Remove meaningful duplication, not coincidental visual similarity.
- Keep dependencies pointing toward stable contracts when that reduces change
  cost or improves testability.
- Use a design pattern only when it solves a named recurring problem. State the
  problem and tradeoff; do not add factories, repositories, strategies, or
  abstractions for hypothetical reuse.

Validate external input, protect secrets and personal data, use least privilege,
fail explicitly, and test behavior at the appropriate boundary. For UI include
accessibility, keyboard operation, responsive behavior, and reduced motion when
relevant. For APIs and data include compatibility, migrations, and rollback.

## Decision Output

Keep a concise evidence trail:

```text
Decision: <chosen approach>
Project evidence: <paths and existing pattern>
Official source: <URL and applicable version>
Tradeoff: <why this is the smallest safe choice>
Verification: <test or observable check>
```

If authoritative sources conflict or the version cannot be established, stop
and ask rather than implementing from an assumption.
