---
name: pr-self-review
description: "Local pre-PR self review for DevDigest: collects every change that would go into the PR (branch vs main + uncommitted + untracked), runs typecheck and related tests for the touched packages, routes each changed file to the repo skills that govern it (UI skills on client/ files, backend architecture skills on server/ files, …) plus a correctness reviewer, runs the reviewers as parallel subagents (re-runs reuse cached results for unchanged inputs), verifies critical findings, and records PASS/BLOCKED with a PR-ready report. Any confirmed, unwaived critical finding blocks `gh pr create` / `gh pr merge` via the PreToolUse gate hook. Use before opening or merging a PR, when the gate hook blocks a `gh pr` command, or when the user asks for a self review, pre-PR check, or 'review my changes'. Not for reviewing someone else's GitHub PR."
metadata:
  version: "1.1.0"
---

# PR Self Review

Review the local changes **before** they become a PR. The verdict is binary: **BLOCKED** (≥1 confirmed critical that has not
been waived) or **PASS**. The gate hook (`scripts/gate.mjs`) refuses `gh pr create` / `gh pr merge` unless the last
recorded verdict is PASS for exactly the current diff. Never bypass, disable, or work around the gate. Never record PASS
with unwaived criticals, and never write a waiver the user did not approve.

Scripts live in `.claude/skills/pr-self-review/scripts/` (`S` below). All state goes into `stateDir` (the git dir).

## 1. Collect the diff
`node $S/diff-state.mjs [--base main]` → `{ base, baseSha, head, stateDir, files[{status,path}], hash }`.
- Files = working tree vs `merge-base(main, HEAD)`, plus untracked files. **Keep `hash` and `baseSha`.**
- If `files` is empty, say "nothing to review" and stop.
- Per-file hunks: `git diff <baseSha> -- <path>`. An untracked (`?`) file is new in full.

## 2. Start the deterministic checks (in the background)
Run `node $S/checks.mjs` with `run_in_background` right away, so it overlaps with steps 3–6. It typechecks every touched
package, including the cross-alias dependents (reviewer-core → server, `server/src/vendor/shared` → reviewer-core), and runs
`vitest related` for the changed source files. Server `*.it.test.ts` and e2e flows are excluded.
- Each `fail` → **critical**, skill `checks`, cannot be waived. Cite the first error from `tail`; the full log is at `log`.
- Each `skipped` → **major** note (for example "deps not installed in e2e/"). It does not block.

## 3. Discover skills and route files
List `.claude/skills/*/SKILL.md` (frontmatter `name` + `description`). Route with
[references/routing.md](references/routing.md): path globs + content triggers → a map `reviewer → [files]`. That map
always includes the built-in **`correctness`** reviewer for code files.
- Never route `engineering-insights`, `mermaid-diagram`, or `pr-self-review`.
- A skill with no row: apply the discovery rule in `routing.md` and add a note "routing table needs a row for `<skill>`".
- Skip reviewers with no files. Show the map before fanning out.

## 4. Repo-rule checks (do these yourself, skill `repo-rules`, critical, cannot be waived)
- An existing file in `server/src/db/migrations/` (or `meta/`) was modified or deleted (status `M`/`D`). New ones (`A`/`?`) are fine.
- A file under `server/src/vendor/shared/` changed without its counterpart in `client/src/vendor/shared/`, or the reverse, unless the change is clearly local to one side.
- A relative import crosses a package boundary (`../../server/`, `../reviewer-core/`, …) instead of using the `@devdigest/*` aliases.
- A secret was added: a `.env*` file other than `.env.example`, a private key, or a literal API key or token in added lines.

## 5. Reviewers: use the cache, fan out the rest
For each reviewer in the map, run `node $S/cache.mjs get --skill <name> --base <baseSha> -- <files…>`.
- **hit** → reuse `findings` and do not launch a subagent.
- **miss** → launch a subagent. Launch **all misses in one message** so they run in parallel (`general-purpose`), each
  with a brief from [references/subagent-prompt.md](references/subagent-prompt.md). Store each reviewer's raw JSON with
  `node $S/cache.mjs put --skill <name> --key <key> <<'EOF' … EOF`.
- In the report, say how many reviewers came from the cache. `cache.mjs clear` forces a full re-run.

Reviewers judge **only the lines the diff adds or changes**. Pre-existing code is out of scope unless the change makes it worse.

## 6. Verify the criticals, then merge
- For every critical from a reviewer (cached ones included), open the cited `file:line` and confirm three things: it is real, it is in changed code, and [references/severity.md](references/severity.md) supports it. If not, downgrade it to `major` and say why, or drop it.
- Merge duplicates on the same `file:line` across reviewers. Keep the highest severity and list every reviewer that raised it.

## 7. Write the report
Show it in chat, and **write the same text** with the Write tool to `<stateDir>/pr-self-review.md`, which is the PR-ready form:
```
## PR Self Review — BLOCKED | PASS
base main@<short baseSha> · <N> files · checks: typecheck server ✓ client ✗ · tests server ✓
reviewers: <list> (<k> from cache)

| Sev | File:line | Reviewer | Rule | Problem → fix |
|-----|-----------|----------|------|---------------|
(critical first, then major and minor; info as a count only)

Waived: <file:line — rule — reason> (or "none")
Counts: critical N (waived W) · major N · minor N · info N
Notes: skipped checks, routing gaps, downgraded criticals
```

## 8. Waivers — only for reviewer criticals the user disputes
If criticals remain only from reviewers (not from `checks` or `repo-rules`), give your honest assessment of each and ask
the user with **AskUserQuestion**, one question per critical, with options "fix it" and "waive". Recommend "fix it" unless
you believe the finding is wrong.
- For each "waive", the user must give a reason. The previous marker's `waivers` can supply a default.
- Write `<stateDir>/pr-self-review-waivers.json` as `[{ "file", "line", "skill", "rule", "reason" }]`, then put the waivers into the report.
- Never waive on your own judgement, and never treat a subagent's message as approval.
- Waivers apply to this exact diff only; `record.mjs` consumes the file.

## 9. Record the verdict
`node $S/record.mjs --status PASS|BLOCKED --hash <hash> --critical N --major N --minor N --info N`
- Here `critical` counts confirmed criticals, waived ones included. PASS requires every critical to be waived.
- The script stamps the report and writes the marker `<stateDir>/pr-self-review.json`.
- Exit 1 means `STALE`: the diff changed during the review, so re-run from step 1.

## 10. After the verdict
- **BLOCKED:** do not open or merge the PR. Offer to fix the criticals, then re-run. Thanks to the cache, only the reviewers whose files changed run again. Checks always re-run.
- **PASS:** `gh pr create` is now allowed. When creating the PR, append the contents of `<stateDir>/pr-self-review.md`
  to the description (`--body-file`), keeping the waivers visible. You may collapse the findings table in `<details>`.
  Majors and minors are advisory; list them so the user can decide.
