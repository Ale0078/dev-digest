# Writing agent prompts

How a review agent's `system_prompt` is turned into the messages a model sees, and
the conventions that keep findings, scores, and verdicts consistent.

These are the prompts that drive each reviewer agent (stored on `agents.system_prompt`
in the DB). The canonical, reviewable copies live next to this file:

- [`general-reviewer.md`](./general-reviewer.md)
- [`security-reviewer.md`](./security-reviewer.md)
- [`performance-reviewer.md`](./performance-reviewer.md)
- [`test-quality-reviewer.md`](./test-quality-reviewer.md)

> The DB is the source of truth at run time. These files are the human-readable
> originals — when you change a prompt, edit the file here **and** push it to the
> agent (`PUT /agents/:id`, which versions the change into `agent_versions`).

## How a prompt is assembled

Assembly happens in `reviewer-core/src/prompt.ts` (`assemblePrompt`). The model
receives exactly two messages:

**System message** = your agent prompt **+** a fixed injection guard:

```
<your system_prompt>

## Skills              // only when the agent has effective skills (M2)
### <skill name>
<skill description>

<skill body>           // one block per enabled skill, in link order

<SCOPE_RULES>       // only when a PR intent is injected (M3): tag each finding in_scope / out_of_scope

<INJECTION_GUARD>   // appended verbatim to EVERY agent, every run
```

Skills are trusted instructions (the imported → disabled → manual enable flow is
the trust gate), so they live in the system message and are not `<untrusted>`-wrapped.
With no effective skills the `## Skills` section is absent and the prompt is unchanged.

`INJECTION_GUARD` (`prompt.ts:16`) tells the model that everything inside
`<untrusted>…</untrusted>` is data, never instructions, and that claims like "test
fixture / not for production / ignore this" never descope the review. You do not
need to repeat any of this in your prompt — it is always there.

**User message** = the task and all context, in this order, each untrusted block
delimiter-wrapped (`assemblePrompt` in `prompt.ts`):

```
<task line, e.g. "Review PR #7 '…'">
## PR description        (untrusted, author-controlled, truncated to 4000 chars)
## PR intent             (untrusted `pr-intent`; only when the user detected an intent for this PR, M3)
## Relevant memory       (curated memory items)
## Repo skeleton         (untrusted, repo-derived)
## Project context       (untrusted spec chunks)
## Callers of changed symbols  (untrusted, repo-derived)
## Diff to review        (untrusted)
```

### PR intent and the scope filter (M3)

The intent is a structured summary (summary, in/out of scope, risk areas) produced by a separate
cheap call that the user triggers with **Detect** on the PR Overview (never during a review run).
A review only *reads* the stored intent. When one exists, `assemblePrompt` adds the `## PR intent`
section and a trusted `SCOPE_RULES` paragraph (system message, before `INJECTION_GUARD`) asking the
model to set `scope: "in_scope" | "out_of_scope"` on every finding and to always report serious
defects. The intent is re-injected as untrusted data, so it can inform a finding but never waives one.

After grounding, `applyScopeFilter` (`reviewer-core/src/scope-filter.ts`) runs deterministically:
out-of-scope findings are dropped, except that exactly one *serious* out-of-scope finding
(`severity === 'CRITICAL'` or `category === 'security'`; picked by severity, confidence, file, line,
title) is kept with a note appended to its rationale. The filter is off (tags are kept, nothing is
dropped) when the intent is stale (the PR head moved since detection) or its confidence is `low`.
With no stored intent the prompt is byte-identical to the one without this feature.

Sections with no content are omitted. Everything repo- or author-derived is wrapped
in `<untrusted source="…">…</untrusted>` so the model can tell instructions
(system) from data (user).

## The output schema is NOT in the prompt

This is the most common source of confusion. The structure of the response — the
`{ verdict, summary, score, findings[] }` object and every field type — is enforced
**out of band** by the provider, not by prompt text:

```ts
// reviewer-core/src/llm/openrouter.ts
response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } }
```

The schema is the Zod `Review` contract in
`server/src/vendor/shared/contracts/findings.ts`, converted to JSON Schema and sent
as a separate API parameter. In `strict` mode the model **cannot** return anything
that doesn't match it. Consequences for prompt authors:

