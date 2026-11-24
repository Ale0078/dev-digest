# onion-architecture

This skill makes agents apply Onion Architecture to new and changed code in the backend (`server/`).

## Why
`server/` already splits code into routes, services, repositories and adapters, and `platform/container.ts` acts as the
composition root. Until now those layers were only a convention, and they have leaked: some routes import Drizzle,
services resolve the whole `Container`, and some orchestrators import `db/schema`. This skill turns the convention
into explicit rules with a checklist.

## Scope
- **Covers:** `server/src/**`, which includes Fastify routes, application services, Drizzle repositories, adapters,
  ports and `Container`.
- **Does not cover:** `client/`, `e2e/`, and `reviewer-core/`, which is already a pure core with its own `CLAUDE.md` rules.
- **Legacy:** existing violations are not mass-refactored. Rules apply to new code and to files the task already
  changes (boy-scout rule).
- **Enforcement:** written rules plus a pre-finish checklist (grep checks). There is no automated lint yet.
  dependency-cruiser is listed in `references.md` as future work.

## The rule in one line
Dependencies point only inward: **domain ← ports ← application services ← infrastructure / HTTP**, and
`platform/container.ts` wires them together.

## Files
| File | Contents |
|---|---|
| [SKILL.md](SKILL.md) | Agent entry point: rings, hard rules per file type, a "where does this go" guide, the legacy policy and the checklist |
| [references/layers.md](references/layers.md) | Full ring → path mapping, import matrix, list of known legacy violations |
| [references/fastify.md](references/fastify.md) | Routes as thin adapters, error handling, why we use no second DI system |
| [references/drizzle.md](references/drizzle.md) | Repository as infrastructure behind a port, row → DTO mapping, transactions and unit of work |
| [references/zod.md](references/zod.md) | Contracts vs transport schemas, parse-don't-validate |
| [references/testing.md](references/testing.md) | Testing style per ring, mocks, `*.it.test.ts` |
| [examples.md](examples.md) | Bad → good pairs based on real patterns in this repo |
| [references.md](references.md) | Articles and docs this skill is based on |

## How it triggers
The agent loads it whenever it adds or changes a server module, route, service, repository, adapter, port or
`Container` wiring, or has to decide where server code belongs. `server/CLAUDE.md` points to it under "Read when".

## Maintaining
- When a legacy violation is fixed, remove it from `references/layers.md` → "Known violations".
- When a new ring-level convention appears (for example a unit-of-work port), add it to `SKILL.md` and give it an
  example in `examples.md`.
- Keep `SKILL.md` short. Put details in `references/`.
