# Insights — server

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-21 · New `RunStats` fields need a read-time default; trace jsonb is never migrated
**What:** `run_traces.trace` is a jsonb `RunTrace`. A SQL migration doesn't touch it, so traces saved before a new `RunStats` field existed lack that key. Make the field `.nullish()` in the contract and normalise it in `getRunTrace`, which is how `stats.cost_usd ?? null` is handled. **Why it matters:** Otherwise old runs return `undefined`, and the client breaks or shows wrong values while every new-run test passes. **Where:** `server/src/modules/reviews/repository/run.repo.ts` (`getRunTrace`), `server/src/vendor/shared/contracts/trace.ts` (`RunStats`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

### 2026-11-24 · `dependency-cruiser` is a runtime dep for indexing, not an architecture linter
**What:** `dependency-cruiser` is listed in `server/package.json` `dependencies`, but its only user is the repo-intel import-graph adapter `DepCruiseGraph` (`src/adapters/depgraph/index.ts`), which analyses the *imported user repos*. There is no `.dependency-cruiser.*` config and no lint script, so nothing checks this repo's own layer boundaries. **Why it matters:** Don't assume layer rules are machine-checked. The `onion-architecture` skill is enforced only by its checklist. To add a real check, write a separate config plus a `lint:arch` script, and don't touch the `DepCruiseGraph` options. **Where:** `src/adapters/depgraph/index.ts` (`DepCruiseGraph`), `.claude/skills/onion-architecture/references.md`

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