- **Do not describe the JSON shape, field names, or a markdown layout in the prompt.**
  It is redundant at best and actively harmful when it disagrees with the schema
  (e.g. a prompt that asks for `### [SEVERITY]` markdown sections while the schema
  demands a JSON object — the model gets two conflicting specs and produces garbage
  in the fields the prompt didn't pin down).
- **Use the schema's own vocabulary.** Severity is exactly `CRITICAL | WARNING |
  SUGGESTION`. Verdict is exactly `request_changes | approve | comment`. Do not
  introduce a different scale ("High/Medium/Low") in the prompt — the model will map
  it onto the enum inconsistently and inflate severities.
- **Field *meaning* belongs in the schema's `.describe()`, field *judgment* belongs
  in the prompt.** The prompt's job is to tell the model *what to flag and at what
  severity*, and *when each verdict applies* — not what the JSON looks like.

## Required conventions (every reviewer prompt)

Every reviewer prompt must end with three blocks, because the engine derives
numbers and gates from what the model returns:

1. **Severity rubric** mapped to the three enum levels, with an explicit
   anti-inflation rule. Only `CRITICAL` blocks merge, so a model that calls
   everything CRITICAL turns every PR into a blocker. State plainly that speculative
   issues ("might be", "if not already handled") are at most `WARNING`.

2. **Verdict semantics.** The model owns `verdict`, so it must be told the mapping:
   `request_changes` ⇔ at least one CRITICAL; `comment` ⇔ only non-blocking
   findings; `approve` ⇔ empty findings list. **No findings ⇒ approve.** Without
   this, models default `verdict` arbitrarily (we have observed `request_changes`
   returned with zero findings and a summary saying "no issues found").

3. **Findings discipline.** No duplicate findings; no padding toward a count. There
   is no minimum or target — zero is a good answer. Models treat "return at most N
   findings" as a quota and pad the list with repeats to hit N, which also corrupts
   the score. State that the count is free and repeats are forbidden.

## How the engine uses the output (why the conventions matter)

`reviewer-core/src/review/run.ts` + `reduce.ts`:

- **`score` is recomputed**, never trusted from the model:
  `scoreFromFindings(grounded)` (`reduce.ts:27`). 0 findings ⇒ 100; each CRITICAL
  −35, WARNING −12, SUGGESTION −3. So the number on screen always matches the
  findings list. The model's self-reported score is ignored.
- **Findings are citation-grounded**: a finding whose line range doesn't intersect a
  real diff hunk is dropped (`grounding.ts`). Cite real `file:line` from the diff or
  the finding disappears.
- **`verdict` is currently passed through from the model** (`run.ts:208`). That is
  why a wrong verdict reaches the UI unchanged — and why the verdict convention
  above is load-bearing until/unless the verdict is also derived deterministically.

## Severity / verdict / gate at a glance

| Model returns | Engine does |
|---|---|
| `findings[].severity` | recompute `score`; count CRITICAL as blockers |
| `score` | **ignored** — recomputed from findings |
| `verdict` | passed through to the review record (shown in the UI) |
| `findings[]` | citation-grounded; ungrounded ones dropped |

The per-agent merge gate (`agents.ciFailOn`, default `critical`) decides when a CI
review **blocks**: it is deterministic from finding severities, independent of the
model's `verdict`. Keep your severities honest and the gate behaves.

## Checklist before shipping a prompt

- [ ] Role + concrete "what to look for", in priority order.
- [ ] "Analyze along the execution path; state the mechanism" guidance.
- [ ] Quality bar: precision over volume; empty list is allowed.
- [ ] Severity rubric using `CRITICAL/WARNING/SUGGESTION` + anti-inflation rule.
- [ ] Verdict mapping incl. "no findings ⇒ approve".
- [ ] Findings discipline: distinct only, no count target.
- [ ] No JSON shape / markdown layout / alternate severity scale described in prose.
- [ ] No "return at most N findings" quota.
- [ ] File updated here **and** pushed to the agent (versioned).
