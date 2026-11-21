# Insights — client

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

### 2026-11-21 · "Close on scroll" for a fixed popover also closes it when the popover itself scrolls
Supersedes: 2026-11-21 · `position: absolute` popovers get clipped in the PR table and run accordion
**What:** `window.addEventListener("scroll", close, true)` (capture) also catches scroll events from inside the popover. Wheel scrolling that reaches the card's edge, or a card with nothing to scroll, chains to the page, so the page scrolls instead and the card closes. Fix: ignore scroll events whose `target` is inside the card (`cardRef.contains`). Add a native `wheel` listener with `{ passive: false }` that calls `preventDefault()` at the top or bottom edge; React's `onWheel` is passive and can't. Also set `overscrollBehavior: "contain"` for touch. **Why it matters:** Any portalled popover with its own scroll needs all three, or it is unusable with a mouse wheel. **Where:** `client/src/components/findings-summary/FindingsHoverCard.tsx` (`FindingsHoverCard`)

### 2026-11-21 · `position: absolute` popovers get clipped in the PR table and run accordion
**What:** An absolutely positioned hover card inside a PR row was cut off at the table edge. The PR list `tableCard` (`pulls/styles.ts`) and `ReviewRunAccordion`'s root both set `overflow: hidden` to keep their rounded corners. The fix is to portal the card to `document.body` with `position: fixed`, place it from the trigger's `getBoundingClientRect()` (flipping above when there's no room below), close it on scroll and resize, and add a ~120ms close delay so the pointer can cross the gap. **Why it matters:** Any new tooltip, popover, or dropdown in these containers will hit the same clipping. Don't remove `overflow: hidden` from the containers; reuse the portal pattern instead. **Where:** `client/src/components/findings-summary/FindingsHoverCard.tsx` (`FindingsHoverCard`)

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-21 · Per-run finding filters belong in `FindingsPanel` state; accept/dismiss needs no extra wiring
**What:** `ReviewRunAccordion` mounts one `FindingsPanel` per run, so a filter kept as `useState` in the panel is already scoped to its run. Keep the panel's derived views (counts, filtered list) as `useMemo` over the `findings` prop. `useFindingAction` invalidates `["reviews", prId]`, and the refetch sends new props, so counts stay in sync after accept or dismiss without manual cache patching. **Why it matters:** You don't need a new hook, a query param, or an optimistic update to add a client-side filter or counter. Add pure helpers in `helpers.ts` and test them directly. **Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/` (`visibleFindings`, `severityCounts`), `src/lib/hooks/reviews.ts` (`useFindingAction`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

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
