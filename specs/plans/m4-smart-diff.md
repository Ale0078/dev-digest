# Development Plan: Smart Diff (role-grouped Files changed tab with inline findings)

> Produced by the `planner` subagent from the user-approved brief; risks 1–2 resolved by the main session (see "Resolved decisions").

**Goal:** On the Files changed tab, group PR files by role (core → tests → wiring → docs → boilerplate) with a "files with findings" counter per group header, a dot on each file card with findings, and the latest review's findings inline as FindingCards under their line (Accept/Dismiss work). Unplaced findings go in a block at the end of the file. An "Original order" toggle restores GitHub order. Grouping comes from a new LLM-free `GET /pulls/:id/smart-diff`.

**Non-goals:** pseudocode summaries (`pseudocode_summary` stays null); split suggestions (`too_big` always false, `proposed_splits: []`); any LLM call; DB schema or migrations; changes to either `latestReviewPerAgent` copy; seed changes; new client deps (MSW, user-event); refactoring the legacy Drizzle-in-routes in `pulls/routes.ts`.

**Modules touched:** shared-contracts | server | client (e2e: verification only)

## Resolved decisions
- UI hides empty groups; the route always returns all 5 (user).
- `e2e/README.md` → tests (user).
- Show/hide toggle (GitHub comments + findings): **starts shown** when there is at least one finding or comment, so P1 inline cards are visible without a click (main session).
- Counters, dots, stripes and `finding_lines` count **all** findings of the latest review per agent, dismissed included, as the PR-list counts do; dismissed/accepted cards render muted (main session).

## Constraints
- C1: Contracts exist in two byte-identical copies. Edit `server/src/vendor/shared/contracts/brief.ts`, mirror it into `client/src/vendor/shared/contracts/brief.ts`, typecheck all packages.
- C2: No migrations, no `src/db/schema/**` edits. Never run `pnpm db:migrate` or `./scripts/dev.sh`.
- C3: Onion layering:
  - `routes.ts` is thin: zod schemas, `getContext`, one service call.
  - `service.ts` takes a port interface. It does not take `Container`, does not call `new …Repository`, and imports no drizzle or `db/*`.
  - Drizzle lives only in `repository.ts`, which maps rows to DTOs.
  - `constants.ts` and `classify.ts` are pure.
- C4: Wire a lazy `Container` getter like `intentService` (`server/src/platform/container.ts:164-185`). Register the plugin in `server/src/modules/index.ts`. No new `ContainerOverrides` field.
- C5: The route declares `params: IdParams` and `response: { 200: SmartDiffResponse }` via `withTypeProvider<ZodTypeProvider>()`. No hand-rolled `.parse`.
- C6: An unknown or foreign-workspace PR throws `NotFoundError` from `platform/errors.ts`.
- C7: The read path makes no LLM call and no GitHub refresh; it reads only `pr_files` and the persisted reviews/findings.
- C8: Don't edit either `latestReviewPerAgent`.
  - Server copy: `server/src/modules/pulls/status.ts:37-45`. It expects rows newest-first, already filtered to `kind='review'`.
  - Client copy: `client/src/components/findings-summary/helpers.ts:26-37`. It filters `kind` itself.
- C9: The service may import pure `pulls/status.ts`, never another module's `repository.ts` or `routes.ts`.
- C10: Client components get data only through `src/lib/hooks/*` → `src/lib/api.ts`.
- C11: Every new user-facing string goes in `client/messages/en/prReview.json` → `smartDiff`. That includes the existing hard-coded "Hide comments" and "Files changed · N files" in `DiffTab.tsx`.
- C12: `src/components/diff-viewer/**` stays generic: no imports from `src/app/**`. Finding UI is injected via `DiffFindingApi.renderFinding`.
- C13: Don't edit `client/src/vendor/ui/**`. `SEV` is imported read-only from `@devdigest/ui`.
- C14: Severity stripes use border longhands or `box-shadow: inset`, never the `borderColor`/`borderWidth` shorthand mixed with `borderLeft*` (client INSIGHTS).
- C15: Client tests use `fireEvent` plus `vi.mock` of hooks. Providers go via `render(ui, { wrapper })`. No MSW, no user-event.
- C16: Tests that import `test/helpers/pg.ts` must be named `*.it.test.ts`.
- C17: Server `pnpm typecheck` doesn't check `test/**`, so test types are verified only by running vitest.
- C18: pnpm in `server/` and `client/`, npm in `reviewer-core/`. Cross-package imports go only through `@devdigest/shared`.
- C19: Don't refactor `pulls/routes.ts`. Smart Diff gets its own repository.
- C20: The implementer does no commit, push, migration or `/pr-self-review`.

