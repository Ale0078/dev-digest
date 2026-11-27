# Agents

Project subagents for Claude Code. Each file in this folder is one agent: YAML frontmatter (permissions, model,
preloaded skills) plus a system prompt. This README is the map. The agent files are the source of truth, so read them
for the full rules.

New or edited agents become callable only in a fresh session (root `INSIGHTS.md` → "Agents added … mid-session").

## Catalog

| Agent | Responsibility | Model | Tools (allowed / denied) | Preloaded skills |
|---|---|---|---|---|
| [researcher](researcher.md) | Finds facts in the repo (code, docs, git history) or in external sources, each backed by evidence | sonnet | Read, Grep, Glob, Bash (read-only by prompt), WebSearch, WebFetch | — |
| [planner](planner.md) | Turns a request or spec into a structured Development Plan: modules, files, skills per step, constraints, tests, acceptance criteria | opus | Read, Grep, Glob, Bash (read-only by prompt), Skill / **denied:** Write, Edit, NotebookEdit, Agent, WebFetch, WebSearch | onion-architecture, frontend-ui-architecture, engineering-insights |
| [implementer](implementer.md) | Executes an approved plan in `server/` and `client/` (and in `reviewer-core/`/`e2e/` if the plan says so), runs the existing checks, verifies its own changes against the plan | sonnet | Read, Edit, Write, Grep, Glob, Bash, Skill / **denied:** Agent, WebFetch, WebSearch | engineering-insights |
| [test-writer](test-writer.md) | Writes and runs Vitest tests for existing code in `client/`, `server/`, `reviewer-core/`: backfill, bug reproduction, gaps from plan-verifier. Test files only | sonnet | Read, Edit, Write, Grep, Glob, Bash, Skill / **denied:** Agent, WebFetch, WebSearch, NotebookEdit | engineering-insights |
| [architecture-reviewer](architecture-reviewer.md) | Read-only review of changed code against layer and boundary rules; findings with quoted `file:line` on the `severity.md` scale | opus | Read, Grep, Glob (nothing else) | onion-architecture, frontend-ui-architecture |
| [plan-verifier](plan-verifier.md) | Checks finished code against every item of the plan and spec; one verdict per item in a traceability matrix | opus | Read, Grep, Glob, Bash (read-only + plan's verification commands, by prompt) / **denied:** Write, Edit, NotebookEdit, Agent, WebFetch, WebSearch, Skill | — |
| [doc-writer](doc-writer.md) | Writes docs with Mermaid diagrams for implemented behaviour, placed by `docs/README.md`. Docs folders only | sonnet | Read, Write, Edit, Grep, Glob / **denied:** Bash, NotebookEdit, Agent, WebFetch, WebSearch | mermaid-diagram |

None of the agents can spawn subagents. All of them load the `CLAUDE.md` hierarchy automatically, so repo-wide rules
(pnpm vs npm, migrations, never commit) are not restated in the agent files.

## Pipeline

```
request ─▶ researcher (optional) ─▶ planner ─▶ plan file ─▶ user approves ─▶ implementer ─▶ plan-verifier ∥ architecture-reviewer ─▶ gaps? ─▶ doc-writer ─▶ /pr-self-review ─▶ commit
                                               specs/plans/<slug>.md          (fresh context)  (fresh context, read-only)            │          (optional)   (user-run)       (user)
                                                                                                                                     └─▶ implementer (code) / test-writer (tests)
```

test-writer also runs on its own, outside a plan: backfilling tests or reproducing a bug.

## Which agent or tool when

| Need | Use | Not |
|---|---|---|
| Tests that a plan lists | implementer | test-writer |
| Tests for existing code, a bug reproduction, test gaps from plan-verifier | test-writer | implementer |
| "Did we build everything the plan and spec asked for?" | plan-verifier (independent, plan items only) | implementer's own AC table (the writer's claim) |
| "Did the change respect layers and boundaries?" | architecture-reviewer (advisory, no gate) | plan-verifier, `/code-review` |
| Correctness bugs in the diff | `/code-review` | architecture-reviewer |
| Per-skill review of diff lines plus checks, and the pre-PR gate verdict | `/pr-self-review` (user-run) | any agent |
| A plan for future work | planner → `specs/plans/` | doc-writer |
| Docs of shipped behaviour | doc-writer → `docs/`, `<module>/docs/` | planner |

## Inputs and outputs

