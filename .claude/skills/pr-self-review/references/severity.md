# Severity scale

There is one scale for every reviewer. Only **critical** blocks the PR, so be strict about it. A false block
costs a full re-run; a missed critical costs a bad merge.

| Severity | Meaning | Blocks |
|---|---|---|
| **critical** | The changed code will break behaviour, lose or corrupt data, open an exploitable security hole, or violate a **hard architectural rule** of this repo | yes |
| **major** | Likely bug under some conditions, clear violation of a skill's MUST/never rule that does not break anything yet, missing error handling on a real path, wrong layer placement that will spread | no |
| **minor** | Convention or "prefer" rule not followed, readability, naming, small duplication | no |
| **info** | Observation, optional improvement | no |

## Always critical (hard rules)
- **Onion dependency rule** violated in new or changed `server/src` code. Examples: a route or service imports `db/schema`/`drizzle-orm`, a domain or port imports infrastructure, or a service resolves the whole `Container`. This applies to code the diff introduces. A file that already had the violation only counts if the diff adds a new instance.
- **Migrations:** an existing migration was edited or deleted.
- **Contract drift:** a Zod contract was changed in only one of the two `vendor/shared` copies.
- **Cross-package relative import:** it bypasses the `@devdigest/*` aliases.
- **Secret committed:** a real credential, a private key, or a `.env` file.
- **Security:** an exploitable injection (SQL, command, path), SSRF, missing authorization on a mutating route, or XSS through `dangerouslySetInnerHTML` with untrusted data.
- **Confirmed behavioural bug on the main path** of the changed code: the feature does not do what it is for. For example, a filter that can never match because of a wrong field or casing against the contract, data read from an endpoint that does not exist, an inverted condition, a wrong argument order, a missing `await` on a write, or a crash on ordinary input. Any reviewer that finds one reports it as critical, whatever its own skill's scale says. A bug that only shows up on a rare edge case is **major**.
- **Failed deterministic check:** typecheck or a related test fails (`checks.mjs`).
- **Correctness:** a React hook called conditionally, a server-only module (DB, secrets) imported into a `'use client'` component, or a promise rejection that is unhandled and crashes the server process.

## Mapping skill-native scales
| Skill | Native | → Unified |
|---|---|---|
| `react-best-practices` | CRITICAL / HIGH (perf) / MEDIUM (maintainability) | CRITICAL → critical only if it will actually cause a bug in this code, otherwise major; HIGH → major; MEDIUM → minor |
| `security` | CRITICAL / HIGH / MEDIUM / LOW | CRITICAL and HIGH (exploitable) → critical; MEDIUM → major; LOW → minor |
| `zod` | rule impact CRITICAL / HIGH / … | CRITICAL → major, or critical only if unvalidated external input reaches the domain; HIGH → minor |
| Skills without a scale (`onion-architecture`, `frontend-ui-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`, `next-best-practices`, …) | MUST / never / always | critical only if it matches a hard rule above or breaks behaviour; otherwise major |
| | should / prefer | minor |

## Critical needs evidence
A critical finding must cite the exact `file:line` in changed code and the rule it breaks: either skill name plus
section, or the "Always critical" bullet. Without both, report it as major.
