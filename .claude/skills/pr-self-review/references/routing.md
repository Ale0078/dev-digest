# Routing: changed file → skills

A file can match several skills. A skill runs if **any** changed file matches its path glob **or** content trigger.
Content triggers are checked with `grep -l` on the changed files only. Paths are repo-relative.

## Global exclusions (no skill reviewer)
- `*.md`, `*.mdx`, `docs/**`, `specs/**`, `**/INSIGHTS.md`, `.claude/**`, `.cursor/**`
- Lockfiles (`pnpm-lock.yaml`, `package-lock.json`), `*.tsbuildinfo`, `next-env.d.ts`, `client/messages/**` (i18n JSON)
- Generated migration metadata `server/src/db/migrations/meta/**` (only the repo-rule checks look at it)

These files still go through the repo-rule checks (SKILL.md step 4).

## Table

| Skill | Area | Path globs | Content triggers (changed file contains) |
|---|---|---|---|
| `frontend-ui-architecture` | UI | `client/src/**/*.{ts,tsx}` except `client/src/vendor/**` | — |
| `react-best-practices` | UI | `client/**/*.tsx`, `client/src/**/use*.ts`, `client/src/lib/hooks/**` | `from 'react'` |
| `next-best-practices` | UI | `client/src/app/**`, `client/next.config.*`, `client/src/middleware.ts`, `client/src/i18n/**` | `from 'next/`, `'use client'`, `'use server'` |
| `react-testing-library` | UI tests | `client/**/*.test.{ts,tsx}`, `client/src/test/**`, `client/vitest.config.ts` | `@testing-library/` |
| `onion-architecture` | Backend arch | `server/src/**/*.ts` except `server/src/vendor/**`, `server/src/db/migrations/**` | — |
| `fastify-best-practices` | Backend | `server/src/**/routes.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/src/platform/**` | `from 'fastify'`, `FastifyInstance` |
| `drizzle-orm-patterns` | Backend data | `server/src/db/**/*.ts`, `server/src/**/repository.ts`, `server/drizzle.config.ts` | `from 'drizzle-orm` |
| `postgresql-table-design` | Backend data | `server/src/db/schema.ts`, `server/src/db/schema/**`, new `server/src/db/migrations/*.sql` | `pgTable(` |
| `zod` | Contracts | `server/src/vendor/shared/**`, `client/src/vendor/shared/**` | `from 'zod'` |
| `security` | Full-stack | `server/src/**/*.ts`, `reviewer-core/src/**`, `client/src/lib/**`, `client/src/app/**/route.ts`, `**/.env*`, `docker-compose.yml`, `.github/workflows/**` | `process.env`, `fetch(`, `dangerouslySetInnerHTML`, `sql\``, `exec(` |
| `correctness` *(built-in, no skill folder)* | All code | `**/*.{ts,tsx,mts,cts,js,mjs,jsx}`, new `server/src/db/migrations/*.sql` (after the global exclusions) | — |
| `typescript-expert` | Full-stack | `**/tsconfig*.json`, `**/*.d.ts`, `server/src/vendor/shared/**`, `client/src/vendor/shared/**`, `reviewer-core/src/**` | — |

`correctness` has no SKILL.md. Its lens is defined in `subagent-prompt.md` → "Correctness lens".

`reviewer-core/` and `e2e/` have no area-specific skill. Their files get `correctness`/`security`/`typescript-expert` per the table,
plus the repo-rule checks. If `reviewer-core/**` changed, the reviewer brief must also include
`reviewer-core/CLAUDE.md`, because it defines that package's purity rules.

## Module rules in every brief
Each reviewer brief includes the `CLAUDE.md` of the module its files belong to (`client/`, `server/`, `reviewer-core/`,
`e2e/`). Those files hold module-specific hard rules, and the skills alone do not know them.

## Unknown skills (discovery rule)
A skill folder that has a `SKILL.md` but no row here:
1. Read its row in `.claude/skills/README.md`. Scope `Frontend` → `client/**`; `Backend` → `server/**`;
   `Full-stack` → `client/**` + `server/**` + `reviewer-core/**`; `Shared` → do not run it automatically.
2. Narrow the files by matching the description's trigger terms against the file contents.
3. Report it: "routing table needs a row for `<skill>`".

## Maintaining
When a skill is added or removed in `.claude/skills/`, update this table in the same change. Keep the
area-specific skills narrow: a skill that runs on files outside its domain produces noise, not findings.
