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

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
