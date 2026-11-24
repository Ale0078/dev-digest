# Reviewer subagent brief (template)

Fill in the `{…}` placeholders. Send one brief per skill, and launch all of them in one message.

---

You are reviewing local changes in the DevDigest repo (`{repoRoot}`) through the lens of **one** skill: `{skill}`.

1. Read `.claude/skills/{skill}/SKILL.md`. Open its reference files only when a changed line needs them.
   (For `correctness`, there is no skill file; use the "Correctness lens" below instead.)
2. Read these module rules: {moduleClaudeMdList}
3. Read the unified severity scale in `.claude/skills/pr-self-review/references/severity.md`. Use only that scale.
4. Review only these files: {fileList}
   - For tracked files, run `git diff {baseSha} -- <file>` to get the hunks, and read the surrounding code as needed.
   - Untracked files are entirely new; review the whole file.
5. Judge only lines that the diff adds or changes. Ignore pre-existing code, unless the change makes an existing problem worse or depends on it.
6. Stay inside `{skill}`'s scope. Other reviewers cover the other skills, so do not report generic style or issues outside this skill.
   One exception: if you notice a confirmed behavioural bug, always report it as critical (see severity.md).
7. Every finding needs a concrete `file:line` and a concrete fix. If you are not sure something is a problem, either lower the severity or leave it out.
8. Do not modify any files.

Return **only** a JSON array (`[]` if you find nothing):
```json
[
  {
    "skill": "{skill}",
    "file": "server/src/modules/pulls/routes.ts",
    "line": 42,
    "severity": "critical | major | minor | info",
    "rule": "<skill section or severity.md 'Always critical' bullet>",
    "problem": "<one sentence>",
    "fix": "<one sentence>"
  }
]
```

---

## Correctness lens (`{skill}` = `correctness`)

Replace step 1 with this lens. Look for **bugs**, not style or architecture:
- **Contract mismatch:** field names, casing, enums, or nullability that differ from `@devdigest/shared` (`server/src/vendor/shared`, `client/src/vendor/shared`). Also calls to routes or endpoints that do not exist on the server (check `server/src/modules/*/routes.ts`).
- **Logic errors:** inverted or always-true/false conditions, wrong operator, off-by-one, wrong argument order, a variable shadowed or never used.
- **Async errors:** a missing `await`, an unhandled rejection, a race between state updates, a stale closure.
- **Data errors:** a write outside a needed transaction, a lost update, a wrong `where` clause (affects every row, or none), missing not-found handling.
- **Unhandled input:** null or undefined, an empty list, or an error response read as if it were success.

For each finding, describe the input or state that produces the wrong result. If you cannot say when it fails, it is not a finding.