## Reuse
- `contracts/brief.ts:117-149` holds `SmartDiffRole`, `SmartDiffFile`, `SmartDiffGroup`, `SmartDiff` and `ProposedSplit`. Only the enum changes.
- `contracts/review-api.ts:81-83` `SmartDiffResponse` is the route response schema.
- `client/messages/en/prReview.json` `smartDiff`: extend it.
- `server/src/modules/intent/` is the module pattern (routes, `types.ts` port, repository, container getter).
- `server/src/modules/reviews/repository/review.repo.ts:59-75` is the query shape for reviews and findings.
- `server/src/modules/_shared/schemas.ts` `IdParams`, `_shared/context.ts` `getContext`.
- `client/src/components/diff-viewer/comments.ts`:
  - `keysForLine`, `lineKey`;
  - `partitionThreads`, the shape for `partitionFindings`.
- `OutdatedComments` is the shape for the unplaced-findings block.
- `FileCard.tsx`: keep the `AUTO_EXPAND_MAX_LINES` default-open rule.
- `FindingCard.tsx`: its `defaultExpanded` and `onAction` props; its header click collapses the card to one line (P3).
- `FindingsPanel.tsx`: the `useFindingAction()` → `action.mutate({ findingId, action, prId })` wiring.
- `client/src/vendor/ui/primitives/tokens.ts` `SEV[sev].c`.
- `client/src/lib/hooks/intent.ts` `prIntentKey`: the query-key factory pattern.
- `server/test/reviews.it.test.ts:62-125`: the `setupRepoAndPr` and `buildApp({ overrides: { llm } })` pattern.

## Steps
| # | Module | Files | Change | Skills | Constraints |
|---|---|---|---|---|---|
| 1 | contracts | M both `contracts/brief.ts` | `SmartDiffRole = z.enum(['core','tests','wiring','docs','boilerplate'])`; nothing else. U `server/test/contracts.test.ts`: assert `SmartDiffRole.options` order and parse a `role:'tests'` group. | zod, typescript-expert | C1, C18 |
| 2 | server | C `modules/smart-diff/constants.ts`, `classify.ts` | `SMART_DIFF_ROLE_ORDER: readonly SmartDiffRole[]` (display order); `CLASSIFY_RULES: {role, matchers}[]` in check order boilerplate → tests → wiring → docs, core as fallback. Pure `normalizePath`, `classifyFile`, `buildSmartDiff(files, findings)`: always 5 groups in order, files in input order, `finding_lines` sorted and unique by `start_line`, `split_suggestion = {too_big:false, total_lines: Σ(add+del), proposed_splits:[]}`. | onion-architecture | C3, C7 |
| 3 | server | C `smart-diff/types.ts`, `repository.ts` | Port `SmartDiffStore`, which has three methods: `pullExists(workspaceId, prId)`, `listFiles(prId) → {path,additions,deletions}[]` and `listReviewFindings(prId) → {id, agentId, findings:{file,start_line}[]}[]`. The last one is `kind='review'` only, ordered `desc(createdAt)`. `SmartDiffRepository` implements it with Drizzle, using two queries and short-circuiting when there are no reviews. | onion, drizzle-orm-patterns | C2, C3, C19 |
| 4 | server | C `smart-diff/service.ts` | `SmartDiffService(store)`. `.get(ws, prId)` throws `NotFoundError` when the PR is missing. Otherwise it loads files and reviews in parallel, applies `latestReviewPerAgent`, flattens the findings and returns `buildSmartDiff`. | onion | C3, C6–C9 |
| 5 | server | C `smart-diff/routes.ts`; M `modules/index.ts`, `platform/container.ts` | `GET /pulls/:id/smart-diff`, with response schema `SmartDiffResponse`; container getter `smartDiffService`. | onion, fastify-best-practices | C3–C6 |
| 6 | server | C `test/smart-diff-classify.test.ts`, `test/smart-diff.it.test.ts` | See Tests. | — | C16, C17 |
| 7 | client | C `lib/hooks/smart-diff.ts`; M `lib/hooks/index.ts`, `lib/hooks/reviews.ts`, `pulls/[number]/page.tsx` | `smartDiffKey(prId)`; `useSmartDiff(prId)` via `api.get`. Invalidate `smartDiffKey` next to every `["reviews", prId]` invalidation: `useDeleteRun`, `useDeleteReview`, `useRunReview`, `useFindingAction`, and page `onRunDone`. Pass `repoFullName` and `headSha` to `DiffTab`. | frontend-ui-architecture, react-best-practices | C10 |
| 8 | client | diff-viewer: C `findings.ts`, `GroupSection/`, `UnplacedFindings/`; M `DiffViewer`, `FileCard`, `CodeLine`, `styles.ts`, `index.ts` | `DiffFindingApi`, helpers, group view, finding UI (see Rules). | frontend-ui-architecture, react-best-practices | C11–C14 |
| 9 | client | M `DiffTab/DiffTab.tsx`; C `DiffTab/helpers.ts`, `DiffTab/constants.ts`; M `messages/en/prReview.json` | Compose the hooks and toggles. Pure `buildViewGroups`. Add the i18n keys. | frontend-ui-architecture, react-best-practices | C8, C10–C12 |
| 10 | client | C `diff-viewer/findings.test.ts`, `DiffViewer/DiffViewer.test.tsx`, `DiffTab/helpers.test.ts`, `DiffTab/DiffTab.test.tsx` | See Tests. | react-testing-library | C15 |
| 11 | docs | M `server/README.md`, `client/README.md` | Add `GET /pulls/:id/smart-diff` to the API lists. | — | — |

