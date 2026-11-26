# Insights — e2e

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

### 2026-11-26 · `wait --text` fails on text styled with CSS `textTransform: uppercase`
**What:** `08-skills` failed at `agent-browser wait --text "Not imported, never executed"`, even though the CI screenshot showed the section. The title has `textTransform: "uppercase"`, so the rendered text is "NOT IMPORTED, NEVER EXECUTED", and `wait --text` is a case-sensitive match against that rendered text. The fix is to wait for nearby text that isn't transformed (the hint "These files from the archive are ignored"). **Why it matters:** Before you target a section title or label, check its styles for `textTransform`; the `messages/*.json` string isn't what the browser matches. The failure screenshot (`e2e-failure` artifact, `08-skills-fail.png`) tells a test bug from a UI bug in one look. **Where:** `e2e/specs/08-skills.flow.json`, `client/src/app/skills/_components/ImportDrawer/styles.ts` (`sectionTitle`)

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
