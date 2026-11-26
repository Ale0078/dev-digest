# pr-self-review

**Version:** 1.2.0 · **Scope:** Shared (whole repo) · **Status:** draft, pending human review

Local self review that runs before a PR is opened. It collects everything the PR would contain and routes each changed
file to the repo skills that govern it: UI skills run on `client/`, backend architecture skills on `server/`, and
so on. Each matched skill runs as its own parallel reviewer subagent. A built-in `correctness` reviewer hunts bugs, and
typecheck plus related tests run deterministically. Any **confirmed, unwaived critical** finding blocks
`gh pr create` / `gh pr merge` through a Claude Code hook.

The skill holds no review rules of its own; those stay in the existing skills. It owns only the orchestration
(routing, severity scale, verdict) plus a few hard rules taken from the repo `CLAUDE.md` files.

## How it runs
- **Manually:** `/pr-self-review`, or ask "self-review my changes".
- **Automatically:** `.claude/settings.json` registers `scripts/gate.mjs` as a `PreToolUse` hook on `Bash`. When Claude runs `gh pr create` or `gh pr merge`, the hook checks `<git-dir>/pr-self-review.json`. It blocks the command (exit 2) when the marker is missing, stale, or `BLOCKED`, or when its hash does not match the current diff. The stderr message tells Claude to run this skill.

## What is reviewed
The working tree compared with `merge-base(main, HEAD)`, plus untracked files. The diff hash is computed from path and
current content, so staging or committing the reviewed changes keeps it valid. Any edit invalidates it.

## Pipeline
1. **Diff state:** files, hash, and base (`diff-state.mjs`).
2. **Deterministic checks** in the background (`checks.mjs`). Typecheck covers touched packages and their alias dependents. `vitest related` runs for changed sources, excluding server `*.it.test.ts`. A failure is critical and cannot be waived.
3. **Routing:** files go to skills plus `correctness`. **Repo-rule checks:** violations are critical and cannot be waived.
4. **Reviewers:** results are looked up in the cache first (`cache.mjs`, key = reviewer + base + file contents + skill/brief/severity/routing + module `CLAUDE.md`). Only cache misses fan out as parallel subagents.
5. **Verify criticals**, then write the report to `<git-dir>/pr-self-review.md`.
6. **Waivers** (optional, reviewer criticals only, each one approved by the user with a reason). Then `record.mjs` writes the marker.
7. **After PASS,** the report is appended to the PR description, with waivers visible.

## Files
| File | Contents |
|---|---|
| `SKILL.md` | Orchestrator workflow: diff → discover skills → route → repo-rule checks → parallel reviewers → verify criticals → report → record |
| `references/routing.md` | Skill ↔ path-glob / content-trigger table, exclusions, discovery rule for new skills |
| `references/severity.md` | Unified critical/major/minor/info scale, hard rules that are always critical, mapping from each skill's own scale |
| `references/subagent-prompt.md` | Brief template, JSON finding schema, and the `correctness` lens |
| `scripts/lib.mjs` | Shared helpers: merge-base, diff state and hash, marker I/O |
| `scripts/diff-state.mjs` | Prints `{base, baseSha, head, files, hash}` |
| `scripts/checks.mjs` | Typecheck and related unit tests for touched packages; logs go to `<git-dir>/pr-self-review-logs/` |
| `scripts/cache.mjs` | `get` / `put` / `clear` for the per-reviewer findings cache (`<git-dir>/pr-self-review-cache.json`) |
| `scripts/record.mjs` | Validates waivers, stamps the report, and writes the verdict marker; records `STALE` if the diff changed during the review; refuses PASS with unwaived criticals |
| `scripts/gate.mjs` | PreToolUse hook that blocks `gh pr create` / `gh pr merge` |

## Known limitations
- The gate only works inside Claude Code. Running `gh` by hand or using the GitHub web UI is not gated. Future work: a git `pre-push` hook or a CI status check that branch protection requires.
- The gate ignores heredoc bodies and quoted strings, so text *about* `gh pr create` does not trip it. It then matches `gh pr create|merge` only at a command position. As a consequence, `bash -c "gh pr create"` is not gated. The gate protects against accidents, not deliberate evasion.
- `gh pr merge <n>` is checked against the **local** diff, not against PR `<n>`.
- Waivers are trusted on the agent's side: `record.mjs` checks their shape and reason, but cannot prove the user approved them. The PR description shows them, so human reviewers see every one.
- `checks.mjs` needs installed deps. A package without `node_modules` is reported as skipped (major, not blocking). e2e flows and DB-backed tests are never run.
- The cache is keyed by file contents, not by imports. If a change in an unrouted file makes a reviewer's earlier finding wrong, `cache.mjs clear` forces a fresh run.
- Reviews are LLM-based. Criticals are re-verified by the orchestrator before they block, but false positives and false negatives are still possible.

## Maintaining
- When a skill is added or removed, update `references/routing.md` in the same change.
- New hard rules go in `references/severity.md` → "Always critical", and in SKILL.md step 4 if the orchestrator can check them mechanically.

## Changelog
| Version | Date | Changes |
|---|---|---|
| 1.2.0 | 2026-11-26 | `disable-model-invocation: true`: the skill is user-invoked only (`/pr-self-review`); root `CLAUDE.md` tells the agent to ask the user to run it. Gate hook unchanged |
| 1.1.0 | 2026-11-24 | Deterministic checks (typecheck and related tests), built-in `correctness` reviewer plus a "behavioural bug = critical" rule, per-reviewer findings cache for incremental re-runs, user-approved waivers, PR-ready report for the PR description |
| 1.0.0 | 2026-11-24 | Initial version |

## Sources
- Claude Code hooks (PreToolUse, exit code 2 blocks, `CLAUDE_PROJECT_DIR`): https://docs.claude.com/en/docs/claude-code/hooks
- Claude Code skills (frontmatter, progressive disclosure): https://docs.claude.com/en/docs/claude-code/skills
- Claude Code subagents (parallel fan-out): https://docs.claude.com/en/docs/claude-code/sub-agents
- Vitest CLI `related`, `--exclude`, `--passWithNoTests`: https://vitest.dev/guide/cli
- GitHub CLI `--body-file`: https://cli.github.com/manual/gh_pr_create
- `git merge-base`: https://git-scm.com/docs/git-merge-base · `git diff`: https://git-scm.com/docs/git-diff · `git ls-files --others --exclude-standard`: https://git-scm.com/docs/git-ls-files
- GitHub CLI `gh pr create` / `gh pr merge`: https://cli.github.com/manual/gh_pr_create, https://cli.github.com/manual/gh_pr_merge
- Repo rules: `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`, `reviewer-core/CLAUDE.md`
- Routed skills and their native severity scales: `.claude/skills/*/SKILL.md` (notably `react-best-practices` → Severity Levels, `security` → Severity Classification, `onion-architecture` → Pre-finish checklist)