## Rules per step
- **Matchers (step 2).** They work on `normalizePath(p)`: `\` becomes `/` and a leading `./` is stripped.
  - Helpers: `segments = split('/')`, `dirs = segments.slice(0,-1)`, `base = last`.
  - Glob mapping: `x/**` means `segments[0]==='x'`; `**/x/**` means `dirs.includes('x')`.
  - Never use a substring test on the whole path, so `src/latest.ts` and `src/contest/a.ts` stay core.
  - Rules by role:
    - **boilerplate:** `base` ends with `.lock`; `base` is one of `pnpm-lock.yaml|package-lock.json|yarn.lock`; `segments[0]` is `dist|build`; `dirs` includes `__snapshots__`; `.snap`; `/\.generated\./`; `.min.js`.
    - **tests:** `/\.(test|spec)\.[cm]?[jt]sx?$/` on `base`; `dirs` includes `test|tests|__tests__`; `segments[0]==='e2e'`.
    - **wiring:** `base` is `index.ts|index.js`; `/\.config\./` on `base` (so `src/config.ts` stays core); `/^tsconfig.*\.json$/`; `base` starts with `.eslintrc` or `.env`; `/^docker-compose.*\.ya?ml$/`; `segments[0]` is `.github|.claude`.
    - **docs:** `.md`; `segments[0]==='docs'`; `base` starts with `README` or `CHANGELOG`; `base === 'LICENSE'`.
- **`DiffFindingApi` (step 8).** Shape: `{ findings: FindingRecord[]; show: boolean; renderFinding: (f) => ReactNode }`. Export it from `diff-viewer/index.ts`. Call `renderFinding` inside JSX wrapped in `<React.Fragment key={f.id}>`.
- **`findings.ts` (step 8).** Pure `findingsByFile`. `partitionFindings(fileFindings, renderedKeys)` matches on `lineKey("RIGHT", start_line)` and returns `{matched: Map, unplaced}`, dropping nothing.
- **`DiffViewer` (step 8).** New optional `groups?: DiffGroup[]`, where `DiffGroup = { key, label, subtitle, color, files: PrFile[], findingFileCount: number|null, defaultOpen }`. Without `groups` it renders a flat list. File key becomes `f.path`.
- **`GroupSection` header (step 8).**
  - Sticky: `position: sticky; top: 0`, a z-index and an opaque background.
  - Contents, in order: chevron, colored square, label, subtitle, then `● N` only when N > 0. It shows the `noReviewYet` hint when `null`, never `0`. Then `filesCount`.
  - It is a `<button type="button" aria-expanded>` with local open state.
- **`FileCard` (step 8).**
  - Shows a red dot (`SEV.CRITICAL.c`, `aria-label` `hasFindings`) when the file has findings. The dot is separate from the comment count and visible even while findings are hidden.
  - Passes the matched findings to `CodeLine`.
  - Renders `UnplacedFindings` after the lines when `show`.
- **`CodeLine` (step 8).**
  - A line with findings gets a left stripe in the most severe finding's color (longhand or inset styles), plus a right-aligned `smartDiff.severityLine.<SEV>` label.
  - The finding cards under the line, in the `cs.thread` rail, render only when `show`. The stripe and label always show.
- **diff-viewer i18n (step 8).** New strings use `useTranslations("prReview")` with `smartDiff.*` keys.
- **DiffTab data (step 9):**
  - `latest = latestReviewPerAgent(usePrReviews(prId).data ?? [])` (client copy), `findings = latest.flatMap(r => r.findings)`, `hasReview = data ? latest.length > 0 : undefined`;
  - `useSmartDiff` and `useFindingAction`.
- **DiffTab view state (step 9):**
  - `order` is local `"smart"|"original"`, default smart, shown as a segmented toggle.
  - `show` is one boolean for comments and findings. It defaults to shown when there are findings or comments, and the toggle is visible when `commentCount + findings.length > 0`.
  - The flat GitHub order is used while smart-diff is loading or errored, or when `order === "original"`.
- **`buildViewGroups(smart, files, findingFilePaths, hasReview)` (step 9).**
  - Builds groups from the response, with `PrFile` objects taken in `files` (GitHub) order.
  - Drops empty groups.
  - `findingFileCount` is the number of the group's files with findings, or `null` when `hasReview !== true`.
  - `defaultOpen = !DEFAULT_COLLAPSED_ROLES.has(role)`, where `DEFAULT_COLLAPSED_ROLES = {docs, boilerplate}`.
- **`renderFinding` (step 9).** `<FindingCard f defaultExpanded repoFullName headSha pending={action.isPending} onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })} />`.
- **i18n keys (step 9).**
  - Labels and subtitles: `testsLabel`, `docsLabel`, `coreSubtitle`, `testsSubtitle`, `wiringSubtitle`, `docsSubtitle`, `boilerplateSubtitle`.
  - Order toggle: `smartOrder`, `originalOrder`.
  - Review state and counts: `noReviewYet`, `filesWithFindings`, `hasFindings`, `unplacedFindings`.
  - Severity line labels: `severityLine.{CRITICAL:"blocker", WARNING:"warning", SUGGESTION:"suggestion"}`.
  - Header and toggle: `filesChanged`, `showAnnotations`, `hideAnnotations`.

## Tests
- **`smart-diff-classify.test.ts`** (unit) uses `it.each` over a table of path → role:
  - **boilerplate:** `pnpm-lock.yaml`, `client/pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `Cargo.lock`, `dist/index.js`, **`src/__tests__/__snapshots__/x.snap`**, `src/x.generated.ts`, `public/app.min.js`.
  - **tests:** `src/a.test.ts`, `src/a.test.tsx`, `server/test/smart-diff.it.test.ts`, `src/a.spec.ts`, `server/test/helpers/pg.ts`, `src/__tests__/a.ts`, **`e2e/README.md`**, `e2e/specs/05-pr-diff.flow.json`.
  - **wiring:** `server/src/modules/index.ts`, `client/vitest.config.ts`, `tsconfig.json`, `client/tsconfig.base.json`, `.eslintrc.cjs`, `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, **`.claude/skills/security/SKILL.md`**.
  - **docs:** `README.md`, `docs/agent-prompts/x.md`, `server/README.md`, `CHANGELOG.md`, `LICENSE`.
  - **core:** `src/config.ts`, `src/middleware/ratelimit.ts`, `src/latest.ts`, `src/contest/a.ts`, `.\src\win.ts`.

  It also tests `buildSmartDiff`: 5 groups in order including empty ones; input order kept; `[12,5,12]` → `[5,12]`; other files' findings ignored; `total_lines`, `too_big:false`, `proposed_splits:[]`; `SmartDiffResponse.safeParse(result).success`.
- **`smart-diff.it.test.ts`** (pattern: `reviews.it.test.ts`) seeds a PR with the files `src/a.ts`, `src/a.test.ts`, `pnpm-lock.yaml` and `README.md`, then checks:
  1. Before any review: 200, contract-valid, the 5 roles in order, the lock file in boilerplate, every `finding_lines` empty.
  2. Two reviews for the same agent with explicit `createdAt`. The older one has `src/a.ts:99`; the newer one has 12, 5 and 12. `finding_lines` must be `[5,12]`.
  3. A random uuid returns 404 `not_found`.
  4. `mockLlm.calls.length === 0`.
- **Client:**
  - `findings.test.ts`: `findingsByFile`; `partitionFindings` matched vs unplaced (a line not in the patch; a deleted-only line).
  - `DiffTab/helpers.test.ts`: empty groups dropped; `files` order kept; docs and boilerplate collapsed; `findingFileCount`; `null` without a review.
  - `DiffViewer.test.tsx`:
    - group headers render in order with "N files";
    - a collapsed group hides its files, and a header click opens it;
    - `● N` when N > 0, and the `noReviewYet` hint when `null`;
    - the dot shows only on files with findings;
    - the card renders under its line, and an unplaced finding goes in the end-of-file block;
    - "blocker" label for CRITICAL;
    - with `show:false`, no cards render but the dot and label remain.
  - `DiffTab.test.tsx` (hooks mocked):
    - Smart order shows the lock file under Boilerplate;
    - Original order shows a flat list in `files` order with no headers;
    - the toggle hides findings and comments together;
    - no reviews → "Review not run yet";
    - a smart-diff error falls back to the flat list;
    - Accept calls `mutate({findingId, action:"accept", prId})`.

## Verification
1. `diff -r server/src/vendor/shared client/src/vendor/shared` prints nothing.
2. `cd server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts'`.
3. `cd server && pnpm exec vitest run .it.test` (Docker; if `run-skills.it.test.ts` fails, rerun it alone).
4. `cd reviewer-core && npm run typecheck && npm test`.
5. `cd client && pnpm typecheck && pnpm test`.
6. `./scripts/e2e.sh` (isolated DB): `05-pr-diff.flow.json` must still find `src/config.ts` (in the open Core group).
7. These greps must come back empty:
   - drizzle or `db/` imports in `smart-diff/{routes,service,classify,constants,types}.ts`;
   - `fastify` imports in `smart-diff/{service,repository,classify,constants}.ts`;
   - `/app/` imports in `client/src/components/diff-viewer`.

## Acceptance criteria
- AC1: group order with label and count (P1).
- AC2: lock file → boilerplate.
- AC3: docs and boilerplate start collapsed.
- AC4: group counter and file dot.
- AC5: inline FindingCard under its line.
- AC6: Original order.
- AC7: constants file and test table, including the contested cases.
- AC8: route validated by `SmartDiffResponse`.
- AC9: enum extended in both copies.
- AC10: no LLM call, and grouping works before any review.
- AC11: stripe and severity word.
- AC12: Accept/Dismiss.
- AC13: unplaced block.
- AC14: one toggle for comments and findings.
- AC15: sticky header.
- AC16: collapsible card.
- AC17: "review not run yet" empty state.
- AC18: live update via `smartDiffKey` and `["reviews"]` invalidation.
- AC19: i18n.
- AC20: all suites green.

## Risks
- `pr_files` has no ordering column, so "GitHub order" is insertion order. Smart and Original order both follow `pr.files`.
- The seeded PRs have no lock, doc or test files and no patches, so the demo needs an imported PR.
- Sticky headers can break if an ancestor sets `overflow: hidden`. Verify manually.
- The diff-viewer reads the `prReview` namespace for the new keys (accepted coupling).
