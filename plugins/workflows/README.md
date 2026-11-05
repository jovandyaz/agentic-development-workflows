# workflows

Nine composable Agent Skills for disciplined software delivery:

- `applying-engineering-standards`
- `capturing-lessons`
- `committing-change`
- `developing-feature`
- `fixing-bug`
- `reviewing-change`
- `shipping-change`
- `verifying-change`
- `assessing-code-quality`

In Claude Code the plugin also ships three read-only reviewer agents, a hook
that sends a review back once when it skipped one of them, and a hook that
blocks pushes to the default branch it cannot prove safe. Server-side branch
protection remains the guarantee; the hooks catch mistakes before they reach it.

The workflows orchestrate, but do not copy, Superpowers and selected external
skills. See the repository README for prerequisites and installation.
