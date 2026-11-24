# Insights — cross-module

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-21 · PR-list findings counts use "latest review per agent", and that rule exists in two places
**What:** `PrMeta.findings` (`GET /repos/:id/pulls`) counts severities only over each agent's newest `kind='review'` review: re-runs replace older ones, and agent-less reviews count separately. The hover popover in the list builds its finding list on the client from `usePrReviews`, using the same rule. So the rule is implemented twice: server `latestReviewPerAgent` in `server/src/modules/pulls/status.ts` and client `latestReviewPerAgent` in `client/src/components/findings-summary/helpers.ts`. **Why it matters:** If one copy changes (e.g. to exclude dismissed findings) and the other doesn't, the icon counts and the popover list disagree. Change both copies, and their tests, together. Note also that the homework mockups show this column and the Timeline icons as "already existing", but this starter repo had neither; they were added in this session. **Where:** `server/src/modules/pulls/routes.ts` (list route), `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`

### 2026-11-21 · Per-run cost was removed once on purpose; `git show d45ab0d` is the map
**What:** Commit `d45ab0d` removed per-run cost from every layer: the `agent_runs.cost_usd` column (migration 0009), `RunStats`/`RunSummary.cost_usd`, `completeAgentRun`, and the drawer COST stat. reviewer-core never stopped computing it (`ReviewOutcome.costUsd`, OpenRouter `usage.cost` → `estimateCost` fallback). M1 brought it back via migration 0010. **Why it matters:** For any change to run usage or cost, start from that diff. It lists every file in the chain, and the data needs zero new LLM calls. **Where:** `server/src/modules/reviews/run-executor.ts` (`executeRuns` → `completeAgentRun`), `reviewer-core/src/review/run.ts` (`ReviewOutcome`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

### 2026-11-24 · The pr-self-review gate hook goes live at once and inspects every Bash command's text
**What:** `.claude/settings.json` registers `.claude/skills/pr-self-review/scripts/gate.mjs` as a `PreToolUse` hook on `Bash`. It took effect in the same session as soon as the file was written. The first version regex-matched the raw command, so `echo`/heredoc/`node -e` test inputs that only mentioned `&& gh pr merge` were blocked with "no review recorded". The fix is that `gate.mjs` now strips heredoc bodies and quoted strings before matching (`executable`, `GATED`). **Why it matters:** If you change the gate, re-run its case table through `spawnSync` with the JSON passed via `input` (never inline in the command line), and keep both lists of cases: those that must block and those that must pass. The marker hash (`lib.mjs` → `diffState`) covers path and content of every changed or untracked file, so editing the skill's own untracked files also invalidates a recorded verdict. **Where:** `.claude/skills/pr-self-review/scripts/gate.mjs`, `scripts/lib.mjs`

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
