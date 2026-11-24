# Testing per ring

The onion pays off in tests: the core runs without infrastructure (Palermo, Cockburn).

| Ring | Test style | Tools | File name |
|---|---|---|---|
| Domain | Pure input → output | Vitest only | `*.test.ts` |
| Application service | Construct with fake ports | `adapters/mocks.ts` (`MockLLMProvider`, `MockGitHubClient`, `MockGitClient`, `MockCodeIndex`, `MockAuthProvider`, `MockSecretsProvider`, `MockEmbedder`) or a small in-memory implementation of the repository port | `*.test.ts` |
| HTTP | `buildApp({ overrides })` + `app.inject()` | `ContainerOverrides` | `*.test.ts` (no DB) / `*.it.test.ts` (DB) |
| Infrastructure (repository) | Real Postgres | `test/helpers/pg.ts` (testcontainers) | **must** be `*.it.test.ts` |

## Rules
- If a service test needs Docker, the service depends on something concrete — fix the dependency, not the test.
- New port ⇒ new mock in `adapters/mocks.ts` in the same change.
- Run unit tests: `pnpm exec vitest run --exclude '**/*.it.test.ts'`; integration: `pnpm exec vitest run .it.test`.
- Read `../../../../TESTING.md` before writing tests.
