# Insights — cross-module

Non-obvious lessons for this module. Append-only, newest first inside each section.
Written via the `engineering-insights` skill — see `.claude/skills/engineering-insights/SKILL.md`.

## What Works
<!-- Approaches and solutions that worked here, verified in a session. -->

## What Doesn't Work
<!-- Dead ends and antipatterns: what was tried, why it failed, what to do instead. -->

## Codebase Patterns
<!-- Conventions and architectural decisions the code alone does not make obvious. -->

### 2026-11-27 · Plans that only touch `.claude/**` cannot go to the `implementer` agent
**What:** `implementer.md` forbids edits to `.claude/**`, so a plan for new agents or skills comes back BLOCKED from it. The four agents test-writer, architecture-reviewer, plan-verifier and doc-writer were written by the main session after the user approved the plan. Note also that README roadmap M6 has a *product* feature called "Plan Verifier", unrelated to the `plan-verifier` subagent. **Why it matters:** Route `.claude/**` plans to the main session from the start, and say which "plan verifier" you mean. **Where:** `.claude/agents/implementer.md` (Hard rules), `.claude/agents/README.md` ("Which agent or tool when")

### 2026-11-26 · `renderSkillBlock` exists twice (reviewer-core and client); change both together
**What:** The skill format `### name\ndescription\n\nbody` is built by `renderSkillBlock` in `reviewer-core/src/prompt.ts`, which the run path uses, and by a mirror in `client/src/lib/skills.ts`, which the Preview tab and live token count use. The client has no `@devdigest/reviewer-core` alias. Each copy has a test pinning the exact string: `reviewer-core/test/skills.test.ts` and `client/src/lib/skills.test.ts`. **Why it matters:** Change one copy without the other and Preview stops matching what the agent receives, even though both test suites still pass. Update both functions and both tests. **Where:** the two files above

### 2026-11-26 · Skills (M2) are half-built already: DB, contracts and engine exist, wiring is missing
**What:** Before building skills, know what is already there. The tables `skills`, `skill_versions` and `agent_skills` exist. So do the `AgentsRepository` link methods, the `GET/POST /agents/:id/skills` routes, and the `Skill`/`AgentSkillLink`/`PromptAssembly.skills` contracts. reviewer-core `ReviewInput.skills` → `assemblePrompt` already builds the block, and `TraceBody` already renders it. What is missing: `ReviewRunExecutor.runOneAgent` never passes `skills`. There is no `src/modules/skills`. `AgentsService.setSkills/linkSkill` don't check that a skill belongs to the agent's workspace. `client/messages/en/skills.json` describes an older design with URL/community import. The sidebar items live in `client/src/vendor/ui/nav.ts`, a vendored path. **Why it matters:** Reuse these pieces instead of re-creating tables or contracts, and fix the cross-workspace link gap. The full plan is in `specs/M2-skills.md`. **Where:** `server/src/modules/reviews/run-executor.ts` (`runOneAgent`), `server/src/modules/agents/service.ts` (`setSkills`), `reviewer-core/src/prompt.ts` (`assemblePrompt`)

### 2026-11-21 · PR-list findings counts use "latest review per agent", and that rule exists in two places
**What:** `PrMeta.findings` (`GET /repos/:id/pulls`) counts severities only over each agent's newest `kind='review'` review: re-runs replace older ones, and agent-less reviews count separately. The hover popover in the list builds its finding list on the client from `usePrReviews`, using the same rule. So the rule is implemented twice: server `latestReviewPerAgent` in `server/src/modules/pulls/status.ts` and client `latestReviewPerAgent` in `client/src/components/findings-summary/helpers.ts`. **Why it matters:** If one copy changes (e.g. to exclude dismissed findings) and the other doesn't, the icon counts and the popover list disagree. Change both copies, and their tests, together. Note also that the homework mockups show this column and the Timeline icons as "already existing", but this starter repo had neither; they were added in this session. **Where:** `server/src/modules/pulls/routes.ts` (list route), `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`

