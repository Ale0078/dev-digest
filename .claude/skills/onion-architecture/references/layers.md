# Layers and the import matrix

Palermo's tenets (part 4): the app is built around an independent object model; inner layers define interfaces,
outer layers implement them; coupling is toward the center; the core compiles and runs without infrastructure.

## Mapping to `server/src`

| Ring (inner → outer) | Path | Role |
|---|---|---|
| 1. Domain model | `vendor/shared/contracts/*` | Zod schemas + inferred types = entities/value objects shared with the client |
| 1. Domain model | `modules/pulls/status.ts`, `modules/reviews/findings.ts`, `modules/*/helpers.ts`, `modules/*/constants.ts` | Pure rules and calculations |
| 1. Domain model | `@devdigest/reviewer-core` | Pure review engine (only side effect: injected `LLMProvider`) |
| 2. Ports | `vendor/shared/adapters.ts` | `LLMProvider`, `Embedder`, `GitHubClient`, `GitClient`, `CodeIndex`, `AuthProvider`, `SecretsProvider` |
| 2. Ports | `modules/repo-intel/types.ts` | `RepoIntel` facade — reference example of a module port |
| 2. Ports | `adapters/depgraph/index.ts`, `adapters/tokenizer/index.ts` | `DepGraph`, `Tokenizer` interfaces (co-located with impl; acceptable for server-only ports) |
| 3. Application | `modules/*/service.ts`, `modules/reviews/run-executor.ts` | Use cases: orchestrate ports, enforce workflow, throw `AppError` |
| 4. Infrastructure | `modules/*/repository.ts`, `modules/reviews/repository/*.repo.ts` | Drizzle data access |
| 4. Infrastructure | `adapters/**` | Octokit, simple-git, ripgrep, OpenAI/Anthropic, ast-grep, tiktoken, local secrets |
| 4. Infrastructure | `db/**` | Schema, client, migrations, seeds |
| 4. HTTP entry | `modules/*/routes.ts`, `modules/index.ts`, `app.ts`, `server.ts` | Fastify plugins |
| Cross-cutting platform | `platform/errors.ts`, `platform/config.ts` | Error taxonomy (importable from all rings except domain), config (composition root only) |
| Composition root | `platform/container.ts` | Builds concrete classes, exposes them as interfaces, honours `ContainerOverrides` |

## Import matrix (✅ allowed, ❌ forbidden)

| from ↓ / to → | domain | ports | application | infrastructure | HTTP | container |
|---|---|---|---|---|---|---|
| domain | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| application | ✅ | ✅ | ✅ (own module) | ❌ | ❌ | ❌ (new code) |
| infrastructure | ✅ | ✅ | ❌ | ✅ (own lib) | ❌ | ❌ |
| HTTP | ✅ | ✅ (types) | ✅ | ❌ | ✅ | ✅ (to resolve services) |
| container | ✅ | ✅ | ✅ | ✅ | ❌ | — |

Type-only imports (`import type`) obey the same rules: a `*Row` type in a service is still a leak.

## Known violations (legacy — don't mass-fix)

| File | Violation |
|---|---|
| `modules/pulls/routes.ts` | imports `drizzle-orm` + `db/schema`, queries in the route |
| `modules/settings/routes.ts`, `modules/workspace/routes.ts`, `modules/polling/routes.ts` | Drizzle/`db/schema` in routes |
| `modules/settings/feature-models.ts` | Drizzle outside a repository |
| `modules/reviews/run-executor.ts`, `modules/reviews/diff-loader.ts` | import `db/schema` and `*Row` types; take `Container` |
| `modules/*/service.ts` | take `Container` and construct their own repository |

Fix only what the current task touches (see Legacy policy in `SKILL.md`).
