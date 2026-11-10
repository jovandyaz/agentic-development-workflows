# Model And Effort Strategy

How to balance cost and quality when one model runs the session and a stronger
one is available for hard work. The rule is about measured capability, not model
names: which model is stronger changes between releases. Claude Opus 5.5
performed at the level of Claude Fable 5.1 on most work, and Claude Fable 5.2
is now a step above Claude Opus 5.5.

## Roles, Not Names

The policy uses two roles that any model can fill:

- **Default model:** runs the session. Pick it by cost per completed task on
  your own work.
- **Strongest model:** advises or plans. This is the model that ranks highest
  on your own measurement today. Claude Code also checks the ranking: an
  advisor that ranks below the main model is not attached.

When a new model ships, re-run the measurement below and reassign the roles. A
new model can take either role. A model that ranks below the default model
takes neither. No skill, agent, or setting in this plugin needs to change.

## Policy

1. **One model first.** Run the session on the default model at its default
   effort. For harder work, raise effort (`/effort high` or `xhigh`) before
   bringing in a second model. Anthropic's guidance: "Tune one model before you
   add a second: sweep effort on your current model first, because most
   workloads end there, and if the sweep shows a gap, price the stronger model
   alone at low effort."
2. **Escalate only where the effort sweep falls short.** Pick the mechanism by
   the shape of the work:
   - Mid-task decisions: `/advisor <model>` in Claude Code. The advisor must
     "rank at or above your session's main model", so Claude Code refuses a
     weaker one. Turning it on or off "keeps the cached prefix intact".
   - A whole planning or design subtask: a subagent or forked skill with
     `model:` set, given a compact brief instead of the full transcript.
   - Switching the session model mid-conversation re-reads the history
     uncached, so prefer the two options above.
3. **No model names in this plugin.** Skills and reviewer agents set no
   `model:`. They inherit the session model and its advisor, so the person
   running the session decides, and a release that reorders the models needs
   no plugin change.
4. **Re-measure at every model release.** Anthropic: "Recheck at every model
   release, because releases move both the capability gap and the price
   ratio." Keep a pairing only if it beats the single model's whole curve of
   score against spend.

## What The Evidence Shows

- A strong executor gains little from a stronger advisor. Anthropic measured
  Claude Opus 5.5 at `high` with a Claude Fable 5.1 advisor at 90.1% for $2.92
  per attempt, against 88.4% for $1.38 alone. The gain "lands about on Claude
  Opus 5.5's own effort curve", so the advisor bought about what more effort
  does. No measurement with a Claude Fable 5.2 advisor is published yet.
- A weak executor gains a lot: Haiku with an Opus advisor went from 19.7% to
  41.2% on BrowseComp.
- A cheap retry also works: running at `low` and re-running failures at `high`
  cost "About 40% less than running everything at `high`, at the same pass rate
  or slightly better" on Claude Opus 5.5.
- The advisor helps only when the executor consults it. Lower effort can make
  the consult rate collapse.

Sources, read 2026-11-10:
[optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence),
[Claude Code advisor](https://code.claude.com/docs/en/advisor),
[the advisor strategy](https://claude.com/resources/articles/the-advisor-strategy).

## Measuring A Pairing

`claude plugin eval` sets only `--model`, so it cannot measure an advisor, and
most cases in this suite already score 1.00 with the plugin. Measure on real
work instead, following Anthropic's loop:

1. Take 10 to 20 tasks from your own history, each with an outcome check such
   as a test that must pass.
2. Run each configuration in its own headless session (`claude -p`, with
   `--output-format json` for cost): the default model at `medium`, `high`, and
   `xhigh`; the default model at `high` with the advisor; and the stronger model
   alone at `low`.
3. Record pass rate, cost per completed task, advisor consult rate, cache read
   share, and wall-clock time. Run each configuration at least twice.
4. Adopt a pairing only if it beats every single-model point at equal or lower
   cost, then repeat at the next model release.