### 2026-11-21 · Per-run cost was removed once on purpose; `git show d45ab0d` is the map
**What:** Commit `d45ab0d` removed per-run cost from every layer: the `agent_runs.cost_usd` column (migration 0009), `RunStats`/`RunSummary.cost_usd`, `completeAgentRun`, and the drawer COST stat. reviewer-core never stopped computing it (`ReviewOutcome.costUsd`, OpenRouter `usage.cost` → `estimateCost` fallback). M1 brought it back via migration 0010. **Why it matters:** For any change to run usage or cost, start from that diff. It lists every file in the chain, and the data needs zero new LLM calls. **Where:** `server/src/modules/reviews/run-executor.ts` (`executeRuns` → `completeAgentRun`), `reviewer-core/src/review/run.ts` (`ReviewOutcome`)

## Tool & Library Notes
<!-- Dependency, tooling, and CI quirks. -->

### 2026-11-27 · Agents added to `.claude/agents/` mid-session are not callable until the session restarts
**What:** In this session neither `researcher` (staged earlier) nor the new `planner` showed up as Agent tool types: `Agent type 'planner' not found`. The workaround was `general-purpose` with a brief saying "act as the agent in `.claude/agents/<name>.md`". **Why it matters:** Live smoke tests of a new agent need a fresh session. Don't take a missing agent type as a broken frontmatter until you have restarted. **Where:** `.claude/agents/`

### 2026-11-26 · Worktree subagents start at a stale commit and need `npm ci` in reviewer-core before server typecheck
**What:** All four `isolation: "worktree"` agents in M2 got a worktree at an older commit (`83ea0b6`), not the current `labs/lab-2` HEAD. Each had to fast-forward or reset before it started work. In a fresh worktree, server `pnpm typecheck` fails with "Cannot find module 'openai'/'zod'" until `npm ci` runs in `reviewer-core/`, because the path alias compiles reviewer-core sources, which resolve deps from its own `node_modules`. **Why it matters:** Put `git log -1` against the expected base, plus `cd reviewer-core && npm ci`, in every worktree brief. **Where:** `server/tsconfig.json` (`@devdigest/reviewer-core` path), `.claude/worktrees/`

### 2026-11-24 · The pr-self-review gate hook goes live at once and inspects every Bash command's text
**What:** `.claude/settings.json` registers `.claude/skills/pr-self-review/scripts/gate.mjs` as a `PreToolUse` hook on `Bash`. It took effect in the same session as soon as the file was written. The first version regex-matched the raw command, so `echo`/heredoc/`node -e` test inputs that only mentioned `&& gh pr merge` were blocked with "no review recorded". The fix is that `gate.mjs` now strips heredoc bodies and quoted strings before matching (`executable`, `GATED`). **Why it matters:** If you change the gate, re-run its case table through `spawnSync` with the JSON passed via `input` (never inline in the command line), and keep both lists of cases: those that must block and those that must pass. The marker hash (`lib.mjs` → `diffState`) covers path and content of every changed or untracked file, so editing the skill's own untracked files also invalidates a recorded verdict. **Where:** `.claude/skills/pr-self-review/scripts/gate.mjs`, `scripts/lib.mjs`

## Recurring Errors & Fixes
<!-- Exact error text → root cause → fix. -->

## Session Notes
<!-- Dated summaries — only for sessions that produced at least one insight above. -->

## Open Questions
<!-- Unresolved or unverified — not yet safe to act on. -->

### 2026-11-27 · Subagent permission semantics from the docs, not yet verified here
**What:** Per code.claude.com/docs/en/sub-agents:
- a parent in `auto`, `acceptEdits`, `bypassPermissions` or `plan` mode overrides a subagent's `permissionMode`;
- `memory:` auto-enables Read/Write/Edit;
- `skills:` cannot preload a `disable-model-invocation` skill (e.g. `pr-self-review`);
- hooks in `.claude/settings.json` also fire inside subagents.

**Why it matters:** This is why the planner's read-only guarantee comes from `tools`/`disallowedTools` (Bash is limited only by its prompt), not from `permissionMode`. Confirm in a fresh session. **Where:** `.claude/agents/planner.md`
