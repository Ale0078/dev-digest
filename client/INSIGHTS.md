# Insights — client

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

### 2026-11-26 · A `draggable` list row swallows clicks on small controls inside it
**What:** In the agent Skills tab the whole `<li draggable>` was the drag source. A click on the 16px `Checkbox` with a few pixels of mouse movement started an HTML5 drag instead, so the checkbox "sometimes" didn't toggle. jsdom tests can't reproduce it, because `fireEvent.click` never drags. The fix: only the grip `<span draggable>` is the drag source, the `<li>` stays the drop target, and the skill name is passed as the `Checkbox` `label` for a larger hit area. **Why it matters:** For any drag-to-reorder list with controls in its rows, put `draggable` on a handle, never on the row. **Where:** `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx`

### 2026-11-26 · RTL `rerender(ui)` drops providers that were wrapped inline as JSX
**What:** If a helper renders `<NextIntlClientProvider><X/></NextIntlClientProvider>` and the test calls `rerender(<X/>)`, the tree is remounted without the providers and fails with "NextIntlClientProvider context not found". Pass the providers as `render(ui, { wrapper })` instead, as `renderWithIntl` in `src/test/skills-fixtures.tsx` does. **Why it matters:** Use `wrapper` in any test that rerenders. **Where:** `client/src/test/skills-fixtures.tsx`

### 2026-11-21 · "Close on scroll" for a fixed popover also closes it when the popover itself scrolls
Supersedes: 2026-11-21 · `position: absolute` popovers get clipped in the PR table and run accordion
**What:** `window.addEventListener("scroll", close, true)` (capture) also catches scroll events from inside the popover. Wheel scrolling that reaches the card's edge, or a card with nothing to scroll, chains to the page, so the page scrolls instead and the card closes. Fix: ignore scroll events whose `target` is inside the card (`cardRef.contains`). Add a native `wheel` listener with `{ passive: false }` that calls `preventDefault()` at the top or bottom edge; React's `onWheel` is passive and can't. Also set `overscrollBehavior: "contain"` for touch. **Why it matters:** Any portalled popover with its own scroll needs all three, or it is unusable with a mouse wheel. **Where:** `client/src/components/findings-summary/FindingsHoverCard.tsx` (`FindingsHoverCard`)

