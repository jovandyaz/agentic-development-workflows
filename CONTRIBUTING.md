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
