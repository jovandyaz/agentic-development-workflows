# Contributing

## Development

Use Node.js 20 or newer and pnpm 10.15.0. The external `skills` CLI documented
in the README requires Node.js 22.20 or newer.

```bash
pnpm test
pnpm build
pnpm check
```

`plugins/workflows/skills/` is canonical. Do not edit `dist/` directly; run
`pnpm build` and commit the generated output with its source changes.

## Evals

Each skill has a behavioral suite under `plugins/workflows/evals/<skill>/`,
run by `claude plugin eval` against a no-plugin baseline. Every run is a real
model call billed to your account.

    pnpm run eval

Run it on macOS, Linux, or WSL2; native Windows has no sandbox backend for the
granted shell tools. On macOS, the eval sandbox blocks the `/usr/bin/git` Xcode shim, so install git from Homebrew or run the suite on Linux. Iterate on one case with `--case <name> --runs 1
--ablation none`. Before a release, also dispatch the `evals` workflow, which
needs the `ANTHROPIC_API_KEY` repository secret.

Behavior that isolated runs cannot observe, such as anything that needs
Superpowers or a real remote, stays in `docs/runtime-acceptance.md`.

`skill-fired` (`tool_used: Skill`) graders are unscored indicators under the
no-plugin baseline, so read them in the report. Under a claude.ai login, local
runs publish the HTML report as a private artifact unless `--no-publish` is
passed.

## Releases

Use strict semantic versioning. Keep `package.json`, marketplace metadata, the
plugin manifest, skill metadata, generated output, and the latest changelog
entry on the same version.

## Pull requests

- Keep changes focused and include regression tests for behavior changes.
- Document compatibility, verification evidence, and rollback when applicable.
- Do not include secrets, credentials, coauthor trailers, or generated content
  that differs from its canonical source.
- Use a single-line English Conventional Commit in imperative mood.
