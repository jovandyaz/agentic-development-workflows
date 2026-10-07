---
name: code-quality
description: Use when reviewing changed code for maintainability, design smells, unclear boundaries, unnecessary complexity, or violations of SOLID, DRY, YAGNI, and KISS.
license: MIT
metadata:
  author: jovandyaz
  version: "0.4.0"
---

# Code Quality

Assess maintainability in context. A pattern is a problem only when it creates
real cost, risk, or friction in this codebase.

**REQUIRED BACKGROUND:** Use `applying-engineering-standards` to resolve project
conventions and current official technical contracts before grading decisions.

## Scope

Use the paths or revision range supplied by the caller. With no explicit scope,
review staged and unstaged changes. Read complete changed files and relevant
call sites before judging a diff. Remain read-only.

## Analysis

1. Map changed responsibilities, dependencies, public contracts, and tests.
2. Inspect naming, function and class size, parameter count, coupling, cohesion,
   error behavior, and unnecessary indirection.
3. Look for concrete smells: duplication, feature envy, data clumps, primitive
   obsession, repeated conditionals, shotgun surgery, divergent change,
   speculative generality, message chains, and middle men.
4. Relate each material smell to SRP, OCP, LSP, ISP, DIP, DRY, YAGNI, or KISS.
5. Suppress findings that are only taste, are pre-existing, are tooling-only, or
   conflict with an intentional repository convention.

## Severity

- **CRITICAL**: design makes the change unsafe to test or maintain.
- **HIGH**: likely defects or repeated change cost across important boundaries.
- **MEDIUM**: localized complexity with a concrete maintenance cost.
- **LOW**: worthwhile improvement with limited impact.

Score A for no material findings, B for low-only findings, C for any medium,
D for high findings, and F for a critical finding. The score summarizes impact,
not finding count.

## Report

Lead with findings, highest severity first:

```text
### [SEVERITY] Short title
Location: path/to/file:line
Smell -> Principle: Shotgun Surgery -> SRP
Impact: Concrete maintenance or correctness cost
Evidence: Codebase-specific evidence
Refactoring: Smallest justified improvement
```

Then include a summary table with finding counts, score, and maintainability
(`Good`, `Fair`, or `Poor`). If no material findings exist, say so and identify
only residual risks or context you could not inspect.

Do not demand abstractions, broad rewrites, or unrelated cleanup. Suggest tests
before behavior-preserving refactors that lack coverage.
