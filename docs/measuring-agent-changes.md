# Measuring Agent Changes

Scores in `claude plugin eval` say whether a skill changes behavior in a sandbox.
They do not say whether agent-assisted changes hold up in production. DORA's 2025
report found AI adoption raising delivery throughput while instability kept
rising, so track both sides for the changes the workflows produce.

## Tag the changes

Give every agent-assisted pull request one label, for example `ai-assisted`,
through the pull request template, a labeler rule, or the CI agent template in
`docs/templates/ci-fix-agent.yml`. Keep the label on squash merges so it survives
in history.

## Track four numbers per month

| Metric | Question it answers | How to get it |
| --- | --- | --- |
| Merged agent PRs | How much work goes through the workflows | `gh pr list --state merged --label ai-assisted --search "merged:>=YYYY-MM-01" --json number --jq length` |
| Review rounds per PR | How often the first result was wrong | Count review events: `gh pr view <n> --json reviews --jq '.reviews \| length'` |
| Reverts | Changes that had to be undone | `git log --since=1.month --grep '^revert' --oneline \| wc -l`, matched to labeled PRs |
| Fixes within 14 days | Defects that escaped review and verification | PRs whose title starts with `fix` and that touch files a labeled PR changed in the previous 14 days |

Compare each number with the same figure for unlabeled pull requests. A skill
change that raises merged agent PRs but also raises reverts or quick fixes is a
regression, whatever its eval score.

## Close the loop

Feed a confirmed recurring failure into `capturing-lessons`, which turns it into
a test, a check, or a scoped rule. Pair the monthly numbers with the per-skill
eval report from `pnpm eval:report <results.json>` before deciding which skills
to keep, fix, or remove.