### 2026-11-21 · `position: absolute` popovers get clipped in the PR table and run accordion
**What:** An absolutely positioned hover card inside a PR row was cut off at the table edge. The PR list `tableCard` (`pulls/styles.ts`) and `ReviewRunAccordion`'s root both set `overflow: hidden` to keep their rounded corners. The fix is to portal the card to `document.body` with `position: fixed`, place it from the trigger's `getBoundingClientRect()` (flipping above when there's no room below), close it on scroll and resize, and add a ~120ms close delay so the pointer can cross the gap. **Why it matters:** Any new tooltip, popover, or dropdown in these containers will hit the same clipping. Don't remove `overflow: hidden` from the containers; reuse the portal pattern instead. **Where:** `client/src/components/findings-summary/FindingsHoverCard.tsx` (`FindingsHoverCard`)

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-27 · `FEATURE_MODELS` has a hand-written client mirror that `diff -r` of vendor/shared doesn't check
**What:** `client/src/lib/feature-models.ts` duplicates the `FEATURE_MODELS` registry from `vendor/shared/contracts/platform.ts`, because the client doesn't import runtime values from the vendored copy. M3 changed the `review_intent` default in both. Also, Settings → Models (`SettingsModels.tsx` `setModel`) always saves `provider:'openrouter'`, so any non-OpenRouter default is unreachable after the first pick. **Why it matters:** A default or new feature key changed only in the contracts silently diverges in the UI. Change both files together. **Where:** `client/src/lib/feature-models.ts`, `server/src/vendor/shared/contracts/platform.ts`

### 2026-11-21 · Per-run finding filters belong in `FindingsPanel` state; accept/dismiss needs no extra wiring
**What:** `ReviewRunAccordion` mounts one `FindingsPanel` per run, so a filter kept as `useState` in the panel is already scoped to its run. Keep the panel's derived views (counts, filtered list) as `useMemo` over the `findings` prop. `useFindingAction` invalidates `["reviews", prId]`, and the refetch sends new props, so counts stay in sync after accept or dismiss without manual cache patching. **Why it matters:** You don't need a new hook, a query param, or an optimistic update to add a client-side filter or counter. Add pure helpers in `helpers.ts` and test them directly. **Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/` (`visibleFindings`, `severityCounts`), `src/lib/hooks/reviews.ts` (`useFindingAction`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

### 2026-11-27 · The `react-testing-library` skill assumes MSW and `userEvent`; this client has neither
**What:** `client/package.json` has only `@testing-library/jest-dom` and `@testing-library/react`. The existing tests use `fireEvent` and `vi.mock` of `src/lib/hooks/*`. The skill's mocking and anti-pattern sections recommend MSW and `@testing-library/user-event`. **Why it matters:** Follow the repo idiom when writing tests. Adding those deps is a separate decision for the user, not something to slip into a test change (the `test-writer` agent forbids it). **Where:** `client/package.json`, `.claude/skills/react-testing-library/SKILL.md`

### 2026-11-27 · `@devdigest/ui` `Textarea` and `Toggle` drop `aria-*` props; `Pencil` is not an `IconName`
**What:** `TextInput` spreads `...rest` onto its `<input>`, so `aria-label` works. `Textarea` (`vendor/ui/kit/Textarea.tsx`) and `Toggle` destructure only their own props, so an `aria-label` passed to them is silently dropped. The type checker doesn't complain about `Toggle`, and tests can't find the control by label. The workaround, without editing vendor code: wrap the control in `<div role="group" aria-label=…>` and query `within(getByRole("group", {name})).getByRole("textbox")`. Also, lucide's `Pencil` is exported only under the alias `Edit` (`icons.tsx`), so `icon="Pencil"` fails typecheck. **Why it matters:** These surprises come up in any form or test that uses these kit controls. **Where:** `client/src/app/repos/[repoId]/conventions/_components/ConventionCard/ConventionCard.tsx`

### 2026-11-26 · `@devdigest/ui` `Donut` always prints a `$x.xx` legend
**What:** `Donut` formats every legend value as `valuePrefix + value.toFixed(2)`, so counts show as `3.00`, and the legend can't be switched off. The skill Stats tab puts `Donut` in a fixed-size, `overflow: hidden`, `aria-hidden` wrapper that clips its legend, and renders its own count legend. **Why it matters:** For any non-money donut, reuse that wrapper instead of editing vendor code. **Where:** `client/src/app/skills/[id]/_components/SkillDetail/StatsTab/StatsTab.tsx`

### 2026-11-21 · CI `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (overrides): local pnpm 12 vs CI pnpm 10
**What:** CI (`.github/workflows/*.yml`) installs with pnpm 10, while a local machine may run pnpm 12. pnpm 12 ignores the `"pnpm": { "overrides" }` field in `package.json`. Regenerating the lockfile with pnpm 12 (commit `67ebc52`) therefore silently dropped the lockfile's `overrides:` section, and with it the security pins. katex went back to 0.16 and postcss to 8.4.31. CI's pnpm 10 still read the overrides from `package.json`, so `pnpm install --frozen-lockfile` failed. **Fix:** keep `overrides` in `client/pnpm-workspace.yaml`, which both versions read, not in `package.json`. Then check the lockfile with both versions: `npx pnpm@10 install --frozen-lockfile --lockfile-only` and `pnpm install --frozen-lockfile`. **Why it matters:** Any lockfile change made with pnpm 12 can break CI, or silently remove the pins. **Where:** `client/pnpm-workspace.yaml`, `client/pnpm-lock.yaml`

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

### 2026-11-21 · Fixed: "Updating a style property during rerender (borderColor) when a conflicting property is set (borderLeftColor)"
Supersedes: 2026-11-21 · "Updating a style property during rerender (borderColor) …" in FindingsPanel tests
**What:** `borderColor` and `borderWidth` are shorthands for all four sides. React treats them as conflicting with `borderLeftColor`/`borderLeftWidth` and warns whenever the shorthand value changes. In `FindingCard` that happens every time `focused` toggles, in tests and in the browser console. The fix is to set per-side longhands only (`borderTopColor`/`borderRightColor`/`borderBottomColor` + `borderLeftColor`, same for widths). **Why it matters:** A comment saying "all-longhand" is not enough: `borderColor` looks like a longhand but isn't. Any inline style that sets one border side differently must spell out all four sides. **Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/styles.ts` (`s.card`)

### 2026-11-21 · "Updating a style property during rerender (borderColor) when a conflicting property is set (borderLeftColor)" in FindingsPanel tests
**What:** This stderr warning appears in any test where a `FindingCard`'s `focused` prop changes, for example after the list is filtered or j/k moves focus. The cause is the card's existing inline style, which mixes the `borderColor` shorthand with `borderLeftColor`. It was already there and does not fail tests. **Why it matters:** Don't go hunting for the cause in your own change. To get rid of it, split the card's border into per-side properties in `FindingCard`. **Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx` (`FindingCard`)

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

### 2026-11-21 · Findings severity icons + hover card in PR list and Timeline
- Added the shared `src/components/findings-summary` (`SeverityCountIcons`, `FindingsHoverCard`). It is used by the PR list's Findings column, which takes counts from the server and loads the popover list lazily via `usePrReviews`, and by Timeline run rows, which use findings from the already-loaded reviews keyed by `run_id`. See root `INSIGHTS.md` → "PR-list findings counts use latest review per agent".

### 2026-11-21 · Severity counters + filter in review runs (Agent runs tab)
- Added per-run «N CRITICAL · N WARNING · N SUGGESTION» chips to `FindingsPanel`. They filter client-side and combine with Hide low confidence. Counts are taken after the confidence filter. Levels with zero findings are hidden, except the active one, so the filter can always be cleared.
- `engineering-insights` was invoked manually at the end of the task (phase 3), not triggered automatically.

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