| Agent | Input | Output (final message) | What it never does |
|---|---|---|---|
| researcher | A concrete question plus its scope (repo / web / both) | Format A (repo) or Format B (external): conclusions with confidence, evidence `path:line` / URLs, "Not found", candidate insights. If the brief is vague: `Clarification needed` | Writes files, runs builds/tests/migrations |
| planner | A feature request or a spec (`specs/`, `<module>/specs/`) | **Development Plan**: goal, constraints C1…, reuse, step table (files · skills · constraints · tests), contract changes, migrations, verification commands, acceptance criteria, out-of-scope, risks, candidate insights. If the brief is vague: `Clarification needed` | Writes files (the caller saves the plan to `specs/plans/<slug>.md`), runs tests/builds, plans commits or `/pr-self-review` |
| implementer | An approved plan (path or text) | Code and tests in the working tree, plus an **Implementation Report**: status, steps, verification evidence (command → exit code → output), AC table, skill checklists, deviations, blocked items, pending user actions, handoff to reviewers, insights recorded | Commits/pushes, applies migrations, works in a worktree/branch, edits existing migrations, `client/src/vendor/**`, `.claude/**`, `.env*`, does architecture/security review |
| test-writer | A concrete target (file, symbol, route, component, behaviour) and a job: backfill, bug reproduction, or a gap list | Test files plus a **Test Report**: tests table (behaviour · seam · regression caught · skills), evidence, bugs found, not covered, raw `git status --short` scope check, insights recorded. If the brief is vague: `Clarification needed` | Edits production code, configs, `e2e/**`; weakens or skips tests; adds snapshot tests; installs deps |
| architecture-reviewer | Changed-file list, ideally with the `git diff` (e.g. implementer's "Handoff to reviewers") | **Architecture Review — CLEAN / ISSUES**: counts, scope by ring/tier, fitness-check table, findings (sev · `file:line` · rule · quoted evidence · fix), legacy, not assessed, candidate insights | Writes anything, runs commands, reports bugs/security/style/tests/plan conformance, records the pre-PR verdict |
| plan-verifier | A plan (path or text), plus the spec it came from if any | **Plan Verification — ALL MET / GAPS**: items = rows count, traceability matrix (ID · verdict · extractive evidence · gap), commands re-run, requirements coverage R → AC, unplanned changes, gaps → owner, not verifiable | Writes files, fixes gaps, gives general advice, reviews architecture/security, applies migrations or runs `dev.sh` |
| doc-writer | Material (plan, spec, implementation report, code) and a target feature or topic | Docs under docs folders plus a **Documentation Report**: files (Diátaxis type · section), claims verified → `path:line`, claims dropped, diagrams, index updates, suggested edits outside scope. Not implemented → `BLOCKED` | Documents planned behaviour as existing; edits `specs/`, `README.md`/`CLAUDE.md`/`INSIGHTS.md`, `docs/agent-prompts/`, code; runs shell |

## Shared contracts between agents

- **Skill routing:** `.claude/skills/pr-self-review/references/routing.md` is the single map from file to skills.
  The planner uses it to assign skills to each step, the implementer and test-writer to load them, and
  `/pr-self-review` to check them. When a skill is added, update that table, not the agents.
- **Definition of done:** the plan's acceptance criteria and verification commands. The implementer reports evidence
  against exactly those, and plan-verifier re-checks them independently. The plan's IDs (step #, C#, AC#) are
  plan-verifier's traceability keys.
- **Severity:** `.claude/skills/pr-self-review/references/severity.md` is the one scale. architecture-reviewer uses it,
  so its findings compare directly with `/pr-self-review` output.
- **Reviewer input:** implementer's "Handoff to reviewers" plus `git status --short` / `git diff` is what the caller
  passes to architecture-reviewer.
- **Docs placement:** `docs/README.md` is doc-writer's section map. Change the map there, not in the agent.
- **Insights:** the planner, architecture-reviewer and doc-writer return candidate insights. implementer and
  test-writer record verified ones through `engineering-insights` phase 3.

## Sources for the agent rules

| Rule | Applies to | Source |
|---|---|---|
| One job per agent; a description that routes to exactly this agent | planner, implementer | [S1](https://code.claude.com/docs/en/sub-agents) |
| Restrictions through `tools`/`disallowedTools`, not prompt text; Bash can still write | planner (no Write/Edit) | [S1](https://code.claude.com/docs/en/sub-agents) |
| Don't rely on `permissionMode`: the parent's mode overrides it | planner | [S1](https://code.claude.com/docs/en/sub-agents), [S5](https://code.claude.com/docs/en/permission-modes) |
| No `memory:` field, because it auto-enables Write/Edit | planner | [S1](https://code.claude.com/docs/en/sub-agents) |
| Preload only short, always-needed skills via `skills:`; load the rest on demand | planner, implementer | [S1](https://code.claude.com/docs/en/sub-agents), [S2](https://code.claude.com/docs/en/skills) |
| Reference skills instead of copying them (progressive disclosure); one routing table | planner, implementer | [S2](https://code.claude.com/docs/en/skills), [S4](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [S8](https://agentskills.io/specification), `routing.md` |
| CLAUDE.md loads into subagents, so repo rules are not restated | planner, implementer | [S1](https://code.claude.com/docs/en/sub-agents), root `CLAUDE.md` |
| The parent sees only the final message, so each agent returns a strict output format | planner, implementer | [S1](https://code.claude.com/docs/en/sub-agents), [S6](https://www.anthropic.com/engineering/multi-agent-research-system), [S7](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| Write a plan with a definition of done, then build in a fresh context | planner → implementer | [S3](https://code.claude.com/docs/en/best-practices), [S4](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (plan-validate-execute) |
| Verification as evidence (command + output), not "tests pass" | implementer | [S3](https://code.claude.com/docs/en/best-practices) |
| Writer ≠ reviewer: architecture and security review are done by separate agents | implementer | [S3](https://code.claude.com/docs/en/best-practices) |
| Clarification gate before work | planner | [S6](https://www.anthropic.com/engineering/multi-agent-research-system) (clear briefs), `researcher.md` pattern |
| Minimal tool set; load context just in time via file paths | planner, implementer | [S7](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| Module rules, insights, test strategy, migration and vendor rules | planner, implementer | root and module `CLAUDE.md`, `INSIGHTS.md`, `TESTING.md`, `server/CLAUDE.md` → Do not touch |
| Pre-PR gate and `/pr-self-review` belong to the user | all | root `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/pr-self-review/SKILL.md` |
| Fresh-context, read-only reviewer; review against the spec; explicit do-not-report list ("a reviewer asked to find problems will always find something") | architecture-reviewer, plan-verifier | [S3](https://code.claude.com/docs/en/best-practices), [S9](https://code.claude.com/docs/en/code-review-local) |
| Find → Verify → Rank; cap minor findings; behaviour claims need a `file:line` citation, not inference from naming; skip what CI enforces | architecture-reviewer | [S10](https://code.claude.com/docs/en/code-review), [S11](https://code.claude.com/docs/en/code-review-customize) |
| Deterministic fitness checks for dependency rules, judgement for the rest; tooling is a follow-up | architecture-reviewer | [S12](https://www.thoughtworks.com/radar/techniques/architectural-fitness-function), [S13](https://github.com/sverweij/dependency-cruiser), [S14](https://github.com/javierbrea/eslint-plugin-boundaries) |
| Read-only guarantee from `tools: Read, Grep, Glob` alone (no Bash) | architecture-reviewer | [S1](https://code.claude.com/docs/en/sub-agents), [S3](https://code.claude.com/docs/en/best-practices) |
| Traceability matrix with forward traceability (requirement → AC → evidence) | plan-verifier | [S15](https://en.wikipedia.org/wiki/Requirements_traceability) |
| One verdict per item, a "cannot assess" verdict, strictly extractive evidence | plan-verifier | [S16](https://arxiv.org/html/2603.00077), [S17](https://arxiv.org/html/2601.08654) |
| Verifiable target and evidence; failing test first for a bug | test-writer | [S3](https://code.claude.com/docs/en/best-practices) |
| New Fastify app per test, `inject()`, always `close()` | test-writer | [S18](https://fastify.dev/docs/latest/Guides/Testing/) |
| Test behaviour, not implementation; mostly integration at the seams | test-writer | [S19](https://kentcdodds.com/blog/write-tests), [S20](https://testing-library.com/docs/guiding-principles/), `TESTING.md` |
| Restore mocks between tests; `vi.mock` is hoisted | test-writer | [S21](https://vitest.dev/guide/mocking.html) |
| Write scope by prompt plus a `git status` check, because `tools` has no path filter (no hook, by user decision) | test-writer, doc-writer | [S1](https://code.claude.com/docs/en/sub-agents) |
| Never weaken or skip tests; document only implemented behaviour | test-writer, doc-writer | repo policy (no external source) |
| Section by Diátaxis compass | doc-writer | [S22](https://diataxis.fr/), [S23](https://diataxis.fr/compass/), `docs/README.md` |
| ADR format (Title, Status, Context, Decision, Consequences), numbered, superseded not rewritten | doc-writer | [S24](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [S25](https://adr.github.io/) |
| Mermaid fences render on GitHub; diagram type by purpose; C4 context/container only | doc-writer | [S26](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams), [S27](https://mermaid.js.org/intro/syntax-reference.html), [S28](https://c4model.com/diagrams), `mermaid-diagram` skill |
| Docs live beside the code and are reviewed like code | doc-writer | [S29](https://www.writethedocs.org/guide/docs-as-code/) |

| # | Source | Type | Date |
|---|---|---|---|
| S1 | [Create custom subagents](https://code.claude.com/docs/en/sub-agents) | official doc | read 2026-11-27 |
| S2 | [Extend Claude with skills](https://code.claude.com/docs/en/skills) | official doc | read 2026-11-27 |
| S3 | [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) | official doc | read 2026-11-27 |
| S4 | [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | official doc | read 2026-11-27 |
| S5 | [Permission modes](https://code.claude.com/docs/en/permission-modes) | official doc | read 2026-11-27 |
| S6 | [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | engineering blog | 2025-06-13 |
| S7 | [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | engineering blog | 2025-09-29 |
| S8 | [Agent Skills Specification](https://agentskills.io/specification) | spec | read 2026-11-27 |
| S9 | [Review locally with /code-review](https://code.claude.com/docs/en/code-review-local) | official doc | read 2026-11-27 |
| S10 | [Code Review](https://code.claude.com/docs/en/code-review) | official doc | read 2026-11-27 |
| S11 | [Customize Code Review](https://code.claude.com/docs/en/code-review-customize) | official doc | read 2026-11-27 |
| S12 | [Architectural fitness function](https://www.thoughtworks.com/radar/techniques/architectural-fitness-function) | Thoughtworks Radar | search snippet only, 2026-11-27 |
| S13 | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | tool README | read 2026-11-27 |
| S14 | [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) | tool README | read 2026-11-27 |
| S15 | [Requirements traceability](https://en.wikipedia.org/wiki/Requirements_traceability) | reference | search snippet only, 2026-11-27 |
| S16 | [Autorubric](https://arxiv.org/html/2603.00077) | preprint | search snippet only, 2026-11-27 |
| S17 | [RULERS: evidence-anchored scoring](https://arxiv.org/html/2601.08654) | preprint | search snippet only, 2026-11-27 |
| S18 | [Fastify Testing guide](https://fastify.dev/docs/latest/Guides/Testing/) | official doc | read 2026-11-27 (v5 "latest") |
| S19 | [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) | blog | 2019, read 2026-11-27 |
| S20 | [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/) | official doc | read 2026-11-27 |
| S21 | [Vitest mocking guide](https://vitest.dev/guide/mocking.html) | official doc | read 2026-11-27 (may be newer than v2) |
| S22 | [Diátaxis](https://diataxis.fr/) | framework | read 2026-11-27 |
| S23 | [Diátaxis compass](https://diataxis.fr/compass/) | framework | read 2026-11-27 |
| S24 | [Documenting Architecture Decisions (Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) | blog | 2011-11-15 |
| S25 | [ADR GitHub organization](https://adr.github.io/) | community site | read 2026-11-27 |
| S26 | [Creating diagrams (GitHub Docs)](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) | official doc | read 2026-11-27 |
| S27 | [Mermaid syntax reference](https://mermaid.js.org/intro/syntax-reference.html) | official doc | read 2026-11-27 |
| S28 | [C4 model diagrams](https://c4model.com/diagrams) | official site | read 2026-11-27 |
| S29 | [Docs as Code (Write the Docs)](https://www.writethedocs.org/guide/docs-as-code/) | community guide | read 2026-11-27 |

## Adding or changing an agent

- Keep a single responsibility and a description that names when to use it **and** what it is not for.
- Scope tools with `tools`/`disallowedTools`. Avoid `memory:` on read-only agents.
- Define a fixed output format; the caller reads only the final message.
- Update the catalog, the pipeline, "Which agent or tool when", the inputs/outputs table, the shared contracts and the
  sources above in the same change.
