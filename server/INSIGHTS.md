# Insights — server

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

### 2026-11-27 · Testing an LLM failure path: give `MockLLMProvider` a fixture that fails the schema
**What:** `MockLLMProvider.completeStructured` `safeParse`s the `structuredBySchema[schemaName]` fixture against `req.schema` and throws when the parse fails. So a deliberately invalid fixture, e.g. `{ conventions: [{ rule: 1 }] }`, simulates a provider/model error with no extra mock. `test/conventions.it.test.ts` uses this to check that the service maps it to `ExternalServiceError` (502). For a file-reading service, the integration test writes a real clone with `mkdtemp`, inserts the repo with `clonePath`, and overrides `repoIntel` with a stub exposing only the methods the service calls (cast to `RepoIntel`). **Why it matters:** You need no new mock class and no `vi.spyOn` to cover error branches. **Where:** `server/src/adapters/mocks.ts` (`MockLLMProvider`), `server/test/conventions.it.test.ts`

### 2026-11-26 · Assert on the real prompt via `MockLLMProvider.calls`; no capturing wrapper needed
**What:** `MockLLMProvider.calls[i].req.messages` holds the full messages array sent to the model. Filter on `method === 'completeStructured'`. `test/run-skills.it.test.ts` uses it to check `## Skills` placement and order in the system message. **Why it matters:** Prompt-content integration tests are a few lines long. **Where:** `server/src/adapters/mocks.ts` (`MockLLMProvider`), `server/test/run-skills.it.test.ts`

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-27 · `src/prompts/*.md` templates are missing from `pnpm build` output; keep new LLM prompts in TS
**What:** `renderPrompt` / `loadPromptTemplate` (`platform/prompts.ts`) read `.md` templates next to the compiled module. But `server/package.json` `build` is plain `tsc -p tsconfig.json`, which never copies `src/prompts` into `dist/prompts`. Nothing in `src/` calls `renderPrompt` yet; `onboarding.system.md` is unused. The conventions extractor therefore keeps its system prompt as the `SYSTEM_PROMPT` constant in `modules/conventions/helpers.ts`. **Why it matters:** A feature that uses `renderPrompt` works under `tsx`/vitest and throws ENOENT in a built server. Either keep prompt text in a TS module, or add a copy step to `build` first. **Where:** `server/src/platform/prompts.ts`, `server/package.json` (`build`)

### 2026-11-26 · The seed must stay insert-only for user-editable rows: `dev.sh` re-seeds on every start
**What:** `./scripts/dev.sh` runs `pnpm db:seed` on every start. Seeded `agent_skills` links use `onConflictDoNothing`. An upsert would reset the user's order and enabled choices on every restart. **Why it matters:** Any seed row a user can edit in the UI (links, toggles, skill text) has to be insert-if-missing, not upsert. **Where:** `server/src/db/seed.ts` (Test Quality Reviewer skill links)

### 2026-11-26 · `run_skills` rows exist only for `done` runs, and skill Stats rely on it
**What:** `runOneAgent` writes `run_skills` only after `completeAgentRun(status: 'done')`. The skills Stats queries (`modules/skills/repository.ts`) count those rows without filtering on run status: `pull_rate` = runs with a row ÷ done runs of linked agents. **Why it matters:** If you start writing rows for failed or cancelled runs, `pull_rate` can go above 1. In that case add a `status = 'done'` filter to the numerator. **Where:** `server/src/modules/reviews/run-executor.ts` (`runOneAgent`), `server/src/modules/skills/repository.ts`

### 2026-11-26 · A new run-trace field must be nulled in four places, not only in `getRunTrace`
**What:** M2 added `prompt_assembly.skills_tokens` and `config.skills`. Besides the read-time default in `getRunTrace` (`reviews/repository/run.repo.ts`), every trace writer must set the field: the success trace in `ReviewRunExecutor.runOneAgent`, the failure trace `traceFromBuffer` (`reviews/run-executor.ts`), `buildRunTrace` and `emptyPromptAssembly` (`platform/trace-builder.ts`). **Why it matters:** Miss a writer and failed runs store traces without the field, so the client sees `undefined` instead of `null`. **Where:** the files above. Supersedes: 2026-11-21 · New `RunStats` fields need a read-time default; trace jsonb is never migrated (still true, this adds the writer side).

### 2026-11-21 · New `RunStats` fields need a read-time default; trace jsonb is never migrated
**What:** `run_traces.trace` is a jsonb `RunTrace`. A SQL migration doesn't touch it, so traces saved before a new `RunStats` field existed lack that key. Make the field `.nullish()` in the contract and normalise it in `getRunTrace`, which is how `stats.cost_usd ?? null` is handled. **Why it matters:** Otherwise old runs return `undefined`, and the client breaks or shows wrong values while every new-run test passes. **Where:** `server/src/modules/reviews/repository/run.repo.ts` (`getRunTrace`), `server/src/vendor/shared/contracts/trace.ts` (`RunStats`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

### 2026-11-26 · Zip import limits come from fflate's `filter`; multipart is scoped to the skills plugin
**What:** The `unzipSync` `filter` callback receives each entry's name and declared `originalSize` before anything is inflated. Returning `false` lets you enforce entry count, total size and unsafe paths without decompressing. `@fastify/multipart` is registered inside the skills route plugin, which is not wrapped in `fastify-plugin`, so `req.file()` exists only there. `file.toBuffer()` throws `app.multipartErrors.RequestFileTooLargeError` past `limits.fileSize`. It is mapped to `PayloadTooLargeError` (413), because otherwise the global handler returns `internal_error`. **Why it matters:** Reuse this pattern for any other upload, and keep it out of `app.ts`. **Where:** `server/src/modules/skills/import-parser.ts`, `server/src/modules/skills/routes.ts`

### 2026-11-26 · `pnpm typecheck` never checks `test/**`; type errors in tests only show at vitest runtime
**What:** `server/tsconfig.json` includes only `src/**`. vitest strips types, so a wrong type in `test/*.ts` passes both typecheck and tests, and type-only imports are never checked. **Why it matters:** Don't rely on `pnpm typecheck` to catch test-helper drift after a contract change. Run the tests, or `tsc --noEmit` with a config that includes `test/`. **Where:** `server/tsconfig.json`

### 2026-11-24 · `dependency-cruiser` is a runtime dep for indexing, not an architecture linter
**What:** `dependency-cruiser` is listed in `server/package.json` `dependencies`, but its only user is the repo-intel import-graph adapter `DepCruiseGraph` (`src/adapters/depgraph/index.ts`), which analyses the *imported user repos*. There is no `.dependency-cruiser.*` config and no lint script, so nothing checks this repo's own layer boundaries. **Why it matters:** Don't assume layer rules are machine-checked. The `onion-architecture` skill is enforced only by its checklist. To add a real check, write a separate config plus a `lint:arch` script, and don't touch the `DepCruiseGraph` options. **Where:** `src/adapters/depgraph/index.ts` (`DepCruiseGraph`), `.claude/skills/onion-architecture/references.md`

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->

### 2026-11-27 · `run-skills.it.test.ts` failed once in a full `pnpm exec vitest run`, then passed
**What:** "injects only effective skills, in link order, and records run_skills + trace fields" failed once while all 34 files ran in parallel. It passed alone and on the next full run. The failure output wasn't captured, so the cause (probably `waitForPrRuns` timing under load) is unconfirmed. **Why it matters:** If it fails again, rerun it alone before you debug your own change, and capture the assertion text. **Where:** `server/test/run-skills.it.test.ts`, `server/test/helpers/runs.ts`
