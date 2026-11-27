# Insights — reviewer-core

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-27 · `UnifiedDiff.files[].hunks` has no `@@ … @@ <heading>` text; read it from `diff.raw`
**What:** `DiffHunk` carries only `oldStart/oldLines/newStart/newLines/newLineNumbers`. The function/class heading git puts after the second `@@` exists only in `diff.raw`. `summarizeDiffForIntent` (`src/intent.ts`) therefore walks `raw` (`diff --git … b/<path>` sets the file, lines starting with `@@` are kept) and never copies body lines. **Why it matters:** Anything that needs hunk headings, without leaking code bodies, must parse `raw` the same way. Don't look for the heading on `DiffHunk`. **Where:** `reviewer-core/src/intent.ts` (`summarizeDiffForIntent`), `server/src/vendor/shared/adapters.ts` (`DiffHunk`)

### 2026-11-27 · reviewer-core tests import the server's mocks through a relative path
**What:** `reviewer-core/test/run.test.ts:3` has `import { MockLLMProvider, MockGitClient } from '../../server/src/adapters/mocks.js'`. That is a cross-package relative import, which root `CLAUDE.md` otherwise forbids, and it already exists. **Why it matters:** A change to an existing mock in `server/src/adapters/mocks.ts` can break reviewer-core tests, so add new mocks rather than changing existing ones, and run `npm test` here too. A review that flags this import is looking at legacy code, not at something the diff introduced. **Where:** `reviewer-core/test/run.test.ts`, `server/src/adapters/mocks.ts`

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->

### 2026-11-27 · Strict `json_schema` with `.max()` arrays (`IntentClassification`) is untested against a live provider
**What:** `IntentClassification` (M3) uses `z.array(...).max(8)`, which `zodResponseFormat` turns into `maxItems`. Only mocks ran in this session, so it is unknown whether OpenRouter's `strict: true` mode (e.g. with `google/gemini-2.5-flash-lite`) accepts `maxItems`. **Why it matters:** If the first real "Detect" fails with a schema/400 error, drop the `.max()` calls from the contract (both vendor copies) and rely on `normalizeIntent` in `server/src/modules/intent/helpers.ts`, which already truncates. **Where:** `server/src/vendor/shared/contracts/brief.ts` (`Intent`, `IntentClassification`), `reviewer-core/src/llm/structured.ts` (`toJsonSchema`)
