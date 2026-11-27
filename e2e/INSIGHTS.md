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

### 2026-11-26 · agent-browser: `click` takes `xpath=…`, but `wait <selector>` didn't match it; use `wait --fn`
**What:** In CI, `["click", "xpath=//span[@aria-label='…']//button"]` worked. A following `["wait", "xpath=…//button[@aria-checked='true']"]` still timed out, even though the failure screenshot showed the switch on. `["wait", "--fn", "!!document.querySelector('span[aria-label=\"…\"] button[aria-checked=\"true\"]')"]` passed. **Why it matters:** For state assertions such as aria-checked or a toggle being on, use `wait --fn` with a CSS `querySelector`, not an xpath selector. **Where:** `e2e/specs/08-skills.flow.json` (step "toggle is on")

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

### 2026-11-27 · `./scripts/e2e.sh` without `agent-browser` boots the stack, then fails 0/8 with `spawn agent-browser ENOENT`
**What:** On a machine without the CLI the script prints `agent-browser not found — install once: npm i -g agent-browser && agent-browser install`, still starts the throwaway Postgres (:5433, migrations + seed applied), the API (:3101) and web (:3100), and then every flow fails with `✗ load the app root — spawn agent-browser ENOENT`. That failure comes from the missing binary, not from the code under test. A second run started right after the first one sat at `waiting for web :3100` until killed, and left a `tsx src/server.ts` process and the `devdigest-e2e-postgres` container behind. **Why it matters:** Install the CLI before treating an e2e result as evidence. If a run hangs, kill the `e2e.sh` processes and `docker rm -f devdigest-e2e-postgres` before retrying. Migrations applying cleanly in that run does count as proof that a new migration is valid against the seeded schema. **Where:** `scripts/e2e.sh`

### 2026-11-26 · `wait --text` fails on text styled with CSS `textTransform: uppercase`
**What:** `08-skills` failed at `agent-browser wait --text "Not imported, never executed"`, even though the CI screenshot showed the section. The title has `textTransform: "uppercase"`, so the rendered text is "NOT IMPORTED, NEVER EXECUTED", and `wait --text` is a case-sensitive match against that rendered text. The fix is to wait for nearby text that isn't transformed (the hint "These files from the archive are ignored"). **Why it matters:** Before you target a section title or label, check its styles for `textTransform`; the `messages/*.json` string isn't what the browser matches. The failure screenshot (`e2e-failure` artifact, `08-skills-fail.png`) tells a test bug from a UI bug in one look. **Where:** `e2e/specs/08-skills.flow.json`, `client/src/app/skills/_components/ImportDrawer/styles.ts` (`sectionTitle`)

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->
